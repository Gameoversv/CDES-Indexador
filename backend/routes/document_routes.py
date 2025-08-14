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
    get_highest_version
)
from services.meilisearch_service import add_documents, search_documents, is_available as is_meilisearch_available
from models.document_model import DocumentMetadata
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

MAX_FILE_SIZE = 50 * 1024 * 1024
ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.pptx', '.xlsx', '.txt', '.md'}

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
    is_public: bool = Form(False),
    apartado: str = Form(None),
    categoria: str = Form(None),
    tags: str = Form(None),
    token_data=Depends(verify_firebase_token)
):
    user_id = token_data["user_id"]
    user_email = token_data.get("email", "")

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
        # Decide subfolder based on apartado
        apartado_folder = None
        storage_filename = file.filename
        if apartado:
            if apartado == "CDES inst":
                # Get user_role and tipo_documento from metadata (prefer custom_metadata, fallback to extracted_metadata)
                user_role = None
                tipo_documento = None
                # Try to get from custom_metadata first
                if "user_role" in custom_metadata:
                    user_role = custom_metadata["user_role"]
                elif "user_role" in extracted_metadata:
                    user_role = extracted_metadata["user_role"]
                if "tipo_documento" in custom_metadata:
                    tipo_documento = custom_metadata["tipo_documento"]
                elif "tipo_documento" in extracted_metadata:
                    tipo_documento = extracted_metadata["tipo_documento"]
                # Build path: CDES_inst/{user_role}/{tipo_documento}/filename
                subfolders = ["CDES_inst"]
                if user_role:
                    subfolders.append(str(user_role))
                if tipo_documento:
                    subfolders.append(str(tipo_documento))
                storage_filename = "/".join(subfolders + [file.filename])
            elif apartado == "PES 2030":
                # Get estrategia and tipo_documento from metadata (prefer custom_metadata, fallback to extracted_metadata)
                estrategia = None
                tipo_documento = None
                if "estrategia" in custom_metadata:
                    estrategia = custom_metadata["estrategia"]
                elif "estrategia" in extracted_metadata:
                    estrategia = extracted_metadata["estrategia"]
                if "tipo_documento" in custom_metadata:
                    tipo_documento = custom_metadata["tipo_documento"]
                elif "tipo_documento" in extracted_metadata:
                    tipo_documento = extracted_metadata["tipo_documento"]
                # Build path: PES_2030/{estrategia}/{tipo_documento}/filename
                subfolders = ["PES_2030"]
                if estrategia:
                    subfolders.append(str(estrategia))
                if tipo_documento:
                    subfolders.append(str(tipo_documento))
                storage_filename = "/".join(subfolders + [file.filename])
        storage_path = upload_file_to_storage(file_bytes, storage_filename, content_type)

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
            "uploader_email": user_email,
            **custom_metadata
        }

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

        return DocumentMetadata(**complete_metadata)

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
        from services.firebase_service import delete_file_from_storage

        delete_file_from_storage(path)

        audit_log(user_id, 'CUSTOM_DOCUMENT_DELETE', _ctx(request, {
            'user_email': user_email,
            'path': path,
            'filename': Path(path).name
        }), severity="WARNING")

        return {"message": "Archivo eliminado exitosamente", "path": path}

    except FileNotFoundError:
        audit_log(user_id, 'CUSTOM_DOCUMENT_DELETE', _ctx(request, {
            'user_email': user_email,
            'path': path,
            'status': 'FAILED',
            'error': 'FileNotFoundError'
        }), severity="WARNING")
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
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
) -> Dict[str, List[Dict[str, Any]]]:
    user_id = token_data.get("user_id", "anonymous") if token_data else "anonymous"
    user_email = token_data.get("email", "") if token_data else ""

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

        audit_log(user_id, 'DOCUMENT_SEARCH', _ctx(request, {
            'user_email': user_email,
            'total_documents': len(documents),
            'public_only': public_only
        }), severity="INFO")

        return {"documents": documents}

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
