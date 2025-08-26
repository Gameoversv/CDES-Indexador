import os
import json
import uuid
import mimetypes
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, status, Query, Depends, Form, Request
from fastapi.responses import StreamingResponse

from services.ai_service import extract_metadata, is_supported_file, estimate_processing_time
from services.firebase_service import (
    upload_file_to_storage,
    download_file_from_storage,
    list_files_in_storage,
    calculate_file_hash,
    check_file_hash,
    save_document_metadata,
    get_document_by_filename,
    get_document_by_stem,
    get_highest_version,
    get_firestore_client
)
from google.cloud.firestore_v1.base_query import FieldFilter
from services.meilisearch_service import add_documents, search_documents, is_available as is_meilisearch_available, LIBRARY_INDEX_NAME
from models.document_model import DocumentMetadata, DocumentListResponse
from utils.audit_logger import log_event as audit_log, log_error
from services.security import verify_firebase_token

router = APIRouter(
    prefix="",
    tags=["documentos"],
    responses={
        404: {"description": "Documento no encontrado"},
        400: {"description": "Error en los datos de entrada"},
        500: {"description": "Error interno del servidor"}
    }
)

ROOT_DIR = Path(__file__).resolve().parents[1]
LOCAL_METADATA_DIR = ROOT_DIR / ".." / "meilisearch-data" / "indexes" / "documents"
LOCAL_METADATA_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 1024 * 1024 * 1024  # 1GB (effectively removing the 50MB limit)
ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.pptx', '.xlsx', '.txt', '.md', '.mp4'}

# ===============================
# Utilidad de contexto para logs
# ===============================

def _ctx(request: Optional[Request], extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {
        **(extra or {}),
        "client_ip": (request.client.host if request and request.client else None),
        "user_agent": (request.headers.get("user-agent") if request else None),
        "route": (str(request.url.path) if request else None),
        "source": "api",
    }

def _norm(text: Optional[str]) -> str:
    """Normaliza texto para comparación de roles."""
    import unicodedata
    if not isinstance(text, str):
        return ""
    t = unicodedata.normalize("NFD", text)
    t = t.encode("ascii", "ignore").decode("utf-8").lower()
    for ch in [" ", "_", "-", "/", "."]:
        t = t.replace(ch, "")
    return t.strip()

def _role_display_from_firestore(role_value: Optional[str]) -> Optional[str]:
    """Map Firestore 'role' to human-friendly puesto_trabajo used in docs."""
    if not role_value:
        return None
    mapping = {
        "DireccionEjecutiva": "Dirección Ejecutiva",
        "CoordinacionAdministrativa": "Coordinación Administrativa",
        "CoordinadorAdministrativa": "Coordinación Administrativa",
        "CoordinacionProyectosyPlanificacion": "Coordinación Proyectos y Planificación",
        "CoordinacionProyectosPlanificacion": "Coordinación Proyectos y Planificación",
        "CoordinacionComunicaciones": "Coordinación de Comunicaciones",
        "AsistenciaGeneral": "Asistencia General",
    }
    return mapping.get(role_value, role_value)

# ===============================
# Helpers internos
# ===============================

def _validate_uploaded_file(file: UploadFile) -> None:
    if not file.filename:
        raise HTTPException(status_code=400, detail="El archivo debe tener un nombre válido")

    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Tipo de archivo no soportado")

    dangerous_chars = ['..', '/', '\\', '<', '>', ':', '"', '|', '?', '*']
    if any(char in file.filename for char in dangerous_chars):
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido")


def _save_metadata_locally(metadata: Dict[str, Any], filename: str) -> Path:
    json_filename = f"{Path(filename).stem}.json"
    json_path = LOCAL_METADATA_DIR / json_filename

    with open(json_path, "w", encoding="utf-8") as file:
        json.dump(metadata, file, ensure_ascii=False, indent=2)

    return json_path

# ===============================
# Endpoints
# ===============================

@router.post("/upload", response_model=DocumentMetadata)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    cover_image: Optional[UploadFile] = File(None),  # Imagen de portada opcional
    is_public: bool = Form(False),
    apartado: str = Form(None),
    categoria: str = Form(None),
    tags: str = Form(None),
    user_role: str = Form(None),
    puesto: str = Form(None),  # Alternativa para user_role (compatibilidad)
    puesto_trabajo: str = Form(None),  # Puesto de trabajo específico del formulario
    estrategia: str = Form(None),  # Campo para PES 2030
    proyecto: str = Form(None),  # Campo para proyecto específico
    token_data=Depends(verify_firebase_token)
):
    user_id = token_data["user_id"]
    user_email = token_data.get("email", "")
    
    # Use puesto as fallback for user_role if user_role is not provided
    effective_user_role = user_role or puesto

    try:
        _validate_uploaded_file(file)

        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="El archivo está vacío")

        if len(file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail=f"Archivo excede {MAX_FILE_SIZE // (1024*1024)}MB")

        file_hash = calculate_file_hash(file_bytes)
        existing_doc = check_file_hash(file_hash)
        if existing_doc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Archivo duplicado detectado")

        # Procesar imagen de portada si se proporciona
        cover_image_path = None
        if cover_image and cover_image.filename:
            # Validar que sea una imagen
            if not cover_image.content_type or not cover_image.content_type.startswith("image/"):
                raise HTTPException(status_code=400, detail="El archivo de portada debe ser una imagen")
            
            cover_image_bytes = await cover_image.read()
            if not cover_image_bytes:
                raise HTTPException(status_code=400, detail="La imagen de portada está vacía")
            
            # Subir imagen a la carpeta Biblioteca_Portadas/ con el mismo nombre
            cover_storage_path = f"Biblioteca_Portadas/{cover_image.filename}"
            try:
                upload_file_to_storage(cover_image_bytes, cover_storage_path, cover_image.content_type)
                cover_image_path = cover_storage_path
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error subiendo imagen de portada: {str(e)}")

        # Versionado
        file_stem = Path(file.filename).stem
        
        # Determinar la colección basada en si el documento es público
        collection_name = "library" if is_public else "documents"
        existing_document = get_document_by_stem(file_stem, collection_name)

        version = 1
        parent_id = None
        file_id = file_stem

        if existing_document:
            highest_version = get_highest_version(file_stem, collection_name)
            version = highest_version + 1
            parent_id = file_stem
            file_id = f"{file_stem}_v{version}"

        content_type = file.content_type or "application/octet-stream"
        extracted_metadata = extract_metadata(file_bytes, file.filename)
        
        # Initialize custom metadata
        custom_metadata = {}
        if apartado:
            custom_metadata["apartado"] = apartado
        if categoria:
            custom_metadata["categoria"] = categoria
        if tags:
            custom_metadata["tags"] = tags.split(",") if isinstance(tags, str) else tags
        if effective_user_role:
            custom_metadata["user_role"] = effective_user_role
        if puesto_trabajo:
            custom_metadata["puesto_trabajo"] = puesto_trabajo
        if estrategia:
            custom_metadata["estrategia"] = estrategia
        if proyecto:
            custom_metadata["proyecto"] = proyecto
            
        # Create final filename with version if needed
        final_filename = file.filename
        if version > 1:
            file_stem = Path(file.filename).stem
            file_ext = Path(file.filename).suffix
            final_filename = f"{file_stem}_v{version}{file_ext}"
            
        # Decide subfolder based on apartado
        apartado_folder = None
        storage_filename = final_filename
        if apartado:
            # Get current date for folder structure
            today = datetime.now()
            year = f"{today.year:04d}"
            month = f"{today.month:02d}"
            
            if apartado == "CDES inst.":
                # Use puesto_trabajo from form (prioritize form data over extracted metadata)
                actual_puesto_trabajo = puesto_trabajo or extracted_metadata.get("puesto_trabajo")
                # Build path: CDES_inst/{puesto_trabajo}/{categoria}/{año}/{mes}/filename
                subfolders = ["CDES_inst"]
                if actual_puesto_trabajo:
                    subfolders.append(str(actual_puesto_trabajo))
                if categoria:
                    subfolders.append(str(categoria))
                subfolders.extend([year, month])
                storage_filename = "/".join(subfolders + [final_filename])
            elif apartado == "PES 2030":
                # Get estrategia and proyecto from form data
                actual_estrategia = estrategia or extracted_metadata.get("estrategia")
                actual_proyecto = proyecto or extracted_metadata.get("proyecto")
                
                # Build path: PES_2030/{estrategia}/{proyecto}/{categoria}/{año}/{mes}/filename
                subfolders = ["PES_2030"]
                if actual_estrategia:
                    subfolders.append(str(actual_estrategia))
                if actual_proyecto:
                    subfolders.append(str(actual_proyecto))
                if categoria:
                    subfolders.append(str(categoria))
                subfolders.extend([year, month])
                storage_filename = "/".join(subfolders + [final_filename])
        storage_path = upload_file_to_storage(file_bytes, storage_filename, content_type)

        complete_metadata = {
            **extracted_metadata,
            "file_id": file_id,
            "storage_path": storage_path,
            "media_type": content_type,
            "original_filename": file.filename,
            "upload_timestamp": datetime.utcnow().isoformat() + "Z",
            "file_hash": file_hash,
            "processing_time_estimate": f"{estimate_processing_time(len(file_bytes))} segundos",
            "public": is_public,
            "uploader_id": user_id,
            "uploader_email": user_email,
            **custom_metadata
        }
        
        # Agregar imagen de portada si se proporcionó
        if cover_image_path:
            complete_metadata["cover_image_path"] = cover_image_path
        
        # Ensure required fields exist in metadata for DocumentMetadata model
        if "apartado" not in complete_metadata:
            complete_metadata["apartado"] = ""
        if "user_role" not in complete_metadata:
            complete_metadata["user_role"] = ""
        if "estrategia" not in complete_metadata:
            complete_metadata["estrategia"] = ""
        
        # Force ID to match Firestore document id to keep a single source of truth
        # This avoids using the random UUID from the AI layer as Meilisearch primary key.
        complete_metadata["id"] = file_id

        # Guardar en Firebase con versión
        save_document_metadata(file_id, complete_metadata, file_hash, version, parent_id)

        # Guardar localmente
        _save_metadata_locally(complete_metadata, file.filename)

        # Indexar en Meilisearch usando el índice correcto
        index_name = LIBRARY_INDEX_NAME if is_public else "documents"
        indexing_success = add_documents([complete_metadata], index_name)

        # Si es nueva versión, actualizar documento principal
        if version > 1 and parent_id:
            parent_doc = get_document_by_stem(parent_id, collection_name)
            if parent_doc and indexing_success:
                from services.meilisearch_service import update_documents
                # Usar el mismo índice para actualizar el documento padre
                update_documents([parent_doc], index_name)

        # 📌 Log: subida correcta (estandarizado)
        audit_log(user_id, 'DOCUMENT_UPLOAD', _ctx(request, {
            'user_email': user_email,
            'file_id': file_id,
            'filename': file.filename,
            'public': is_public,
            'version': version,
            'parent_id': parent_id,
            'indexed': indexing_success
        }), severity="INFO")

        try:
            return DocumentMetadata(**complete_metadata)
        except Exception as e:
            # Log validation errors for debugging
            log_error(e, "DOCUMENT_METADATA_VALIDATION", user_id=user_id, additional_details=_ctx(request, {
                'user_email': user_email,
                'file_id': file_id,
                'missing_fields': str(e)
            }))
            # Return the metadata as a dict to bypass validation issues
            return complete_metadata

    except HTTPException as e:
        # Fallos esperados (validaciones, duplicado)
        audit_log(user_id, 'DOCUMENT_UPLOAD', _ctx(request, {
            'user_email': user_email,
            'filename': file.filename if file else None,
            'status': 'FAILED',
            'http_status': e.status_code,
            'detail': e.detail
        }), severity="WARNING")
        raise
    except Exception as e:
        # Error inesperado con stack trace
        log_error(e, "POST_/upload", user_id=user_id, additional_details=_ctx(request, {
            'user_email': user_email,
            'filename': file.filename if file else None
        }))
        raise HTTPException(status_code=500, detail=f"Error procesando documento: {str(e)}")


@router.get("/search")
async def search_library(
    request: Request,
    q: str = Query(...),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    token_data=Depends(verify_firebase_token)
):
    """
    Busca en la biblioteca pública (Meilisearch) y registra logs.
    """
    user_id = token_data.get("user_id", "anonymous") if token_data else "anonymous"
    user_email = token_data.get("email", "") if token_data else ""

    try:
        # Buscar en el índice de biblioteca para documentos públicos
        from services.meilisearch_service import search_documents
        results = search_documents(query=q, limit=limit, offset=offset, index_name=LIBRARY_INDEX_NAME)
        results["meilisearch_available"] = is_meilisearch_available()

        # 📌 Log estandarizado para búsquedas
        audit_log(user_id, 'DOCUMENT_SEARCH', _ctx(request, {
            'user_email': user_email,
            'query': q,
            'results_count': len(results.get('hits', [])),
            'source_engine': results.get('source', 'unknown')
        }), severity="INFO")

        return results

    except Exception as e:
        log_error(e, "GET_/search", user_id=user_id, additional_details=_ctx(request, {
            'user_email': user_email,
            'query': q
        }))
        return {
            "hits": [],
            "query": q,
            "error": str(e),
            "meilisearch_available": False,
            "source": "error"
        }


@router.get("/search-documents")
async def search_all_documents(
    request: Request,
    q: str = Query(..., description="Término de búsqueda"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    token_data=Depends(verify_firebase_token)
):
    """
    Busca en todos los documentos con filtros de rol (Meilisearch con fallback a Firestore).
    Busca en los campos: filename, title, summary, keywords.
    """
    user_id = token_data.get("user_id", "anonymous") if token_data else "anonymous"
    user_email = token_data.get("email", "") if token_data else ""

    try:
        # Extraer rol del usuario de manera similar al endpoint /list
        user_role = None
        if token_data:
            # Primero, intentar obtener desde custom_claims
            if "custom_claims" in token_data:
                claims = (token_data or {}).get("custom_claims", {}) or {}
                user_role = (
                    (token_data or {}).get("role")
                    or claims.get("puesto_trabajo")
                    or claims.get("puesto")
                    or claims.get("role")
                )
            
            # Si no se encuentra en custom_claims, buscar en Firestore
            if not user_role:
                try:
                    db = get_firestore_client()
                    uid = token_data.get("user_id")
                    if uid:
                        user_doc = db.collection("users").document(uid).get()
                        if user_doc.exists:
                            user_data = user_doc.to_dict() or {}
                            user_role = user_data.get("role")
                        else:
                            # Buscar por email como fallback
                            email = token_data.get("email")
                            if email:
                                users_query = db.collection("users").where("email", "==", email).limit(1).get()
                                for doc in users_query:
                                    user_data = doc.to_dict() or {}
                                    user_role = user_data.get("role")
                                    break
                except Exception as e:
                    print(f"Error getting user role from Firestore: {e}")
            
        if not user_role and isinstance(user_email, str):
            e = user_email.lower()
            if any(p in e for p in ["director", "ejecutiv"]):
                user_role = "DireccionEjecutiva"

        role_norm = _norm(user_role)
        # Build filters for Meilisearch - TODOS los usuarios pueden buscar
        filters: Optional[str] = None
        is_exec = role_norm == "direccionejecutiva" or (isinstance(user_email, str) and any(p in user_email.lower() for p in ["director", "ejecutiv"]))


        # Aplicar filtros según el rol
        if is_exec:
            # Dirección Ejecutiva ve todo
            filters = None
        else:
            # Otros roles ven: documentos públicos, PES 2030, y documentos de su departamento
            role_display = _role_display_from_firestore(user_role) or ""
            rd_esc = role_display.replace('"', '\\"') if isinstance(role_display, str) else ""
            parts: List[str] = [
                "public = true",
                'apartado = "PES 2030"'  # TODOS ven documentos de PES 2030
            ]
            if rd_esc:
                parts.append(f'puesto_trabajo = "{rd_esc}"')
            filters = " OR ".join(parts)

        # Buscar en Meilisearch con la query
        from services.meilisearch_service import search_documents
        results = search_documents(query=q, limit=limit, offset=offset, filters=filters)
        hits = (results or {}).get("hits", [])
        source = (results or {}).get("source", ("meilisearch" if is_meilisearch_available() else "local"))

        # Firestore fallback si Meilisearch no está disponible
        if not is_meilisearch_available() or source == "local":
            try:
                fs_hits: List[Dict[str, Any]] = []
                db = get_firestore_client()
                
                # Función para buscar en una colección específica
                def search_in_collection(collection_name: str) -> List[Dict[str, Any]]:
                    results_list = []
                    collection_ref = db.collection(collection_name)
                    
                    # Buscar en todos los documentos de la colección
                    for doc in collection_ref.limit(1000).stream():
                        doc_data = doc.to_dict() or {}
                        doc_data["id"] = doc.id
                        
                        # Aplicar filtros de búsqueda en los campos especificados
                        query_lower = q.lower()
                        search_fields = [
                            doc_data.get("filename", ""),
                            doc_data.get("title", ""),
                            doc_data.get("summary", ""),
                            doc_data.get("keywords", "")
                        ]
                        
                        # Verificar si algún campo contiene la búsqueda
                        matches_search = any(
                            query_lower in str(field).lower() 
                            for field in search_fields 
                            if field
                        )
                        
                        if matches_search:
                            # Aplicar filtros de rol
                            if is_exec:
                                results_list.append(doc_data)
                            else:
                                is_public = doc_data.get("public", False) or doc_data.get("publico", False)
                                is_pes_2030 = doc_data.get("apartado") == "PES 2030"
                                user_dept_match = False
                                
                                if role_display:
                                    doc_dept = doc_data.get("puesto_trabajo", "")
                                    user_dept_match = doc_dept == role_display
                                
                                if is_public or is_pes_2030 or user_dept_match:
                                    results_list.append(doc_data)
                    
                    return results_list

                # Buscar en ambas colecciones
                fs_hits.extend(search_in_collection("documents"))
                fs_hits.extend(search_in_collection("library"))
                
                # Aplicar paginación
                total = len(fs_hits)
                paginated_hits = fs_hits[offset:offset + limit]
                
                results = {
                    "hits": paginated_hits,
                    "estimatedTotalHits": total,
                    "query": q,
                    "limit": limit,
                    "offset": offset,
                    "source": "firestore"
                }
                
            except Exception as fs_error:
                log_error(fs_error, "GET_/search-documents", user_id=user_id, additional_details=_ctx(request, {
                    'error': str(fs_error),
                    'query': q,
                    'user_email': user_email
                }))
                results = {"hits": [], "estimatedTotalHits": 0, "query": q, "source": "error"}

        results["meilisearch_available"] = is_meilisearch_available()

        # 📌 Log estandarizado para búsquedas
        audit_log(user_id, 'DOCUMENT_SEARCH', _ctx(request, {
            'user_email': user_email,
            'query': q,
            'results_count': len(results.get('hits', [])),
            'source_engine': results.get('source', 'unknown'),
            'user_role': user_role,
            'is_executive': is_exec
        }), severity="INFO")

        return results

    except Exception as e:
        log_error(e, "GET_/search-documents", user_id=user_id, additional_details=_ctx(request, {
            'error': str(e),
            'query': q,
            'user_email': user_email
        }))
        return {
            "hits": [],
            "query": q,
            "error": str(e),
            "meilisearch_available": False,
            "source": "error"
        }


@router.get("/search-by-path")
async def search_documents_by_path(
    request: Request,
    q: str = Query(..., description="Término de búsqueda en storage_path"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    token_data=Depends(verify_firebase_token)
):
    """
    Busca documentos basado en el storage_path usando Meilisearch.
    Útil para buscar documentos dentro de una estructura de carpetas específica.
    """
    user_id = token_data.get("user_id", "anonymous") if token_data else "anonymous"
    user_email = token_data.get("email", "") if token_data else ""

    try:
        # Extraer rol del usuario
        user_role = None
        if token_data:
            # Primero, intentar obtener desde custom_claims
            if "custom_claims" in token_data:
                claims = (token_data or {}).get("custom_claims", {}) or {}
                user_role = (
                    (token_data or {}).get("role")
                    or claims.get("puesto_trabajo")
                    or claims.get("puesto")
                    or claims.get("role")
                )
            
            # Si no se encuentra en custom_claims, buscar en Firestore
            if not user_role:
                try:
                    db = get_firestore_client()
                    uid = token_data.get("user_id")
                    if uid:
                        user_doc = db.collection("users").document(uid).get()
                        if user_doc.exists:
                            user_data = user_doc.to_dict() or {}
                            user_role = user_data.get("role")
                        else:
                            # Buscar por email como fallback
                            email = token_data.get("email")
                            if email:
                                users_query = db.collection("users").where("email", "==", email).limit(1).get()
                                for doc in users_query:
                                    user_data = doc.to_dict() or {}
                                    user_role = user_data.get("role")
                                    break
                except Exception as e:
                    print(f"Error getting user role from Firestore: {e}")
            
        if not user_role and isinstance(user_email, str):
            e = user_email.lower()
            if any(p in e for p in ["director", "ejecutiv"]):
                user_role = "DireccionEjecutiva"

        role_norm = _norm(user_role)
        is_exec = role_norm == "direccionejecutiva" or (isinstance(user_email, str) and any(p in user_email.lower() for p in ["director", "ejecutiv"]))

        # Aplicar filtros según el rol
        filters: Optional[str] = None
        if is_exec:
            # Dirección Ejecutiva ve todo
            filters = None
        else:
            # Otros roles ven: documentos públicos, PES 2030, y documentos de su departamento
            role_display = _role_display_from_firestore(user_role) or ""
            rd_esc = role_display.replace('"', '\\"') if isinstance(role_display, str) else ""
            parts: List[str] = [
                "public = true",
                'apartado = "PES 2030"'  # TODOS ven documentos de PES 2030
            ]
            if rd_esc:
                parts.append(f'puesto_trabajo = "{rd_esc}"')
            filters = " OR ".join(parts)

        # Configurar opciones de búsqueda específicas para storage_path
        from services.meilisearch_service import client, check_meilisearch_health
        
        if check_meilisearch_health() and client:
            try:
                search_options = {
                    "limit": limit,
                    "offset": offset,
                    "attributesToSearchOn": ["storage_path", "filename", "title"],  # Buscar específicamente en storage_path
                }
                
                if filters:
                    search_options["filter"] = filters
                
                index = client.index("documents")
                results = index.search(q, search_options)
                results["source"] = "meilisearch"
                
            except Exception as meilisearch_error:
                print(f"Error en búsqueda Meilisearch por path: {meilisearch_error}")
                # Fallback a Firestore
                results = await _search_by_path_firestore_fallback(q, limit, offset, is_exec, role_display)
        else:
            # Fallback a Firestore
            results = await _search_by_path_firestore_fallback(q, limit, offset, is_exec, role_display)

        results["meilisearch_available"] = check_meilisearch_health()

        # Log de auditoría
        audit_log(user_id, 'DOCUMENT_SEARCH_BY_PATH', _ctx(request, {
            'user_email': user_email,
            'query': q,
            'results_count': len(results.get('hits', [])),
            'source_engine': results.get('source', 'unknown'),
            'user_role': user_role,
            'is_executive': is_exec
        }), severity="INFO")

        return results

    except Exception as e:
        log_error(e, "GET_/search-by-path", user_id=user_id, additional_details=_ctx(request, {
            'error': str(e),
            'query': q,
            'user_email': user_email
        }))
        return {
            "hits": [],
            "query": q,
            "error": str(e),
            "meilisearch_available": False,
            "source": "error"
        }


async def _search_by_path_firestore_fallback(
    query: str, 
    limit: int, 
    offset: int, 
    is_exec: bool, 
    role_display: str
) -> Dict[str, Any]:
    """
    Fallback de búsqueda por storage_path usando Firestore
    """
    try:
        from services.firebase_service import get_firestore_client
        
        fs_hits: List[Dict[str, Any]] = []
        db = get_firestore_client()
        
        # Función para buscar en una colección específica
        def search_in_collection(collection_name: str) -> List[Dict[str, Any]]:
            results_list = []
            collection_ref = db.collection(collection_name)
            
            # Buscar en todos los documentos de la colección
            for doc in collection_ref.limit(1000).stream():
                doc_data = doc.to_dict() or {}
                doc_data["id"] = doc.id
                
                # Buscar en storage_path
                query_lower = query.lower()
                storage_path = doc_data.get("storage_path", "").lower()
                filename = doc_data.get("filename", "").lower()
                title = doc_data.get("title", "").lower()
                
                # Verificar si algún campo contiene la búsqueda
                matches_search = (
                    query_lower in storage_path or
                    query_lower in filename or
                    query_lower in title
                )
                
                if matches_search:
                    # Aplicar filtros de rol
                    if is_exec:
                        results_list.append(doc_data)
                    else:
                        is_public = doc_data.get("public", False) or doc_data.get("publico", False)
                        is_pes_2030 = doc_data.get("apartado") == "PES 2030"
                        user_dept_match = False
                        
                        if role_display:
                            doc_dept = doc_data.get("puesto_trabajo", "")
                            user_dept_match = doc_dept == role_display
                        
                        if is_public or is_pes_2030 or user_dept_match:
                            results_list.append(doc_data)
            
            return results_list

        # Buscar en ambas colecciones
        fs_hits.extend(search_in_collection("documents"))
        fs_hits.extend(search_in_collection("library"))
        
        # Aplicar paginación
        total = len(fs_hits)
        paginated_hits = fs_hits[offset:offset + limit]
        
        return {
            "hits": paginated_hits,
            "estimatedTotalHits": total,
            "query": query,
            "limit": limit,
            "offset": offset,
            "source": "firestore"
        }
        
    except Exception as fs_error:
        print(f"Error en fallback de búsqueda por path: {fs_error}")
        return {"hits": [], "estimatedTotalHits": 0, "query": query, "source": "error"}


@router.get("/public")
async def get_public_documents(
    request: Request,
    q: str = Query("", description="Término de búsqueda opcional"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    token_data=Depends(verify_firebase_token)
) -> Dict[str, Any]:
    """
    Obtiene documentos públicos con fallback automático.
    """
    user_id = token_data.get("user_id", "anonymous") if token_data else "anonymous"
    user_email = token_data.get("email", "") if token_data else ""

    try:
        # Buscar en el índice de biblioteca para documentos públicos
        results = search_documents(query=q.strip() if q else "", limit=limit, offset=offset, index_name=LIBRARY_INDEX_NAME)

        # Loguea siempre para auditoría (aunque 0 resultados)
        audit_log(user_id, 'CUSTOM_PUBLIC_LIST', _ctx(request, {
            'user_email': user_email,
            'query': q,
            'results_count': len(results.get('hits', [])),
            'source_engine': results.get('source', 'unknown')
        }), severity="INFO")

        return results

    except Exception as e:
        log_error(e, "GET_/public", user_id=user_id, additional_details=_ctx(request, {
            'user_email': user_email,
            'query': q
        }))
        return {
            "hits": [],
            "query": q,
            "processingTimeMs": 0,
            "limit": limit,
            "offset": offset,
            "estimatedTotalHits": 0,
            "source": "error",
            "error": str(e)
        }


@router.get("/public-local")
async def get_public_documents_local(
    request: Request,
    q: str = Query(""),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    token_data=Depends(verify_firebase_token)
) -> Dict[str, Any]:
    user_id = token_data.get("user_id", "anonymous") if token_data else "anonymous"
    user_email = token_data.get("email", "") if token_data else ""

    try:
        json_files = list(LOCAL_METADATA_DIR.glob("*.json"))
        documents = []

        for json_path in json_files:
            try:
                with open(json_path, "r", encoding="utf-8") as file:
                    metadata = json.load(file)
                    if metadata.get("public") is True:
                        documents.append(metadata)
            except Exception:
                continue

        if q:
            q_lower = q.lower()
            documents = [
                doc for doc in documents if (
                    q_lower in str(doc.get("title", "")).lower() or
                    q_lower in str(doc.get("summary", "")).lower() or
                    any(q_lower in str(kw).lower() for kw in doc.get("keywords", []))
                )
            ]

        documents.sort(key=lambda x: x.get("upload_timestamp", ""), reverse=True)

        total = len(documents)
        paginated_docs = documents[offset:offset + limit]

        audit_log(user_id, 'CUSTOM_LOCAL_PUBLIC_SEARCH', _ctx(request, {
            'user_email': user_email,
            'query': q,
            'results_count': total,
            'limit': limit,
            'offset': offset,
            'source_engine': 'local_files'
        }), severity="INFO")

        return {
            "hits": paginated_docs,
            "query": q,
            "processingTimeMs": 0,
            "limit": limit,
            "offset": offset,
            "estimatedTotalHits": total,
            "source": "local_files"
        }

    except Exception as e:
        log_error(e, "GET_/public-local", user_id=user_id, additional_details=_ctx(request, {
            'user_email': user_email,
            'query': q
        }))
        raise HTTPException(status_code=500, detail=f"Error en búsqueda local: {str(e)}")


@router.get("/versions/{file_stem}")
async def get_document_versions(
    request: Request,
    file_stem: str,
    token_data=Depends(verify_firebase_token)
):
    user_id = token_data.get("user_id", "anonymous") if token_data else "anonymous"
    user_email = token_data.get("email", "") if token_data else ""

    try:
        base_document = get_document_by_stem(file_stem)
        if not base_document:
            raise HTTPException(status_code=404, detail="Documento no encontrado")

        versions = [base_document]
        version_ids = base_document.get("versions", [])
        for version_id in version_ids:
            version_doc = get_document_by_stem(version_id)
            if version_doc:
                versions.append(version_doc)

        versions.sort(key=lambda x: x.get("version", 1))

        audit_log(user_id, 'CUSTOM_DOCUMENT_VERSIONS_VIEWED', _ctx(request, {
            'user_email': user_email,
            'file_stem': file_stem,
            'total_versions': len(versions)
        }), severity="INFO")

        return {
            "document_id": file_stem,
            "total_versions": len(versions),
            "versions": versions
        }
    except HTTPException as e:
        audit_log(user_id, 'CUSTOM_DOCUMENT_VERSIONS_VIEWED', _ctx(request, {
            'user_email': user_email,
            'file_stem': file_stem,
            'status': 'FAILED',
            'http_status': e.status_code,
            'detail': e.detail
        }), severity="WARNING")
        raise
    except Exception as e:
        log_error(e, "GET_/versions/{file_stem}", user_id=user_id, additional_details=_ctx(request, {
            'user_email': user_email,
            'file_stem': file_stem
        }))
        raise HTTPException(status_code=500, detail=f"Error obteniendo versiones: {str(e)}")


@router.get("/download/{file_stem}")
async def download_document(
    request: Request,
    file_stem: str,
    token_data=Depends(verify_firebase_token)
):
    user_id = token_data.get("user_id", "anonymous") if token_data else "anonymous"
    user_email = token_data.get("email", "") if token_data else ""

    try:
        metadata_path = LOCAL_METADATA_DIR / f"{file_stem}.json"
        if not metadata_path.exists():
            raise HTTPException(status_code=404, detail="Documento no encontrado")

        with open(metadata_path, "r", encoding="utf-8") as file:
            metadata = json.load(file)

        file_bytes = download_file_from_storage(metadata["storage_path"])
        filename = metadata.get("original_filename", f"{file_stem}.bin")
        content_type = metadata.get("media_type", "application/octet-stream")

        audit_log(user_id, 'DOCUMENT_DOWNLOAD', _ctx(request, {
            'user_email': user_email,
            'file_stem': file_stem,
            'filename': filename
        }), severity="INFO")

        return StreamingResponse(
            iter([file_bytes]),
            media_type=content_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except HTTPException as e:
        audit_log(user_id, 'DOCUMENT_DOWNLOAD', _ctx(request, {
            'user_email': user_email,
            'file_stem': file_stem,
            'status': 'FAILED',
            'http_status': e.status_code,
            'detail': e.detail
        }), severity="WARNING")
        raise
    except Exception as e:
        log_error(e, "GET_/download/{file_stem}", user_id=user_id, additional_details=_ctx(request, {
            'user_email': user_email,
            'file_stem': file_stem
        }))
        raise HTTPException(status_code=500, detail=f"Error descargando documento: {str(e)}")


@router.get("/download_by_path")
async def download_by_storage_path(
    request: Request,
    path: str = Query(...),
    token_data=Depends(verify_firebase_token)
):
    user_id = token_data.get("user_id", "anonymous") if token_data else "anonymous"
    user_email = token_data.get("email", "") if token_data else ""

    try:
        if not path.strip():
            raise HTTPException(status_code=400, detail="Ruta no puede estar vacía")

        if ".." in path or path.startswith("/"):
            raise HTTPException(status_code=400, detail="Ruta inválida")

        file_bytes = download_file_from_storage(path)
        filename = Path(path).name
        content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"

        audit_log(user_id, 'DOCUMENT_DOWNLOAD', _ctx(request, {
            'user_email': user_email,
            'path': path,
            'filename': filename,
            'by': 'path'
        }), severity="INFO")

        return StreamingResponse(
            iter([file_bytes]),
            media_type=content_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    except FileNotFoundError as e:
        audit_log(user_id, 'DOCUMENT_DOWNLOAD', _ctx(request, {
            'user_email': user_email,
            'path': path,
            'status': 'FAILED',
            'error': 'FileNotFoundError'
        }), severity="WARNING")
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    except Exception as e:
        log_error(e, "GET_/download_by_path", user_id=user_id, additional_details=_ctx(request, {
            'user_email': user_email,
            'path': path
        }))
        raise HTTPException(status_code=500, detail=f"Error descargando archivo: {str(e)}")


@router.delete("/delete_by_path")
async def delete_document_by_path(
    request: Request,
    path: str = Query(...),
    token_data=Depends(verify_firebase_token)
):
    user_id = token_data.get("user_id", "anonymous") if token_data else "anonymous"
    user_email = token_data.get("email", "") if token_data else ""

    try:
        from services.firebase_service import delete_file_from_storage, get_documents_by_storage_path, delete_document_from_firestore
        from services.meilisearch_service import delete_document

        # Paso 1: Buscar documentos en Firestore relacionados con esta ruta de almacenamiento
        firestore_docs = get_documents_by_storage_path(path)
        firestore_doc_ids = [doc.get("id") for doc in firestore_docs if "id" in doc]
        firestore_file_ids = [doc.get("file_id") for doc in firestore_docs if "file_id" in doc]
        
        # Combinar IDs (pueden ser diferentes o iguales)
        all_doc_ids = list(set(firestore_doc_ids + firestore_file_ids))
        
        # Crear un diccionario para almacenar resultados de la eliminación
        delete_results = {
            "storage_deleted": False,
            "firestore_deleted": [],
            "meilisearch_deleted": []
        }
        
        # Paso 2: Intentar eliminar el archivo de Storage (incluso si falla, continuar con los otros pasos)
        try:
            delete_file_from_storage(path)
            delete_results["storage_deleted"] = True
        except FileNotFoundError:
            # Continuamos con los otros pasos aunque el archivo no exista en Storage
            pass
        except Exception as storage_error:
            # Continuamos con los otros pasos aunque haya un error en Storage
            pass
        
        # Paso 3: Eliminar documentos de Firestore
        for doc_id in all_doc_ids:
            try:
                if delete_document_from_firestore(doc_id):
                    delete_results["firestore_deleted"].append(doc_id)
            except Exception as firestore_error:
                # Continuamos con otros documentos
                pass
        
        # Paso 4: Eliminar documentos de Meilisearch
        for doc_id in all_doc_ids:
            try:
                if delete_document(doc_id):
                    delete_results["meilisearch_deleted"].append(doc_id)
            except Exception as meilisearch_error:
                # Continuamos con otros documentos
                pass

        # Registrar en el log los resultados de la eliminación
        audit_log(user_id, 'CUSTOM_DOCUMENT_DELETE', _ctx(request, {
            'user_email': user_email,
            'path': path,
            'filename': Path(path).name,
            'delete_results': delete_results
        }), severity="WARNING")

        # Si no se eliminó de ningún sistema, considerar un error
        if not delete_results["storage_deleted"] and not delete_results["firestore_deleted"] and not delete_results["meilisearch_deleted"]:
            raise HTTPException(status_code=404, detail="No se encontró el documento en ningún sistema")

        return {
            "message": "Archivo eliminado exitosamente", 
            "path": path,
            "delete_results": delete_results
        }

    except HTTPException:
        # Re-lanzar excepciones HTTP
        raise
    except Exception as e:
        log_error(e, "DELETE_/delete_by_path", user_id=user_id, additional_details=_ctx(request, {
            'user_email': user_email,
            'path': path
        }))
        raise HTTPException(status_code=500, detail=f"Error eliminando archivo: {str(e)}")


@router.put("/toggle-public")
async def toggle_document_public_status(
    request: Request,
    path: str = Query(..., description="Storage path del documento a modificar"),
    token_data=Depends(verify_firebase_token)
):
    """
    Cambia el estado de 'public' de true a false en un documento, tanto en Firestore como en Meilisearch.
    No elimina el documento ni lo mueve de colección, solo actualiza el metadato 'public'.
    """
    user_id = token_data.get("user_id", "anonymous") if token_data else "anonymous"
    user_email = token_data.get("email", "") if token_data else ""

    try:
        from services.firebase_service import get_documents_by_storage_path, get_firestore_client
        from services.meilisearch_service import update_documents, client, check_meilisearch_health

        # Paso 1: Buscar documentos en Firestore relacionados con esta ruta de almacenamiento
        print(f"Buscando documentos con storage_path: '{path}'")
        
        # Intentar diferentes variantes de la ruta
        firestore_docs = get_documents_by_storage_path(path)
        
        # Si no encontró, intentar con una versión codificada/decodificada
        if not firestore_docs:
            try:
                from urllib.parse import unquote
                decoded_path = unquote(path)
                if decoded_path != path:
                    print(f"Intentando con ruta decodificada: '{decoded_path}'")
                    firestore_docs = get_documents_by_storage_path(decoded_path)
            except Exception as e:
                print(f"Error al intentar decodificar ruta: {e}")
        
        if not firestore_docs:
            print(f"ERROR: No se encontró ningún documento con storage_path: '{path}'")
            raise HTTPException(status_code=404, detail=f"Documento no encontrado con ruta: {path}")
        
        # Crear un diccionario para almacenar resultados de la actualización
        update_results = {
            "firestore_updated": [],
            "meilisearch_updated": []
        }
        
        # Paso 2: Actualizar en Firestore
        db = get_firestore_client()
        for doc in firestore_docs:
            doc_id = doc.get("id") or doc.get("file_id")
            if not doc_id:
                continue
                
            try:
                # Obtener el valor actual de public y cambiarlo al opuesto (toggle)
                current_public = doc.get("public", True)
                new_public = not bool(current_public)
                
                # Determinar en qué colección está el documento actualmente
                collection_name = "library"  # Asumimos que está en library por defecto
                
                # Verificar si el documento existe en la colección library
                doc_ref_library = db.collection("library").document(doc_id)
                if not doc_ref_library.get().exists:
                    # Si no existe en library, verificar si está en documents
                    doc_ref_documents = db.collection("documents").document(doc_id)
                    if doc_ref_documents.get().exists:
                        collection_name = "documents"
                    else:
                        # El documento no existe en ninguna colección conocida
                        log_error(Exception(f"Documento no encontrado en ninguna colección: {doc_id}"), 
                                "DOCUMENT_TOGGLE_PUBLIC", user_id=user_id, 
                                additional_details={"path": path, "doc_id": doc_id})
                        continue
                
                # Actualizar en la colección correcta
                doc_ref = db.collection(collection_name).document(doc_id)
                doc_ref.update({"public": new_public})
                
                # Actualizar el documento local para Meilisearch
                doc["public"] = new_public
                update_results["firestore_updated"].append(doc_id)
                
                # Guardar metadata localmente si existe
                try:
                    json_filename = f"{doc_id}.json"
                    json_path = LOCAL_METADATA_DIR / json_filename
                    if json_path.exists():
                        with open(json_path, "r", encoding="utf-8") as file:
                            metadata = json.load(file)
                            metadata["public"] = new_public
                        with open(json_path, "w", encoding="utf-8") as file:
                            json.dump(metadata, file, ensure_ascii=False, indent=2)
                except Exception as e:
                    log_error(e, "LOCAL_METADATA_UPDATE", user_id=user_id, 
                              additional_details={"path": path, "doc_id": doc_id})
                
            except Exception as firestore_error:
                log_error(firestore_error, "FIRESTORE_UPDATE", user_id=user_id, 
                         additional_details={"path": path, "doc_id": doc_id if 'doc_id' in locals() else None})
                continue
        
        # Paso 3: Actualizar en Meilisearch
        if check_meilisearch_health() and client:
            try:
                # Preparar documentos para actualizar en Meilisearch (payload mínimo)
                docs_to_update = []
                for doc in firestore_docs:
                    doc_id = doc.get("id") or doc.get("file_id")
                    if doc_id:
                        # Use the per-document public value which was updated above
                        docs_to_update.append({
                            "file_id": doc_id,
                            "public": doc.get("public", False)
                        })

                if docs_to_update:
                    # Actualizar en ambos índices: 'documents' y 'library'
                    indexes_to_update = ["documents", LIBRARY_INDEX_NAME]
                    from services.meilisearch_service import sanitize_document_id, get_task_details

                    for index_name in indexes_to_update:
                        try:
                            # Use the service wrapper which handles primary key sanitization and task response
                            success = update_documents(docs_to_update, index_name=index_name)
                            if success:
                                update_results["meilisearch_updated"].extend([d.get("file_id") or d.get("id") for d in docs_to_update])
                                continue

                            # Si el wrapper falló, intentar actualización directa en MeiliCloud
                            try:
                                index = client.index(index_name)
                                # Prepare payload with sanitized 'id'
                                direct_payload = []
                                for d in docs_to_update:
                                    fid = d.get("file_id") or d.get("id")
                                    if not fid:
                                        continue
                                    direct_payload.append({
                                        "id": sanitize_document_id(fid),
                                        "public": d.get("public")
                                    })
                                if direct_payload:
                                    task = index.update_documents(direct_payload, primary_key="id")
                                    task_uid, task_status = get_task_details(task)
                                    if task_uid and task_status:
                                        # If task_status object has `status`, consider enqueued/processing/succeeded as success
                                        if hasattr(task_status, 'status') and task_status.status in ["enqueued", "processing", "succeeded"]:
                                            update_results["meilisearch_updated"].extend([p.get("id") for p in direct_payload])
                                        elif isinstance(task_status, dict) and task_status.get("status") in ["enqueued", "processing", "succeeded"]:
                                            update_results["meilisearch_updated"].extend([p.get("id") for p in direct_payload])
                                    else:
                                        # As a last resort, assume update submitted
                                        update_results["meilisearch_updated"].extend([p.get("id") for p in direct_payload])
                            except Exception as direct_err:
                                log_error(direct_err, f"MEILISEARCH_DIRECT_UPDATE_{index_name}", user_id=user_id,
                                         additional_details={"path": path})
                        except Exception as idx_error:
                            log_error(idx_error, f"MEILISEARCH_UPDATE_{index_name}", user_id=user_id,
                                     additional_details={"path": path})
            except Exception as meilisearch_error:
                log_error(meilisearch_error, "MEILISEARCH_UPDATE", user_id=user_id,
                         additional_details={"path": path})
        
        # Registrar en el log los resultados
        # Determine an example new_public_state for logging (first updated doc) or None
        new_state_for_log = None
        if docs_to_update and len(docs_to_update) > 0:
            new_state_for_log = docs_to_update[0].get("public")

        audit_log(user_id, 'DOCUMENT_TOGGLE_PUBLIC', _ctx(request, {
            'user_email': user_email,
            'path': path,
            'filename': Path(path).name,
            'new_public_state': new_state_for_log,
            'update_results': update_results
        }), severity="INFO")
        
        # Si no se actualizó en ningún sistema, considerar un error
        if not update_results["firestore_updated"] and not update_results["meilisearch_updated"]:
            raise HTTPException(status_code=500, detail="No se pudo actualizar el documento en ningún sistema")
        
        return {
            "message": "Estado público del documento actualizado correctamente", 
            "path": path,
            "public": False,
            "update_results": update_results
        }
        
    except HTTPException:
        # Re-lanzar excepciones HTTP
        raise
    except Exception as e:
        log_error(e, "PUT_/toggle-public", user_id=user_id, additional_details=_ctx(request, {
            'user_email': user_email,
            'path': path
        }))
        raise HTTPException(status_code=500, detail=f"Error actualizando estado público del documento: {str(e)}")


@router.get("/list")
async def list_all_documents(
    request: Request,
    public_only: bool = Query(False),
    token_data=Depends(verify_firebase_token)
):
    user_id = token_data.get("user_id", "anonymous") if token_data else "anonymous"
    user_email = token_data.get("email", "") if token_data else ""

    try:
        # Normalize helpers
        def _norm(text: Optional[str]) -> str:
            import unicodedata
            if not isinstance(text, str):
                return ""
            t = unicodedata.normalize("NFD", text)
            t = t.encode("ascii", "ignore").decode("utf-8").lower()
            for ch in [" ", "_", "-", "/", "."]:
                t = t.replace(ch, "")
            return t.strip()

        def _role_display_from_firestore(role_value: Optional[str]) -> Optional[str]:
            """Map Firestore 'role' to human-friendly puesto_trabajo used in docs."""
            if not role_value:
                return None
            mapping = {
                "DireccionEjecutiva": "Dirección Ejecutiva",
                "CoordinacionAdministrativa": "Coordinación Administrativa",
                "CoordinadorAdministrativa": "Coordinación Administrativa",
                "CoordinacionProyectosyPlanificacion": "Coordinación Proyectos y Planificación",
                "CoordinacionProyectosPlanificacion": "Coordinación Proyectos y Planificación",
                "CoordinacionComunicaciones": "Coordinación de Comunicaciones",
                "AsistenciaGeneral": "Asistencia General",
            }
            if role_value in mapping:
                return mapping[role_value]
            rn = _norm(role_value)
            for k, v in mapping.items():
                if _norm(k) == rn:
                    return v
            return role_value
        
        # Resolve user role from Firestore
        user_role: Optional[str] = None
        try:
            db = get_firestore_client()
            if user_id and user_id != "anonymous":
                doc = db.collection("users").document(user_id).get()
                if doc.exists:
                    d = doc.to_dict() or {}
                    # Prefer canonical 'role' stored in Firestore as per requirements
                    user_role = d.get("role") or d.get("puesto_trabajo") or d.get("puesto")
                else:
                    # Fallback: search by email
                    user_email = (token_data or {}).get("email")
                    if user_email:
                        users_query = db.collection("users").where("email", "==", user_email).limit(1).stream()
                        
                        for user_doc in users_query:
                            user_data = user_doc.to_dict() or {}
                            user_role = user_data.get("role") or user_data.get("puesto_trabajo") or user_data.get("puesto")
                            break
        except Exception as e:
            pass

        # Fallbacks
        if not user_role:
            claims = (token_data or {}).get("custom_claims", {}) or {}
            user_role = (
                (token_data or {}).get("role")
                or claims.get("puesto_trabajo")
                or claims.get("puesto")
                or claims.get("role")
            )
            
        if not user_role and isinstance(user_email, str):
            e = user_email.lower()
            if any(p in e for p in ["director", "ejecutiv"]):
                user_role = "Dirección Ejecutiva"

        role_norm = _norm(user_role)

        # Build filters for Meilisearch
        filters: Optional[str] = None
        is_exec = role_norm == "direccionejecutiva" or (isinstance(user_email, str) and any(p in user_email.lower() for p in ["director", "ejecutiv"]))

        if public_only:
            filters = "public = true"
        else:
            if not is_exec:
                role_display = _role_display_from_firestore(user_role) or ""
                rd_esc = role_display.replace('"', '\\"') if isinstance(role_display, str) else ""
                parts: List[str] = [
                    "public = true",
                    'apartado = "PES 2030"'  # TODOS ven documentos de PES 2030
                ]
                if rd_esc:
                    parts.append(f'puesto_trabajo = "{rd_esc}"')
                filters = " OR ".join(parts)
            else:
                filters = None

        # Query Meilisearch (empty query -> list)
        ms = search_documents(query="", limit=1000, offset=0, filters=filters)
        hits = (ms or {}).get("hits", [])
        source = (ms or {}).get("source", ("meilisearch" if is_meilisearch_available() else "local"))

        # Firestore fallback if Meilisearch unavailable
        if not is_meilisearch_available():
            try:
                fs_hits: List[Dict[str, Any]] = []
                db = get_firestore_client()
                
                # Buscar en ambas colecciones
                # Documentos públicos de la biblioteca
                library_qref = db.collection("library")
                for d in library_qref.limit(1000).stream():
                    data = d.to_dict() or {}
                    data["id"] = d.id
                    fs_hits.append(data)
                
                # Documentos privados (solo si no es public_only)
                if not public_only:
                    docs_qref = db.collection("documents")
                    for d in docs_qref.limit(1000).stream():
                        data = d.to_dict() or {}
                        data["id"] = d.id
                        fs_hits.append(data)

                # Apply same logic client-side
                if public_only:
                    # Los documentos de library ya son públicos, 
                    # pero también verificar el flag public por compatibilidad
                    hits = [x for x in fs_hits if x.get("public") is True]
                else:
                    if not is_exec:
                        role_display = _role_display_from_firestore(user_role) or ""
                        rn_disp = _norm(role_display)

                        def _match(doc: Dict[str, Any]) -> bool:
                            # Los documentos de library son siempre visibles (públicos)
                            if doc.get("public") is True:
                                return True
                            # TODOS ven documentos de PES 2030
                            if doc.get("apartado") == "PES 2030":
                                return True
                            pt = _norm(doc.get("puesto_trabajo") or "")
                            return pt and pt == rn_disp

                        hits = [x for x in fs_hits if _match(x)]
                    else:
                        hits = fs_hits
                source = "firestore"
            except Exception as e:
                hits = []
                source = "error"

        # Normalize fields for frontend table
        def map_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
            # Derive filename/path safely
            storage_path = doc.get("storage_path") or doc.get("path") or ""
            name_from_path = Path(storage_path).name if storage_path else ""
            filename = doc.get("filename") or name_from_path or doc.get("original_filename") or doc.get("title") or ""
            # Sizes and dates
            size = doc.get("file_size_bytes") or doc.get("size") or 0
            updated = doc.get("updated_at") or doc.get("created_at") or doc.get("date") or doc.get("upload_timestamp")
            return {
                "id": doc.get("id") or doc.get("file_id") or (Path(filename).stem if filename else str(uuid.uuid4())),
                "filename": filename,
                "size": size,
                "updated": updated,
                "path": storage_path,
                "content_type": doc.get("media_type") or doc.get("content_type") or "application/octet-stream",
                "categoria": doc.get("categoria") or doc.get("apartado"),
                "public": doc.get("public") or doc.get("publico") or False,
                "puesto_trabajo": doc.get("puesto_trabajo") or doc.get("user_role"),
                "tipo": doc.get("tipo") or doc.get("tipo_documento"),
                "storage_path": storage_path,
            }

        files = [map_doc(d) for d in hits]

        audit_log(user_id, 'DOCUMENTS_LISTED', _ctx(request, {
            'user_email': user_email,
            'count': len(files),
            'public_only': public_only,
            'role': user_role,
            'source': source
        }), severity="INFO")

        # Return the response without validation since the DocumentListResponse schema has issues
        return {"files": files, "count": len(files), "source": source}

    except Exception as e:
        log_error(e, "GET_/list", user_id=user_id, additional_details=_ctx(request, {
            'user_email': user_email,
            'public_only': public_only
        }))
        raise HTTPException(status_code=500, detail=f"Error listando documentos: {str(e)}")


@router.get("/storage")
async def list_storage_files(
    request: Request,
    prefix: str = Query(default=""),
    token_data=Depends(verify_firebase_token)
):
    user_id = token_data.get("user_id", "anonymous") if token_data else "anonymous"
    user_email = token_data.get("email", "") if token_data else ""

    try:
        storage_files = list_files_in_storage(prefix)

        for file in storage_files:
            file_extension = Path(file["filename"]).suffix.lower()

            if "pdf" in file_extension:
                file["tipo"] = "PDF"
            elif file_extension in [".doc", ".docx"]:
                file["tipo"] = "Word"
            elif file_extension in [".xls", ".xlsx"]:
                file["tipo"] = "Excel"
            elif file_extension in [".ppt", ".pptx"]:
                file["tipo"] = "PowerPoint"
            else:
                file["tipo"] = "Documento"

            file["public"] = False
            try:
                file_id = Path(file["filename"]).stem
                metadata_path = LOCAL_METADATA_DIR / f"{file_id}.json"
                if metadata_path.exists():
                    with open(metadata_path, "r", encoding="utf-8") as f:
                        metadata = json.load(f)
                        file["public"] = metadata.get("public", False)
                        file["apartado"] = metadata.get("apartado", "")
                        file["title"] = metadata.get("title", file["filename"])
                        file["summary"] = metadata.get("summary", "")
            except Exception:
                pass

        audit_log(user_id, 'CUSTOM_STORAGE_LIST', _ctx(request, {
            'user_email': user_email,
            'prefix': prefix,
            'files_count': len(storage_files)
        }), severity="INFO")

        return {"files": storage_files}

    except Exception as e:
        log_error(e, "GET_/storage", user_id=user_id, additional_details=_ctx(request, {
            'user_email': user_email,
            'prefix': prefix
        }))
        raise HTTPException(status_code=500, detail=f"Error explorando storage: {str(e)}")


@router.get("/{document_id}/versions")
async def get_document_versions_endpoint(document_id: str):
    # (Sin auth ni request aquí; si quieres auditar, cambia firma e integra _ctx + audit_log)
    try:
        versions = get_document_by_filename(document_id)

        if not versions:
            raise HTTPException(status_code=404, detail="Documento no encontrado")

        return {"file_id": document_id, "versions": versions}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo versiones: {str(e)}")


@router.get("/stats")
async def get_documents_statistics(
    request: Request,
    token_data=Depends(verify_firebase_token)
):
    user_id = token_data.get("user_id", "anonymous") if token_data else "anonymous"
    user_email = token_data.get("email", "") if token_data else ""

    try:
        total_documents = 0
        total_size = 0
        file_types = {}
        public_count = 0

        if LOCAL_METADATA_DIR.exists():
            for json_file in LOCAL_METADATA_DIR.glob("*.json"):
                try:
                    with open(json_file, "r", encoding="utf-8") as file:
                        metadata = json.load(file)
                        total_documents += 1
                        total_size += metadata.get("file_size_bytes", 0)

                        file_ext = metadata.get("file_extension", "unknown")
                        file_types[file_ext] = file_types.get(file_ext, 0) + 1

                        if metadata.get("public", False):
                            public_count += 1

                except Exception:
                    continue

        stats = {
            "total_documents": total_documents,
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "file_types": file_types,
            "public_documents": public_count,
            "private_documents": total_documents - public_count,
            "average_size_mb": round((total_size / total_documents) / (1024 * 1024), 2) if total_documents > 0 else 0,
            "last_updated": datetime.utcnow().isoformat() + "Z"
        }

        # 📌 Log de consulta de estadísticas
        audit_log(user_id, 'CUSTOM_DOCUMENT_STATS_VIEWED', _ctx(request, {
            'user_email': user_email,
            'summary': {
                'total_documents': total_documents,
                'public_documents': public_count,
                'private_documents': total_documents - public_count
            }
        }), severity="INFO")

        return stats

    except Exception as e:
        log_error(e, "GET_/stats", user_id=user_id, additional_details=_ctx(request, {
            'user_email': user_email
        }))
        raise HTTPException(status_code=500, detail=f"Error obteniendo estadísticas: {str(e)}")


@router.get("/info")
async def get_document_info(
    request: Request,
    storage_path: str = Query(None),
    path: str = Query(None),
    file_id: str = Query(None),
    token_data=Depends(verify_firebase_token)
):
    """
    Obtiene información detallada de un documento desde Meilisearch con fallback a Firestore.
    Esta ruta se usa para el botón de ojo en la interfaz que muestra detalles del documento.
    """
    user_id = token_data.get("user_id", "anonymous") if token_data else "anonymous"
    user_email = token_data.get("email", "") if token_data else ""
    
    try:
        # Unificar los posibles identificadores
        effective_path = storage_path or path
        if not effective_path and not file_id:
            raise HTTPException(status_code=400, detail="Se requiere storage_path, path o file_id")
            
        # Añadir logs para depuración
        print(f"GET /info buscando documento:")
        print(f"- storage_path: {storage_path}")
        print(f"- path: {path}")
        print(f"- file_id: {file_id}")
        print(f"- effective_path: {effective_path}")
        
        # Si tenemos una ruta efectiva, intentar decodificarla por si está codificada en URL
        if effective_path:
            try:
                from urllib.parse import unquote
                decoded_path = unquote(effective_path)
                if decoded_path != effective_path:
                    print(f"- decoded_path: {decoded_path}")
                    # Usar la versión decodificada si es diferente
                    effective_path = decoded_path
            except Exception as e:
                print(f"Error al decodificar ruta: {e}")
        
        document_data = None
        source = "unknown"
        
        # PRIMERA FUENTE: Meilisearch
        if is_meilisearch_available():
            try:
                # Intentar buscar por términos en lugar de filtros, ya que id no es filtrable
                if file_id:
                    # Buscar directamente por el file_id como término de búsqueda
                    ms_result = search_documents(query=file_id, limit=1, filters=None)
                    hits = ms_result.get("hits", [])
                    # Verificar si alguno de los resultados coincide exactamente con el ID
                    for hit in hits:
                        if hit.get("id") == file_id or hit.get("file_id") == file_id:
                            document_data = hit
                            source = "meilisearch"
                            break
                
                # Si no encontramos por ID o si tenemos path, buscar por path
                if not document_data and effective_path:
                    # Primero intentar con filtros para campos que sabemos que son filtrables
                    filterable_fields = ["storage_path", "path"]
                    for field in filterable_fields:
                        try:
                            filter_expr = f'{field} = "{effective_path}"'
                            ms_result = search_documents(query="", limit=1, filters=filter_expr)
                            hits = ms_result.get("hits", [])
                            if hits and len(hits) > 0:
                                document_data = hits[0]
                                source = "meilisearch"
                                break
                        except Exception:
                            # Ignorar error si este campo no es filtrable
                            continue
                    
                    # Si aún no encontramos, intentar buscar por la última parte del path
                    if not document_data:
                        filename = Path(effective_path).name
                        ms_result = search_documents(query=filename, limit=10, filters=None)
                        hits = ms_result.get("hits", [])
                        # Buscar coincidencia exacta de path
                        for hit in hits:
                            if (hit.get("storage_path") == effective_path or 
                                hit.get("path") == effective_path):
                                document_data = hit
                                source = "meilisearch"
                                break
            except Exception as e:
                log_error(e, "Meilisearch lookup failed", user_id=user_id, additional_details=_ctx(request, {
                    'path': effective_path,
                    'file_id': file_id
                }))
        
        # SEGUNDA FUENTE: Firestore usando storage_path o path
        if not document_data and effective_path:
            try:
                from services.firebase_service import get_documents_by_storage_path
                
                # Intentar buscar por la ruta exacta usando la función mejorada
                firestore_docs = get_documents_by_storage_path(effective_path)
                
                if firestore_docs and len(firestore_docs) > 0:
                    document_data = firestore_docs[0]
                    source = "firestore_path"
                    print(f"Documento encontrado por storage_path/path: {document_data.get('id')}")
            except Exception as e:
                print(f"Error buscando por storage_path: {str(e)}")
                pass
        
        # TERCERA FUENTE: Firestore usando file_id o stem
        if not document_data:
            try:
                from services.firebase_service import get_document_by_stem
                
                # Primero intentar con file_id si existe
                if file_id:
                    firestore_doc = get_document_by_stem(file_id)
                    if firestore_doc:
                        document_data = firestore_doc
                        source = "firestore_id"
                        print(f"Documento encontrado por file_id: {file_id}")
                
                # Si no se encontró y tenemos storage_path, intentar por el nombre del archivo
                if not document_data and effective_path:
                    # Extraer el nombre base (stem) del archivo desde la ruta
                    path_stem = Path(effective_path).stem
                    firestore_doc = get_document_by_stem(path_stem)
                    
                    if firestore_doc:
                        document_data = firestore_doc
                        source = "firestore_stem"
                        print(f"Documento encontrado por stem: {path_stem}")
            except Exception as e:
                print(f"Error buscando por stem: {str(e)}")
                pass
        
        # TERCERA FUENTE: Buscar usando el endpoint search con el nombre (sin extensión)
        if not document_data:
            try:
                filename = file_id or Path(storage_path).stem if storage_path else ""
                if filename:
                    # Quitamos la extensión si la tiene
                    stem = Path(filename).stem
                    # Usar el mismo mecanismo que el endpoint search para buscar
                    search_results = search_documents(query=stem, limit=10, offset=0)
                    hits = search_results.get("hits", [])
                    
                    # Buscar coincidencia exacta o parcial
                    for hit in hits:
                        hit_filename = hit.get("filename", "")
                        hit_stem = Path(hit_filename).stem
                        if hit_stem == stem or stem in hit_stem:
                            document_data = hit
                            source = f"search_fallback_{search_results.get('source', 'unknown')}"
                            break
            except Exception as e:
                pass
        
        # Si no se encuentra el documento en ninguna fuente
        if not document_data:
            error_details = {
                "storage_path": storage_path,
                "path": path,
                "file_id": file_id,
                "effective_path": effective_path
            }
            print(f"ERROR: Documento no encontrado. Parámetros de búsqueda: {error_details}")
            raise HTTPException(
                status_code=404, 
                detail=f"Documento no encontrado con los parámetros proporcionados: {error_details}"
            )
        
        # Asegurar que tenga los campos mínimos necesarios
        if "filename" not in document_data and "original_filename" in document_data:
            document_data["filename"] = document_data["original_filename"]
        
        if "title" not in document_data and "filename" in document_data:
            document_data["title"] = Path(document_data["filename"]).stem
        
        if "summary" not in document_data:
            document_data["summary"] = "No hay resumen disponible"
        
        # Registrar evento de auditoría
        audit_log(user_id, 'DOCUMENT_INFO_VIEWED', _ctx(request, {
            'user_email': user_email,
            'document_id': document_data.get("id") or file_id,
            'filename': document_data.get("filename") or effective_path,
            'source': source
        }), severity="INFO")
        
        return {
            "document": document_data,
            "source": source
        }
    
    except HTTPException:
        raise
    except Exception as e:
        log_error(e, "GET_/info", user_id=user_id, additional_details=_ctx(request, {
            'user_email': user_email,
            'path': effective_path if 'effective_path' in locals() else None,
            'file_id': file_id
        }))
        raise HTTPException(status_code=500, detail=f"Error obteniendo información del documento: {str(e)}")
