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
from services.meilisearch_service import add_documents, search_documents, is_available as is_meilisearch_available
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
        existing_document = get_document_by_stem(file_stem)

        version = 1
        parent_id = None
        file_id = file_stem

        if existing_document:
            highest_version = get_highest_version(file_stem)
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

        # Indexar en Meilisearch
        indexing_success = add_documents([complete_metadata])

        # Si es nueva versión, actualizar documento principal
        if version > 1 and parent_id:
            parent_doc = get_document_by_stem(parent_id)
            if parent_doc and indexing_success:
                from services.meilisearch_service import update_documents
                update_documents([parent_doc])

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
        results = search_documents(query=q, limit=limit, offset=offset, filters="public = true")
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
        filters = "public = true"
        results = search_documents(query=q.strip() if q else "", limit=limit, offset=offset, filters=filters)

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
            print(f"Archivo no encontrado en Storage: {path}")
            # Continuamos con los otros pasos aunque el archivo no exista en Storage
        except Exception as storage_error:
            print(f"Error eliminando archivo de Storage: {storage_error}")
            # Continuamos con los otros pasos aunque haya un error en Storage
        
        # Paso 3: Eliminar documentos de Firestore
        for doc_id in all_doc_ids:
            try:
                if delete_document_from_firestore(doc_id):
                    delete_results["firestore_deleted"].append(doc_id)
            except Exception as firestore_error:
                print(f"Error eliminando documento {doc_id} de Firestore: {firestore_error}")
                # Continuamos con otros documentos
        
        # Paso 4: Eliminar documentos de Meilisearch
        for doc_id in all_doc_ids:
            try:
                if delete_document(doc_id):
                    delete_results["meilisearch_deleted"].append(doc_id)
            except Exception as meilisearch_error:
                print(f"Error eliminando documento {doc_id} de Meilisearch: {meilisearch_error}")
                # Continuamos con otros documentos

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


@router.get("/list")
async def list_all_documents(
    request: Request,
    public_only: bool = Query(False),
    token_data=Depends(verify_firebase_token)
):
    user_id = token_data.get("user_id", "anonymous") if token_data else "anonymous"
    user_email = token_data.get("email", "") if token_data else ""

    try:
        # Normalize role helper
        def _norm(text: Optional[str]) -> str:
            import unicodedata
            if not isinstance(text, str):
                return ""
            t = unicodedata.normalize("NFD", text)
            t = t.encode("ascii", "ignore").decode("utf-8").lower()
            for ch in [" ", "_", "-", "/", "."]:
                t = t.replace(ch, "")
            return t.strip()

        # Resolve user role from Firestore
        user_role: Optional[str] = None
        try:
            db = get_firestore_client()
            if user_id and user_id != "anonymous":
                doc = db.collection("users").document(user_id).get()
                if doc.exists:
                    d = doc.to_dict() or {}
                    user_role = d.get("puesto_trabajo") or d.get("puesto") or d.get("role")
        except Exception:
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
        filter_clauses: List[str] = []
        if public_only:
            filter_clauses.append("public = true")

        # Dirección Ejecutiva sees all; others for now see only public if not requesting public_only
        is_exec = role_norm == "direccionejecutiva" or (isinstance(user_email, str) and any(p in user_email.lower() for p in ["director", "ejecutiv"]))
        if not is_exec and not public_only:
            filter_clauses.append("public = true")

        if filter_clauses:
            filters = " AND ".join(filter_clauses)

        # Query Meilisearch (empty query -> list)
        ms = search_documents(query="", limit=1000, offset=0, filters=filters)
        hits = (ms or {}).get("hits", [])
        source = (ms or {}).get("source", ("meilisearch" if is_meilisearch_available() else "local"))

        # Firestore fallback if Meilisearch unavailable
        if not hits and not is_meilisearch_available():
            try:
                fs_hits: List[Dict[str, Any]] = []
                db = get_firestore_client()
                qref = db.collection("documents")
                if public_only or (not is_exec):
                    # Using the filter keyword argument with FieldFilter
                    qref = qref.where(filter=FieldFilter("public", "==", True))
                for d in qref.limit(1000).stream():
                    data = d.to_dict() or {}
                    data["id"] = d.id
                    fs_hits.append(data)
                hits = fs_hits
                source = "firestore"
            except Exception:
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
                print(f"Error en búsqueda Meilisearch: {str(e)}")
                print("Usando búsqueda local (fallback)")
        
        # SEGUNDA FUENTE: Firestore
        if not document_data:
            try:
                firestore_doc = get_document_by_stem(file_id)
                if not firestore_doc and storage_path:
                    # Intenta buscar por el nombre de archivo (stem) extraído de la ruta
                    path_stem = Path(storage_path).stem
                    firestore_doc = get_document_by_stem(path_stem)
                
                if firestore_doc:
                    document_data = firestore_doc
                    source = "firestore"
            except Exception as e:
                print(f"Error obteniendo documento de Firestore: {str(e)}")
        
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
                print(f"Error en búsqueda por search fallback: {str(e)}")
        
        if not document_data:
            raise HTTPException(status_code=404, detail="Documento no encontrado")
        
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
