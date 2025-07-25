"""
Rutas de API para gestión de documentos

Este módulo contiene todas las rutas relacionadas con la gestión de documentos,
incluyendo la funcionalidad de biblioteca pública integrada.
"""

import os
import json
import uuid
import mimetypes
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, status, Query, Depends, Form
from fastapi.responses import StreamingResponse

# Importar el nuevo servicio de IA en lugar de gemini_service
from services.ai_service import extract_metadata, is_supported_file, estimate_processing_time
from services.firebase_service import (
    upload_file_to_storage, 
    download_file_from_storage, 
    list_files_in_storage,
    calculate_file_hash,
    check_file_hash,
    save_document_metadata,
    log_event,
    get_document_versions,
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

# Configuración
ROOT_DIR = Path(__file__).resolve().parents[1]
LOCAL_METADATA_DIR = ROOT_DIR / ".." / "meilisearch-data" / "indexes" / "documents"
LOCAL_METADATA_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.pptx', '.xlsx', '.txt', '.md'}


def _validate_uploaded_file(file: UploadFile) -> None:
    """Valida un archivo subido."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="El archivo debe tener un nombre válido")
    
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Tipo de archivo no soportado")
    
    dangerous_chars = ['..', '/', '\\', '<', '>', ':', '"', '|', '?', '*']
    if any(char in file.filename for char in dangerous_chars):
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido")


def _save_metadata_locally(metadata: Dict[str, Any], filename: str) -> Path:
    """Guarda metadatos localmente como backup."""
    json_filename = f"{Path(filename).stem}.json"
    json_path = LOCAL_METADATA_DIR / json_filename
    
    with open(json_path, "w", encoding="utf-8") as file:
        json.dump(metadata, file, ensure_ascii=False, indent=2)
    
    return json_path


def _generate_unique_filename(original_filename: str, version: int = 1) -> str:
    """Genera nombre único para evitar colisiones."""
    path = Path(original_filename)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_id = str(uuid.uuid4())[:8]
    version_suffix = f"_v{version}" if version > 1 else ""
    return f"{path.stem}{version_suffix}_{timestamp}_{unique_id}{path.suffix}"


@router.post("/upload", response_model=DocumentMetadata)
async def upload_document(
    file: UploadFile = File(...),
    is_public: bool = Form(False),
    user_id: str = Form("anonymous"),
    # Metadatos adicionales opcionales
    apartado: str = Form(None),
    categoria: str = Form(None),
    tags: str = Form(None)
):
    """Sube un documento y extrae automáticamente sus metadatos."""
    try:
        _validate_uploaded_file(file)
        
        file_bytes = await file.read()
        
        if not file_bytes:
            raise HTTPException(status_code=400, detail="El archivo está vacío")
        
        if len(file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail=f"Archivo excede {MAX_FILE_SIZE // (1024*1024)}MB")
        
        # Verificar duplicados por hash
        file_hash = calculate_file_hash(file_bytes)
        existing_doc = check_file_hash(file_hash)
        
        if existing_doc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Archivo duplicado detectado"
            )
        
        # Generar ID y versión
        file_id_base = Path(file.filename).stem
        highest_version = get_highest_version(file_id_base)
        version = highest_version + 1
        parent_id = file_id_base if version > 1 else None
        file_id = f"{file_id_base}_v{version}" if version > 1 else file_id_base
        
        # Generar nombre único
        unique_filename = _generate_unique_filename(file.filename, version)
        content_type = file.content_type or "application/octet-stream"
        
        # Extraer metadatos con IA
        extracted_metadata = extract_metadata(file_bytes, file.filename)
        
        # Subir a Firebase Storage
        storage_path = upload_file_to_storage(file_bytes, unique_filename, content_type)
        
        # Metadatos adicionales personalizados
        custom_metadata = {}
        if apartado:
            custom_metadata["apartado"] = apartado
        if categoria:
            custom_metadata["categoria"] = categoria
        if tags:
            custom_metadata["tags"] = tags.split(",") if isinstance(tags, str) else tags
        
        # Metadatos completos
        complete_metadata = {
            **extracted_metadata,
            "file_id": file_id,
            "file_id_base": file_id_base,
            "storage_path": storage_path,
            "media_type": content_type,
            "original_filename": file.filename,
            "unique_filename": unique_filename,
            "upload_timestamp": datetime.utcnow().isoformat() + "Z",
            "file_hash": file_hash,
            "processing_time_estimate": f"{estimate_processing_time(len(file_bytes))} segundos",
            "public": is_public,
            "publico": is_public,  # Compatibilidad con frontend
            "version": version,
            "parent_id": parent_id,
            "uploader_id": user_id,
            **custom_metadata
        }
        
        # Guardar metadatos
        save_document_metadata(file_id, complete_metadata, file_hash, version, parent_id)
        _save_metadata_locally(complete_metadata, file.filename)
        
        # Indexar en Meilisearch
        try:
            add_documents([complete_metadata])
        except Exception as e:
            print(f"Error indexando en Meilisearch: {e}")
        
        # Registrar eventos
        log_event(user_id, "UPLOAD", {
            "file_id": file_id,
            "filename": file.filename,
            "version": version,
            "public": is_public
        })
        
        audit_log(user_id, 'DOCUMENT_UPLOADED', {
            'file_id': file_id,
            'filename': file.filename,
            'public': is_public
        })
        
        return DocumentMetadata(**complete_metadata)
        
    except HTTPException:
        raise
    except Exception as e:
        audit_log(user_id, 'DOCUMENT_UPLOAD_ERROR', {'error': str(e)})
        raise HTTPException(status_code=500, detail=f"Error procesando documento: {str(e)}")


@router.get("/search")
async def search_documents_endpoint(
    query: str = Query(..., min_length=1),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0)
) -> Dict[str, Any]:
    """Busca documentos por contenido usando búsqueda semántica."""
    try:
        search_results = search_documents(
            query=query.strip(),
            limit=limit,
            offset=offset
        )
        
        audit_log('system', 'DOCUMENT_SEARCH', {
            'query': query,
            'results_count': len(search_results.get('hits', []))
        })
        
        return search_results
        
    except Exception as e:
        audit_log('system', 'SEARCH_ERROR', {'error': str(e)})
        raise HTTPException(status_code=500, detail=f"Error realizando búsqueda: {str(e)}")


@router.get("/public")
async def get_public_documents(
    q: str = Query("", description="Término de búsqueda opcional"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
) -> Dict[str, Any]:
    """Obtiene documentos públicos (funcionalidad de biblioteca pública)."""
    try:
        # Intentar con Meilisearch usando el filtro 'public'
        try:
            # Primero intentar con el campo "public"
            filters = "public = true"
            results = search_documents(
                query=q.strip() if q else "",
                limit=limit,
                offset=offset,
                filters=filters
            )
            
            # Verificar si hay resultados, si no, intentar con 'publico'
            if len(results.get('hits', [])) == 0:
                filters = "publico = true"
                results = search_documents(
                    query=q.strip() if q else "",
                    limit=limit,
                    offset=offset,
                    filters=filters
                )
            
            # Si encontramos resultados, registrar y devolver
            if len(results.get('hits', [])) > 0:
                audit_log('system', 'PUBLIC_DOCUMENTS_QUERY', {
                    'query': q,
                    'results_count': len(results.get('hits', []))
                })
                return results
                
            # Si no hay resultados, usar el fallback local
            return await get_public_documents_local(q, limit, offset)
            
        except Exception as search_error:
            print(f"Error con Meilisearch, intentando fallback local: {search_error}")
            return await get_public_documents_local(q, limit, offset)
        
    except Exception as meilisearch_error:
        # Fallback: buscar en archivos locales
        print(f"Error con Meilisearch, usando fallback local: {meilisearch_error}")
        return await get_public_documents_local(q, limit, offset)


@router.get("/public-local")
async def get_public_documents_local(
    q: str = Query(""),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
) -> Dict[str, Any]:
    """Busca documentos públicos en archivos locales (fallback)."""
    try:
        json_files = list(LOCAL_METADATA_DIR.glob("*.json"))
        documents = []
        
        for json_path in json_files:
            try:
                with open(json_path, "r", encoding="utf-8") as file:
                    metadata = json.load(file)
                    if metadata.get("public") == True or metadata.get("publico") == True:
                        documents.append(metadata)
            except Exception as e:
                print(f"Error leyendo {json_path}: {e}")
                continue
        
        # Filtrar por búsqueda si se proporciona
        if q:
            q_lower = q.lower()
            filtered_docs = []
            for doc in documents:
                if (q_lower in str(doc.get("title", "")).lower() or 
                    q_lower in str(doc.get("summary", "")).lower() or
                    any(q_lower in str(kw).lower() for kw in doc.get("keywords", []))):
                    filtered_docs.append(doc)
            documents = filtered_docs
        
        # Ordenar por fecha
        documents.sort(key=lambda x: x.get("upload_timestamp", ""), reverse=True)
        
        # Paginar
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


@router.get("/download/{file_stem}")
async def download_document(file_stem: str):
    """Descarga un documento por su ID."""
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
    """Descarga un documento por su ruta en Storage."""
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
    """Elimina un documento por su ruta en Storage."""
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
    """Lista todos los documentos disponibles."""
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
async def list_storage_files(prefix: str = Query(default="documents/")):
    """Lista archivos en Firebase Storage."""
    try:
        storage_files = list_files_in_storage(prefix)
        
        # Enriquecer con metadatos si existen
        for file in storage_files:
            file_extension = Path(file["filename"]).suffix.lower()
            
            # Asignar tipo
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
            
            # Intentar cargar metadatos adicionales
            file["publico"] = False
            try:
                file_id = Path(file["filename"]).stem
                metadata_path = LOCAL_METADATA_DIR / f"{file_id}.json"
                if metadata_path.exists():
                    with open(metadata_path, "r", encoding="utf-8") as f:
                        metadata = json.load(f)
                        file["public"] = metadata.get("public", False)
                        file["publico"] = metadata.get("public", False)
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
    """Obtiene todas las versiones de un documento."""
    try:
        versions = get_document_versions(document_id)
        
        if not versions:
            raise HTTPException(status_code=404, detail="Documento no encontrado")
        
        return {"file_id": document_id, "versions": versions}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo versiones: {str(e)}")


@router.get("/stats")
async def get_documents_statistics():
    """Obtiene estadísticas de documentos."""
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