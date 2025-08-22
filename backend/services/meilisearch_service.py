import json
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

from meilisearch import Client
from meilisearch.errors import MeilisearchError
from config import settings

client: Optional[Client] = None

INDEX_NAME = "documents"

BASE_DIR = Path(__file__).resolve().parents[1]
LOCAL_DATA_PATH = BASE_DIR.parent / "meilisearch-data" / "indexes" / "documents"

_meilisearch_available = False

INDEX_CONFIG = {
    "primaryKey": "id",
    "searchableAttributes": [
        "title",
        "summary",
        "keywords",
        "filename",
        "text_content",
        "id",
        "file_id",
        "storage_path",
        "path"
    ],
    "filterableAttributes": [
        "file_extension",
        "file_size_bytes",
        "date",
        "created_at",
        "keywords",
        "public",
        "publico",
        "apartado",
        "uploader_id",
        "categoria",
        "user_role",
        "puesto_trabajo",
        "estrategia",
        "storage_path",
        "path"
    ],
    "sortableAttributes": [
        "date",
        "created_at",
        "file_size_bytes",
        "title",
        "upload_timestamp"
    ],
    "displayedAttributes": [
        "id",
        "title",
        "summary",
        "keywords",
        "filename",
        "file_extension",
        "file_size_bytes",
        "date",
        "created_at",
        "public",
        "publico",
        "apartado",
        "storage_path",
        "upload_timestamp",
        "processing_timestamp",
        "ai_model",
        "file_hash",
        "file_id",
        "media_type",
        "original_filename",
        "processing_time_estimate",
        "uploader_id",
        "uploader_email",
        "categoria",
        "user_role",
        "puesto_trabajo",
        "estrategia",
        "proyecto",
        "cover_image_path"
    ]
}

def check_meilisearch_health() -> bool:
    global _meilisearch_available
    
    if client is None:
        _meilisearch_available = False
        return False
    
    try:
        health_status = client.health()
        if health_status and health_status.get('status') == 'available':
            _meilisearch_available = True
            return True
    except Exception:
        pass
    
    try:
        version = client.get_version()
        if version:
            _meilisearch_available = True
            return True
    except Exception:
        pass
    
    try:
        client.get_indexes()
        _meilisearch_available = True
        return True
    except Exception:
        pass
    
    _meilisearch_available = False
    return False


def get_task_details(task):
    """Get the task UID and status details in a uniform way, handling both dict and object responses"""
    task_uid = None
    
    # Try to get task UID from task object or dict
    if hasattr(task, 'task_uid'):
        task_uid = task.task_uid
    elif isinstance(task, dict) and "taskUid" in task:
        task_uid = task["taskUid"]
    
    if not task_uid:
        print("Warning: Could not extract task UID from task result")
        return None, None
        
    # Get task status
    try:
        task_status = client.get_task(task_uid)
        return task_uid, task_status
    except Exception as e:
        print(f"Error getting task status for task {task_uid}: {e}")
        return task_uid, None

def initialize_meilisearch() -> None:
    global client, _meilisearch_available
    
    if client is not None:
        # Ya está inicializado, solo verificar estado
        if check_meilisearch_health():
            _meilisearch_available = True
        return
    
    try:
        client = Client(
            url=settings.MEILISEARCH_HOST,
            api_key=settings.MEILISEARCH_MASTER_KEY or None
        )
        
        if check_meilisearch_health():
            # Check for failed tasks to help with debugging
            # Comentamos esto para evitar mensajes redundantes
            # check_failed_tasks()
            if _ensure_index_exists(INDEX_NAME):
                pass
                # print(f"Índice '{INDEX_NAME}' verificado y configurado correctamente")
            else:
                print(f"Hubo un problema al configurar el índice '{INDEX_NAME}'")
        else:
            print("Meilisearch no está disponible. Usando modo fallback.")
            
    except Exception as e:
        print(f"Error inicializando Meilisearch: {e}")
        print("El sistema funcionará en modo fallback usando archivos locales")
        _meilisearch_available = False


def check_failed_tasks(limit=5):
    """Check for failed tasks in Meilisearch to help with debugging"""
    if not _meilisearch_available or client is None:
        return
        
    try:
        # Get failed tasks
        try:
            tasks = client.get_tasks({"limit": limit, "statuses": "failed"})
        except Exception as e:
            # Comentado para reducir mensajes
            # print(f"Error checking failed tasks: {e}")
            return
            
        # Desactivamos la salida de errores de tareas para reducir mensajes
        """
        if hasattr(tasks, 'results') and tasks.results:
            print(f"Found {len(tasks.results)} failed tasks:")
            for task in tasks.results:
                task_type = task.type if hasattr(task, 'type') else "Unknown"
                error = task.error if hasattr(task, 'error') else "Unknown error"
                details = task.details if hasattr(task, 'details') else {}
                print(f"  - Task type: {task_type}, Error: {error}, Details: {details}")
        elif isinstance(tasks, dict) and "results" in tasks and tasks["results"]:
            print(f"Found {len(tasks['results'])} failed tasks:")
            for task in tasks["results"]:
                task_type = task.get('type', "Unknown")
                error = task.get('error', "Unknown error")
                details = task.get('details', {})
                print(f"  - Task type: {task_type}, Error: {error}, Details: {details}")
        else:
            print("No failed tasks found")
        """
            
    except Exception as e:
        # Comentado para reducir mensajes
        # print(f"Error checking failed tasks: {e}")
        pass


def sanitize_document_id(doc_id):
    """
    Sanitize document ID to comply with Meilisearch requirements:
    - Only alphanumeric characters, hyphens and underscores
    - Not more than 511 bytes
    """
    if not doc_id:
        return str(datetime.now().timestamp()).replace(".", "")
        
    # Convert to string if needed
    doc_id = str(doc_id)
    
    # Handle escaped quotes - replace them before general processing
    import re
    doc_id = doc_id.replace('\\"', '').replace("\\'", '')
    
    # Remove any surrounding quotes (both single and double)
    # This handles cases where the ID might have been serialized with quotes
    doc_id = re.sub(r'^[\'"]|[\'"]$', '', doc_id)
    
    # Replace invalid characters with underscores
    sanitized = re.sub(r'[^a-zA-Z0-9_-]', '_', doc_id)
    
    # Truncate if too long (511 bytes max)
    if len(sanitized.encode('utf-8')) > 511:
        sanitized = sanitized[:255]  # Safe truncation
        
    return sanitized


def _ensure_index_exists(index_name=INDEX_NAME) -> bool:
    if not _meilisearch_available or client is None:
        return False
    
    try:
        # Verificar si el índice ya existe
        try:
            existing_indices = client.get_indexes()
            index_names = []
            
            if isinstance(existing_indices, dict) and "results" in existing_indices:
                index_names = [idx.uid for idx in existing_indices["results"]]
            elif hasattr(existing_indices, 'results'):
                index_names = [idx.uid for idx in existing_indices.results]
            elif isinstance(existing_indices, list):
                index_names = [idx.uid for idx in existing_indices]
                
            if index_name in index_names:
                # El índice ya existe, no es necesario crearlo
                # Desactivamos mensaje para reducir verbosidad
                # print(f"El índice '{index_name}' ya existe")
                return _configure_index(index_name)
        except Exception as e:
            # Desactivamos mensaje para reducir verbosidad
            # print(f"Error al verificar índices existentes: {e}")
            # Continuamos para intentar crear el índice de todos modos
            pass
        
        # Crear el índice si no existe
        try:
            print(f"Creando índice '{index_name}'...")
            # En la versión 0.37.0 del cliente Python, el parámetro se llama 'primary_key' en lugar de 'uid'
            task = client.create_index(index_name, {"primaryKey": "id"})
            
            # Check task status using the helper function
            task_uid, task_status = get_task_details(task)
            if task_uid and task_status:
                # Desactivamos mensaje para reducir verbosidad
                # print(f"Create index task status: {task_status}")
                
                if hasattr(task_status, 'status') and task_status.status == "failed":
                    error = task_status.error if hasattr(task_status, 'error') else "Unknown error"
                    print(f"Failed to create index: {error}")
                    return False
            
            return _configure_index(index_name)
        except Exception as e:
            # Desactivamos mensaje para reducir verbosidad
            # print(f"Error al crear índice: {e}")
            # Intentar obtener el índice incluso si falló la creación
            # (podría haber fallado porque ya existe)
            try:
                index = client.index(index_name)
                if index:
                    # Desactivamos mensaje para reducir verbosidad
                    # print(f"El índice '{index_name}' parece existir a pesar del error")
                    return _configure_index(index_name)
            except:
                pass
            return False
            
    except Exception as e:
        print(f"Error configurando índice: {e}")
        return False


def _configure_index(index_name=INDEX_NAME) -> bool:
    if not _meilisearch_available or client is None:
        return False
    
    try:
        index = client.index(index_name)
        
        for config_type, attributes in [
            ("searchable", INDEX_CONFIG["searchableAttributes"]),
            ("filterable", INDEX_CONFIG["filterableAttributes"]),
            ("sortable", INDEX_CONFIG["sortableAttributes"]),
            ("displayed", INDEX_CONFIG["displayedAttributes"])
        ]:
            try:
                if config_type == "searchable":
                    task = index.update_searchable_attributes(attributes)
                elif config_type == "filterable":
                    task = index.update_filterable_attributes(attributes)
                elif config_type == "sortable":
                    task = index.update_sortable_attributes(attributes)
                elif config_type == "displayed":
                    task = index.update_displayed_attributes(attributes)
                    
                # Check task status using the helper function
                task_uid, task_status = get_task_details(task)
                if task_uid and task_status:
                    if hasattr(task_status, 'status') and task_status.status == "failed":
                        error = task_status.error if hasattr(task_status, 'error') else "Unknown error"
                        print(f"Failed to update {config_type} attributes: {error}")
            except Exception as e:
                # Desactivamos mensaje para reducir verbosidad
                # print(f"Error updating {config_type} attributes: {str(e)}")
                pass
                
        return True
                
    except Exception as e:
        print(f"Error en configuración del índice: {e}")
        return False


def add_documents(documents, index_name=INDEX_NAME):
    """Add documents to the specified index"""
    if not _meilisearch_available:
        if not check_meilisearch_health():
            print(f"Meilisearch unavailable when adding documents to {index_name}")
            return False

    # Ensure index exists
    _ensure_index_exists(index_name)
    
    try:
        # Get the index
        index = client.index(index_name)
        
        # Sanitize document IDs
        for doc in documents:
            if isinstance(doc, dict):
                # Ensure 'id' exists and is sanitized
                if 'id' in doc:
                    doc['id'] = sanitize_document_id(doc['id'])
                # Align with file_id if present
                elif 'file_id' in doc:
                    doc['id'] = sanitize_document_id(doc['file_id'])
        
        # Add documents with explicit primary key
        task = index.add_documents(documents, primary_key="id")
        
        # Check task status using the helper function
        task_uid, task_status = get_task_details(task)
        if task_uid and task_status:
            print(f"Add documents task status: {task_status}")
            
            # Handle task status object
            if hasattr(task_status, 'status'):
                if task_status.status == "failed":
                    error = task_status.error if hasattr(task_status, 'error') else "Unknown error"
                    print(f"Failed to add documents: {error}")
                    # Print the full task status for debugging
                    print(f"Task details: {dir(task_status)}")
                    if hasattr(task_status, 'details'):
                        print(f"Task details: {task_status.details}")
                    return False
            # Handle task status dict
            elif isinstance(task_status, dict) and task_status.get("status") == "failed":
                print(f"Failed to add documents: {task_status.get('error')}")
                print(f"Task details: {task_status}")
                return False
        else:
            print("Could not get task details from add_documents result")
            
        return True
    except Exception as e:
        print(f"Error adding documents to Meilisearch: {str(e)}")
        return False


def delete_document(document_id: str) -> bool:
    if not check_meilisearch_health():
        print(f"Meilisearch unavailable when deleting document {document_id}")
        return False
    
    try:
        # Sanitize document ID
        sanitized_id = sanitize_document_id(document_id)
        
        index = client.index(INDEX_NAME)
        task = index.delete_document(sanitized_id)
        
        # Check task status using the helper function
        task_uid, task_status = get_task_details(task)
        if task_uid and task_status:
            print(f"Delete document task status: {task_status}")
            
            # Handle task status object
            if hasattr(task_status, 'status'):
                if task_status.status == "failed":
                    error = task_status.error if hasattr(task_status, 'error') else "Unknown error"
                    print(f"Failed to delete document: {error}")
                    return False
                elif task_status.status in ["enqueued", "processing"]:
                    print(f"Document {sanitized_id} deletion is being processed")
                    return True
                elif task_status.status == "succeeded":
                    print(f"Document {sanitized_id} deleted successfully")
                    return True
            # Handle task status dict
            elif isinstance(task_status, dict):
                if task_status.get("status") == "failed":
                    print(f"Failed to delete document: {task_status.get('error')}")
                    return False
                elif task_status.get("status") in ["enqueued", "processing"]:
                    print(f"Document {sanitized_id} deletion is being processed")
                    return True
                elif task_status.get("status") == "succeeded":
                    print(f"Document {sanitized_id} deleted successfully")
                    return True
                
            # Unknown status
            print(f"Unknown status when deleting document: {task_status}")
            return False
        else:
            print("Could not get task details from delete_document result")
            return False
        
    except Exception as e:
        print(f"Error deleting document from Meilisearch: {str(e)}")
        return False
        
def update_documents(documents: List[Dict[str, Any]]) -> bool:
    if not documents:
        return True
        
    if not check_meilisearch_health():
        print(f"Meilisearch no disponible. {len(documents)} documento(s) no actualizados.")
        return False
        
    try:
        index = client.index(INDEX_NAME)
        
        for doc in documents:
            # Always align primary key with Firestore's document id
            if 'file_id' in doc:
                doc['id'] = sanitize_document_id(doc['file_id'])
            elif 'id' in doc:
                doc['id'] = sanitize_document_id(doc['id'])
                
        # Explicitly specify primary key for Meilisearch 1.18.0 compatibility
        task = index.update_documents(documents, primary_key="id")
        
        # Check task status using the helper function
        task_uid, task_status = get_task_details(task)
        if task_uid and task_status:
            print(f"Update documents task status: {task_status}")
            
            # Handle task status object
            if hasattr(task_status, 'status'):
                if task_status.status == "failed":
                    error = task_status.error if hasattr(task_status, 'error') else "Unknown error"
                    print(f"Failed to update documents: {error}")
                    # Print the full task status for debugging
                    print(f"Task details: {dir(task_status)}")
                    if hasattr(task_status, 'details'):
                        print(f"Task details: {task_status.details}")
                    return False
                elif task_status.status in ["enqueued", "processing"]:
                    print(f"{len(documents)} documento(s) enviado(s) a actualizar en Meilisearch (procesamiento en segundo plano)")
                    return True
                elif task_status.status == "succeeded":
                    print(f"{len(documents)} documento(s) actualizado(s) en Meilisearch")
                    return True
            # Handle task status dict
            elif isinstance(task_status, dict):
                if task_status.get("status") == "failed":
                    print(f"Failed to update documents: {task_status.get('error')}")
                    print(f"Task details: {task_status}")
                    return False
                elif task_status.get("status") in ["enqueued", "processing"]:
                    print(f"{len(documents)} documento(s) enviado(s) a actualizar en Meilisearch (procesamiento en segundo plano)")
                    return True
                elif task_status.get("status") == "succeeded":
                    print(f"{len(documents)} documento(s) actualizado(s) en Meilisearch")
                    return True
                
            # Unknown status
            print(f"Estado desconocido al actualizar documentos: {task_status}")
            return False
        else:
            print("Could not get task details from update_documents result")
            return False
            
    except Exception as e:
        print(f"Error actualizando documentos en Meilisearch: {e}")
        return False


def search_documents(
    query: str = "",
    limit: int = 20,
    offset: int = 0,
    filters: Optional[str] = None,
    sort: Optional[List[str]] = None
) -> Dict[str, Any]:
    if check_meilisearch_health():
        try:
            return _search_meilisearch(query, limit, offset, filters, sort)
        except Exception as e:
            print(f"Error en búsqueda Meilisearch: {e}")
    
    print("Usando búsqueda local (fallback)")
    return _search_local_fallback(query, limit, offset, filters, sort)


def _search_meilisearch(
    query: str,
    limit: int,
    offset: int,
    filters: Optional[str],
    sort: Optional[List[str]]
) -> Dict[str, Any]:
    search_options = {
        "limit": limit,
        "offset": offset
    }
    
    if filters:
        search_options["filter"] = filters
    
    if sort:
        search_options["sort"] = sort
    
    search_options["attributesToHighlight"] = ["title", "summary"]
    search_options["highlightPreTag"] = "<mark>"
    search_options["highlightPostTag"] = "</mark>"
    
    index = client.index(INDEX_NAME)
    results = index.search(query, search_options)
    
    results["source"] = "meilisearch"
    
    return results


def _search_local_fallback(
    query: str,
    limit: int,
    offset: int,
    filters: Optional[str],
    sort: Optional[List[str]]
) -> Dict[str, Any]:
    try:
        documents = []
        
        if LOCAL_DATA_PATH.exists():
            for json_file in LOCAL_DATA_PATH.glob("*.json"):
                try:
                    with open(json_file, 'r', encoding='utf-8') as f:
                        doc = json.load(f)
                        documents.append(doc)
                except Exception as e:
                    print(f"Error leyendo {json_file}: {e}")
                    continue
        
        filtered_docs = _apply_local_filters(documents, filters)
        
        if query:
            filtered_docs = _apply_local_search(filtered_docs, query)
        
        if sort:
            filtered_docs = _apply_local_sort(filtered_docs, sort)
        
        total = len(filtered_docs)
        paginated = filtered_docs[offset:offset + limit]
        
        return {
            "hits": paginated,
            "query": query,
            "processingTimeMs": 0,
            "limit": limit,
            "offset": offset,
            "estimatedTotalHits": total,
            "source": "local_fallback"
        }
        
    except Exception as e:
        print(f"Error en búsqueda local: {e}")
        return {
            "hits": [],
            "query": query,
            "processingTimeMs": 0,
            "limit": limit,
            "offset": offset,
            "estimatedTotalHits": 0,
            "source": "local_fallback",
            "error": str(e)
        }


def _apply_local_filters(documents: List[Dict], filters: Optional[str]) -> List[Dict]:
    if not filters:
        return documents
    
    filtered = []
    
    for doc in documents:
        try:
            if "public = true" in filters and doc.get("public") != True:
                continue
            elif "public = false" in filters and doc.get("public") != False:
                continue
            
            if "apartado = " in filters:
                import re
                match = re.search(r'apartado = "([^"]+)"', filters)
                if match and doc.get("apartado") != match.group(1):
                    continue
            
            if "file_extension = " in filters:
                import re
                match = re.search(r'file_extension = \.(\w+)', filters)
                if match and not doc.get("file_extension", "").endswith(f".{match.group(1)}"):
                    continue
            
            filtered.append(doc)
            
        except:
            filtered.append(doc)
    
    return filtered


def _apply_local_search(documents: List[Dict], query: str) -> List[Dict]:
    query_lower = query.lower()
    results = []
    
    for doc in documents:
        searchable_text = " ".join([
            str(doc.get("title", "")),
            str(doc.get("summary", "")),
            str(doc.get("filename", "")),
            " ".join(doc.get("keywords", []))
        ]).lower()
        
        if query_lower in searchable_text:
            results.append(doc)
    
    return results


def _apply_local_sort(documents: List[Dict], sort_fields: List[str]) -> List[Dict]:
    sorted_docs = documents.copy()
    
    for sort_field in reversed(sort_fields):
        field = sort_field.replace(":desc", "").replace(":asc", "")
        reverse = ":desc" in sort_field
        
        sorted_docs.sort(
            key=lambda x: x.get(field, ""),
            reverse=reverse
        )
    
    return sorted_docs


def get_index_stats() -> Dict[str, Any]:
    if check_meilisearch_health():
        try:
            index = client.index(INDEX_NAME)
            stats = index.get_stats()
            stats["source"] = "meilisearch"
            return stats
        except:
            pass
    
    try:
        doc_count = len(list(LOCAL_DATA_PATH.glob("*.json"))) if LOCAL_DATA_PATH.exists() else 0
        return {
            "numberOfDocuments": doc_count,
            "isIndexing": False,
            "source": "local_fallback"
        }
    except:
        return {
            "numberOfDocuments": 0,
            "isIndexing": False,
            "source": "error"
        }


def is_available() -> bool:
    return _meilisearch_available

# Iniciamos MeiliSearch solo si no está ya inicializado
if client is None:
    initialize_meilisearch()