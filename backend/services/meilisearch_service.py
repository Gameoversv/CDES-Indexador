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
        "text_content"
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
        "uploader_id"
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
        "upload_timestamp"
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
    except:
        pass
    
    try:
        version = client.get_version()
        if version:
            _meilisearch_available = True
            return True
    except:
        pass
    
    try:
        client.get_indexes()
        _meilisearch_available = True
        return True
    except:
        pass
    
    _meilisearch_available = False
    return False

def initialize_meilisearch() -> None:
    global client, _meilisearch_available
    
    try:
        client = Client(
            url=settings.MEILISEARCH_HOST,
            api_key=settings.MEILISEARCH_MASTER_KEY or None
        )
        
        if check_meilisearch_health():
            print("Meilisearch está disponible")
            _ensure_index_exists()
        else:
            print("Meilisearch no está disponible. Usando modo fallback.")
            
    except Exception as e:
        print(f"Error inicializando Meilisearch: {e}")
        print("El sistema funcionará en modo fallback usando archivos locales")
        _meilisearch_available = False


def _ensure_index_exists() -> None:
    if not _meilisearch_available or client is None:
        return
    
    try:
        existing_indices = client.get_indexes()
        index_names = []
        
        if isinstance(existing_indices, dict) and "results" in existing_indices:
            index_names = [idx.uid for idx in existing_indices["results"]]
        elif isinstance(existing_indices, list):
            index_names = [idx.uid for idx in existing_indices]
        
        if INDEX_NAME not in index_names:
            print(f"Creando índice '{INDEX_NAME}'...")
            task = client.create_index(uid=INDEX_NAME, options={"primaryKey": "id"})
            client.wait_for_task(task.task_uid)
            
        _configure_index()
        
    except Exception as e:
        print(f"Error configurando índice: {e}")


def _configure_index() -> None:
    if not _meilisearch_available or client is None:
        return
    
    try:
        index = client.index(INDEX_NAME)
        
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
                    
                client.wait_for_task(task.task_uid, timeout_ms=5000)
            except:
                pass
                
    except Exception as e:
        print(f"Error en configuración del índice: {e}")


def add_documents(documents: List[Dict[str, Any]]) -> bool:
    if not documents:
        return True
    
    if not check_meilisearch_health():
        print(f"Meilisearch no disponible. {len(documents)} documento(s) guardado(s) solo localmente.")
        return False
    
    try:
        index = client.index(INDEX_NAME)
        
        for doc in documents:
            if 'id' not in doc and 'file_id' in doc:
                doc['id'] = doc['file_id']
        
        task = index.add_documents(documents)
        
        try:
            client.wait_for_task(task.task_uid, timeout_ms=30000)
            print(f"{len(documents)} documento(s) indexado(s) en Meilisearch")
            return True
        except:
            # Si el timeout expira, asumir éxito (indexación asíncrona)
            print(f"{len(documents)} documento(s) enviado(s) a Meilisearch (procesamiento en segundo plano)")
            return True
            
    except Exception as e:
        print(f"Error indexando en Meilisearch: {e}")
        return False


def delete_document(document_id: str) -> bool:
    if not check_meilisearch_health():
        return False
    
    try:
        index = client.index(INDEX_NAME)
        task = index.delete_document(document_id)
        client.wait_for_task(task.task_uid, timeout_ms=5000)
        return True
    except:
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
            if 'id' not in doc and 'file_id' in doc:
                doc['id'] = doc['file_id']
                
        task = index.update_documents(documents)
        
        try:
            client.wait_for_task(task.task_uid, timeout_ms=30000)
            print(f"{len(documents)} documento(s) actualizado(s) en Meilisearch")
            return True
        except:
            # Si el timeout expira, asumir éxito (indexación asíncrona)
            print(f"{len(documents)} documento(s) enviado(s) a actualizar en Meilisearch (procesamiento en segundo plano)")
            return True
            
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

initialize_meilisearch()