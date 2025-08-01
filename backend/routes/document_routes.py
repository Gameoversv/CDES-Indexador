import os
import json
import uuid
import mimetypes
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, status, Query, Depends, Form
from fastapi.responses import StreamingResponse

from services.ai_service import extract_metadata, is_supported_file, estimate_processing_time
from services.firebase_service import (
    upload_file_to_storage, 
    upload_file_to_custom_path,  # ← Nueva función para rutas organizadas
    download_file_from_storage, 
    list_files_in_storage,
    calculate_file_hash,
    check_file_hash,
    save_document_metadata,
    log_event,
    get_document_by_filename,
    get_document_by_stem,
    get_highest_version
)
from services.meilisearch_service import add_documents, search_documents
from models.document_model import DocumentMetadata
from utils.audit_logger import log_event as audit_log

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

MAX_FILE_SIZE = 50 * 1024 * 1024
ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.pptx', '.xlsx', '.txt', '.md'}


def get_current_user(user_id: str) -> Dict[str, Any]:
    """
    Obtiene información del usuario actual desde la base de datos o sistema de auth.
    Mapea user_id al rol/puesto correspondiente.
    """
    try:
        # 🧪 MAPEO TEMPORAL PARA TESTING - Reemplazar con tu sistema de auth real
        user_role_mapping = {
            "comunicacion_user": "comunicacion",
            "admin_user": "ADMINISTRATIVO", 
            "asistente_user": "Asistente",
            "proyectos_user": "proyectos",
            "director_user": "Direccion_Estrategias",
            "anonymous": "Direccion_Estrategias"  # Default para anonymous
        }
        
        role = user_role_mapping.get(user_id, "Direccion_Estrategias")
        print(f"📋 Usuario '{user_id}' → Puesto '{role}'")
        
        return {"role": role}
        
    except Exception as e:
        print(f"❌ Error obteniendo usuario {user_id}: {e}")
        return {"role": "Direccion_Estrategias"}  # Fallback seguro


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


def _determine_storage_path(extracted_metadata: Dict[str, Any], filename: str) -> str:
    """
    Determina la ruta de almacenamiento en Firebase Storage basada en los metadatos extraídos por IA.
    
    Estructura:
    - PES 203P: documents/PES_203P/{estrategia}/{tipo_documento}/{año}/{filename}
    - CDES Inst: documents/CDES_Inst/{puesto_responsable}/{tipo_documento}/{año}/{filename}
    - Sin apartado: documents/general/{año}/{mes}/{día}/{filename}
    """
    try:
        # Obtener fecha actual para organización temporal
        now = datetime.utcnow()
        año = now.strftime("%Y")
        mes = now.strftime("%m")
        día = now.strftime("%d")
        
        # Obtener información de los metadatos
        apartado = extracted_metadata.get("apartado", "").strip()
        tipo_documento = extracted_metadata.get("tipo_documento", "sin_clasificar").strip()
        
        # Limpiar nombre de archivo para evitar problemas
        safe_filename = filename.replace(" ", "_").replace("&", "y")
        
        if apartado == "PES 203P":
            # ✅ ESTRUCTURA PARA PES 203P
            estrategia_relacionada = extracted_metadata.get("estrategia_relacionada", "Sin_Estrategia").strip()
            
            # Normalizar nombre de estrategia para usar como carpeta
            if estrategia_relacionada == "Estrategia I":
                estrategia_folder = "Estrategia_I"
            elif estrategia_relacionada == "Estrategia II":
                estrategia_folder = "Estrategia_II"
            elif estrategia_relacionada == "Estrategia III":
                estrategia_folder = "Estrategia_III"
            elif estrategia_relacionada == "Estrategia IV":
                estrategia_folder = "Estrategia_IV"
            else:
                estrategia_folder = "Sin_Estrategia"
            
            # Normalizar tipo de documento
            tipo_folder = tipo_documento.replace("/", "_").replace(" ", "_")
            
            storage_path = f"documents/PES_203P/{estrategia_folder}/{tipo_folder}/{año}/{safe_filename}"
            
            print(f"🎯 PES 203P - Ruta: {storage_path}")
            print(f"   📁 Estrategia: {estrategia_relacionada} → {estrategia_folder}")
            print(f"   📄 Tipo: {tipo_documento} → {tipo_folder}")
            
        elif apartado == "CDES Inst.":
            # ✅ ESTRUCTURA PARA CDES INST
            puesto_responsable = extracted_metadata.get("puesto_responsable", "Sin_Puesto").strip()
            
            # Normalizar puesto para usar como carpeta
            puesto_folder = puesto_responsable.replace(" ", "_")
            
            # Normalizar tipo de documento
            tipo_folder = tipo_documento.replace("/", "_").replace(" ", "_")
            
            storage_path = f"documents/CDES_Inst/{puesto_folder}/{tipo_folder}/{año}/{safe_filename}"
            
            print(f"🏢 CDES Inst - Ruta: {storage_path}")
            print(f"   👥 Puesto: {puesto_responsable} → {puesto_folder}")
            print(f"   📄 Tipo: {tipo_documento} → {tipo_folder}")
            
        else:
            # ✅ ESTRUCTURA GENERAL (sin apartado específico)
            storage_path = f"documents/general/{año}/{mes}/{día}/{safe_filename}"
            
            print(f"📂 General - Ruta: {storage_path}")
            print(f"   📅 Fecha: {año}/{mes}/{día}")
        
        return storage_path
        
    except Exception as e:
        # Fallback a estructura simple por fecha si hay error
        print(f"⚠️ Error determinando ruta de almacenamiento: {e}")
        print(f"🔄 Usando ruta fallback por fecha")
        
        now = datetime.utcnow()
        año = now.strftime("%Y")
        mes = now.strftime("%m") 
        día = now.strftime("%d")
        safe_filename = filename.replace(" ", "_").replace("&", "y")
        
        return f"documents/fallback/{año}/{mes}/{día}/{safe_filename}"


@router.post("/upload", response_model=DocumentMetadata)
async def upload_document(
    file: UploadFile = File(...),
    is_public: bool = Form(False),
    user_id: str = Form("anonymous"),
    apartado: str = Form(None),
    categoria: str = Form(None),
    tags: str = Form(None)
):
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
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Archivo duplicado detectado"
            )
        
        # Implementación del sistema de versionado
        # Determinar si es una nueva versión basada en el nombre base
        file_stem = Path(file.filename).stem
        existing_document = get_document_by_stem(file_stem)
        
        version = 1
        parent_id = None
        file_id = file_stem
        
        if existing_document:
            # Es una nueva versión
            highest_version = get_highest_version(file_stem)
            version = highest_version + 1
            parent_id = file_stem
            file_id = f"{file_stem}_v{version}"
        
        content_type = file.content_type or "application/octet-stream"
        
        # ✅ OBTENER EL PUESTO DEL USUARIO DESDE SU PERFIL
        current_user = get_current_user(user_id)
        puesto_usuario = current_user.get('role', 'Direccion_Estrategias')
        
        # 🔍 DEBUG: Logs para verificar parámetros
        print(f"🧑‍💼 Usuario: {user_id}")
        print(f"📁 Apartado: {apartado}")
        print(f"💼 Puesto: {puesto_usuario}")
        
        # ✅ PASAR AMBOS PARÁMETROS A LA IA
        extracted_metadata = extract_metadata(
            file_bytes, 
            file.filename, 
            apartado=apartado,           # ← Del formulario frontend
            puesto_usuario=puesto_usuario # ← Del perfil del usuario
        )
        
        # 🔍 DEBUG: Ver qué devuelve la IA
        print(f"🤖 Metadatos extraídos por IA:")
        print(f"   - Título: {extracted_metadata.get('title', 'N/A')}")
        print(f"   - Apartado: {extracted_metadata.get('apartado', 'N/A')}")
        print(f"   - Tipo documento: {extracted_metadata.get('tipo_documento', 'N/A')}")
        print(f"   - Puesto responsable: {extracted_metadata.get('puesto_responsable', 'N/A')}")
        print(f"   - Metadatos específicos: {extracted_metadata.get('metadatos_especificos', {})}")
        
        # ✅ DETERMINAR RUTA DE ALMACENAMIENTO ORGANIZADA
        organized_storage_path = _determine_storage_path(extracted_metadata, file.filename)
        
        # ✅ SUBIR ARCHIVO CON RUTA ORGANIZADA (usando función personalizada sin fechas automáticas)
        storage_path = upload_file_to_custom_path(file_bytes, organized_storage_path, content_type)
        
        custom_metadata = {}
        if apartado:
            custom_metadata["apartado"] = apartado
        if categoria:
            custom_metadata["categoria"] = categoria
        if tags:
            custom_metadata["tags"] = tags.split(",") if isinstance(tags, str) else tags
        
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
            **custom_metadata
        }
        
        # Guardar en Firebase con versión
        save_document_metadata(file_id, complete_metadata, file_hash, version, parent_id)
        
        # Guardar JSON localmente
        _save_metadata_locally(complete_metadata, file.filename)
        
        # Intentar indexar en Meilisearch
        indexing_success = add_documents([complete_metadata])
        
        # Si es una nueva versión, actualizar el documento principal en Meilisearch
        if version > 1 and parent_id:
            parent_doc = get_document_by_stem(parent_id)
            if parent_doc and indexing_success:
                from services.meilisearch_service import update_documents
                update_documents([parent_doc])
        
        # Registrar eventos
        log_event(user_id, "UPLOAD", {
            "file_id": file_id,
            "filename": file.filename,
            "public": is_public,
            "version": version,
            "parent_id": parent_id,
            "indexed_in_meilisearch": indexing_success
        })
        
        audit_log(user_id, 'DOCUMENT_UPLOADED', {
            'file_id': file_id,
            'filename': file.filename,
            'public': is_public,
            'version': version,
            'parent_id': parent_id,
            'indexed': indexing_success
        })
        
        return DocumentMetadata(**complete_metadata)
        
    except HTTPException:
        raise
    except Exception as e:
        audit_log(user_id, 'DOCUMENT_UPLOAD_ERROR', {'error': str(e)})
        raise HTTPException(status_code=500, detail=f"Error procesando documento: {str(e)}")


from services.meilisearch_service import search_documents, is_available as is_meilisearch_available

@router.get("/search")
async def search_library(
    q: str = Query(...),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """
    Busca en la biblioteca con fallback automático.
    """
    try:
        # La función search_documents ya maneja el fallback
        results = search_documents(
            query=q,
            limit=limit,
            offset=offset,
            filters="public = true"  # Solo documentos públicos en biblioteca
        )
        
        # Informar al frontend sobre la fuente de datos
        results["meilisearch_available"] = is_meilisearch_available()
        
        return results
        
    except Exception as e:
        return {
            "hits": [],
            "query": q,
            "error": str(e),
            "meilisearch_available": False,
            "source": "error"
        }


@router.get("/public")
async def get_public_documents(
    q: str = Query("", description="Término de búsqueda opcional"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
) -> Dict[str, Any]:
    """
    Obtiene documentos públicos con fallback automático.
    """
    try:
        # Usar la función search_documents que ya tiene fallback integrado
        filters = "public = true"
        results = search_documents(
            query=q.strip() if q else "",
            limit=limit,
            offset=offset,
            filters=filters
        )
        
        # Registrar evento si hay resultados
        if len(results.get('hits', [])) > 0:
            audit_log('system', 'PUBLIC_DOCUMENTS_QUERY', {
                'query': q,
                'results_count': len(results.get('hits', [])),
                'source': results.get('source', 'unknown')
            })
        
        return results
        
    except Exception as e:
        audit_log('system', 'PUBLIC_SEARCH_ERROR', {'error': str(e)})
        # En caso de error total, devolver estructura vacía
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
    q: str = Query(""),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
) -> Dict[str, Any]:
    try:
        json_files = list(LOCAL_METADATA_DIR.glob("*.json"))
        documents = []
        
        for json_path in json_files:
            try:
                with open(json_path, "r", encoding="utf-8") as file:
                    metadata = json.load(file)
                    if metadata.get("public") == True:
                        documents.append(metadata)
            except Exception as e:
                print(f"Error leyendo {json_path}: {e}")
                continue
        
        if q:
            q_lower = q.lower()
            filtered_docs = []
            for doc in documents:
                if (q_lower in str(doc.get("title", "")).lower() or 
                    q_lower in str(doc.get("summary", "")).lower() or
                    any(q_lower in str(kw).lower() for kw in doc.get("keywords", []))):
                    filtered_docs.append(doc)
            documents = filtered_docs
        
        documents.sort(key=lambda x: x.get("upload_timestamp", ""), reverse=True)
        
        total = len(documents)
        paginated_docs = documents[offset:offset + limit]
        
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
        audit_log('system', 'LOCAL_PUBLIC_SEARCH_ERROR', {'error': str(e)})
        raise HTTPException(status_code=500, detail=f"Error en búsqueda local: {str(e)}")


@router.get("/versions/{file_stem}")
async def get_document_versions(file_stem: str):
    try:
        # Obtener el documento principal
        base_document = get_document_by_stem(file_stem)
        if not base_document:
            raise HTTPException(status_code=404, detail=f"Documento no encontrado")
        
        # Preparar la respuesta con la versión base
        versions = [base_document]
        
        # Agregar todas las versiones
        version_ids = base_document.get("versions", [])
        for version_id in version_ids:
            version_doc = get_document_by_stem(version_id)
            if version_doc:
                versions.append(version_doc)
        
        # Ordenar por número de versión
        versions.sort(key=lambda x: x.get("version", 1))
        
        return {
            "document_id": file_stem,
            "total_versions": len(versions),
            "versions": versions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo versiones: {str(e)}")

@router.get("/download/{file_stem}")
async def download_document(file_stem: str):
    try:
        metadata_path = LOCAL_METADATA_DIR / f"{file_stem}.json"
        
        if not metadata_path.exists():
            raise HTTPException(status_code=404, detail=f"Documento no encontrado")
        
        with open(metadata_path, "r", encoding="utf-8") as file:
            metadata = json.load(file)
        
        file_bytes = download_file_from_storage(metadata["storage_path"])
        
        filename = metadata.get("original_filename", f"{file_stem}.bin")
        content_type = metadata.get("media_type", "application/octet-stream")
        
        audit_log('system', 'DOCUMENT_DOWNLOADED', {'file_stem': file_stem})
        
        return StreamingResponse(
            iter([file_bytes]),
            media_type=content_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        audit_log('system', 'DOWNLOAD_ERROR', {'error': str(e)})
        raise HTTPException(status_code=500, detail=f"Error descargando documento: {str(e)}")


@router.get("/download_by_path")
async def download_by_storage_path(path: str = Query(...)):
    try:
        if not path.strip():
            raise HTTPException(status_code=400, detail="Ruta no puede estar vacía")
        
        if ".." in path or path.startswith("/"):
            raise HTTPException(status_code=400, detail="Ruta inválida")
        
        file_bytes = download_file_from_storage(path)
        filename = Path(path).name
        content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        
        audit_log('system', 'DOCUMENT_DOWNLOADED_BY_PATH', {'path': path})
        
        return StreamingResponse(
            iter([file_bytes]),
            media_type=content_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    except Exception as e:
        audit_log('system', 'DOWNLOAD_BY_PATH_ERROR', {'error': str(e)})
        raise HTTPException(status_code=500, detail=f"Error descargando archivo: {str(e)}")


@router.delete("/delete_by_path")
async def delete_document_by_path(path: str = Query(...), user_id: str = Query("anonymous")):
    try:
        from services.firebase_service import delete_file_from_storage
        
        delete_file_from_storage(path)
        
        audit_log(user_id, 'DOCUMENT_DELETED_BY_PATH', {
            'path': path,
            'filename': Path(path).name
        })
        
        return {"message": "Archivo eliminado exitosamente", "path": path}
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    except Exception as e:
        audit_log(user_id, 'DELETE_BY_PATH_ERROR', {'error': str(e)})
        raise HTTPException(status_code=500, detail=f"Error eliminando archivo: {str(e)}")


@router.get("/list")
async def list_all_documents(
    public_only: bool = Query(False)
) -> Dict[str, List[Dict[str, Any]]]:
    try:
        documents = []
        
        if LOCAL_METADATA_DIR.exists():
            for json_file in LOCAL_METADATA_DIR.glob("*.json"):
                try:
                    with open(json_file, "r", encoding="utf-8") as file:
                        metadata = json.load(file)
                        if not public_only or metadata.get("public", False):
                            documents.append(metadata)
                except Exception:
                    continue
        
        documents.sort(
            key=lambda doc: doc.get("upload_timestamp", ""),
            reverse=True
        )
        
        audit_log('system', 'DOCUMENTS_LISTED', {
            'total_documents': len(documents),
            'public_only': public_only
        })
        
        return {"documents": documents}
        
    except Exception as e:
        audit_log('system', 'LIST_DOCUMENTS_ERROR', {'error': str(e)})
        raise HTTPException(status_code=500, detail=f"Error listando documentos: {str(e)}")


@router.get("/storage")
async def list_storage_files(prefix: str = Query(default="")):
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
        
        audit_log('system', 'STORAGE_EXPLORED', {
            'prefix': prefix,
            'files_count': len(storage_files)
        })
        
        return {"files": storage_files}
        
    except Exception as e:
        audit_log('system', 'STORAGE_EXPLORATION_ERROR', {'error': str(e)})
        raise HTTPException(status_code=500, detail=f"Error explorando storage: {str(e)}")


@router.get("/{document_id}/versions")
async def get_document_versions_endpoint(document_id: str):
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
async def get_documents_statistics():
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
        
        return stats
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo estadísticas: {str(e)}")