from __future__ import annotations

import hashlib
import os
from datetime import datetime
from typing import Dict, List, Any, Optional, BinaryIO
import re

import firebase_admin
from firebase_admin import credentials, auth, firestore, storage
from firebase_admin.exceptions import FirebaseError
from google.cloud.firestore_v1.base_query import FieldFilter
from fastapi import Request, HTTPException

from config import settings

_firebase_initialized = False
_firebase_app = None

def initialize_firebase() -> None:
    global _firebase_initialized, _firebase_app
    
    if _firebase_initialized and _firebase_app:
        return
    
    try:
        import json

        if not firebase_admin._apps:
            # Usar el JSON directamente desde la variable de entorno
            cred = credentials.Certificate(json.loads(settings.FIREBASE_SERVICE_ACCOUNT_JSON))
            _firebase_app = firebase_admin.initialize_app(cred, {
                'storageBucket': settings.FIREBASE_STORAGE_BUCKET
            })
        else:
            _firebase_app = firebase_admin.get_app()

        _firebase_initialized = True
        print("Firebase inicializado correctamente")

    except Exception as e:
        raise Exception(f"Error inicializando Firebase: {e}")

def get_firestore_client():
    initialize_firebase()
    return firestore.client()

def get_auth_client():
    initialize_firebase()
    return auth

def get_storage_bucket():
    initialize_firebase()
    return storage.bucket(settings.FIREBASE_STORAGE_BUCKET)

def _dated_blob_path(filename: str) -> str:
    """Genera una ruta para el archivo sin estructura de fechas."""
    return filename

def calculate_file_hash(file_bytes: bytes) -> str:
    sha256 = hashlib.sha256()
    sha256.update(file_bytes)
    return sha256.hexdigest()

def check_file_hash(file_hash: str) -> Optional[Dict[str, Any]]:
    try:
        db = get_firestore_client()
        docs = db.collection("documents").where(
            filter=FieldFilter("hash", "==", file_hash)
        ).limit(1).stream()
        
        for doc in docs:
            data = doc.to_dict()
            return {"file_id": doc.id, **data}
        return None
    except Exception as e:
        print(f"Error verificando hash: {e}")
        return None

def get_file_version(filename: str) -> int:
    try:
        bucket = get_storage_bucket()
        base_name = os.path.splitext(filename)[0]
        extension = os.path.splitext(filename)[1]
        
        version_pattern = re.compile(rf"^{re.escape(base_name)}(?:_v(\d+))?{re.escape(extension)}$")
        
        max_version = 0
        blob_exists = False
        
        for blob in bucket.list_blobs():
            match = version_pattern.match(blob.name)
            if match:
                blob_exists = True
                version_str = match.group(1)
                if version_str:
                    version = int(version_str)
                    max_version = max(max_version, version)
                else:
                    max_version = max(max_version, 1)
        
        if blob_exists:
            return max_version + 1
        else:
            return 0
            
    except Exception as e:
        print(f"Error obteniendo versión del archivo: {e}")
        return 0

def generate_versioned_filename(original_filename: str) -> str:
    version = get_file_version(original_filename)
    
    if version == 0:
        return original_filename
    else:
        base_name = os.path.splitext(original_filename)[0]
        extension = os.path.splitext(original_filename)[1]
        return f"{base_name}_v{version}{extension}"

def update_parent_document_versions(parent_id: str, version_id: str, collection_name: str = "documents") -> None:
    try:
        db = get_firestore_client()
        parent_ref = db.collection(collection_name).document(parent_id)
        parent_doc = parent_ref.get()
        
        if not parent_doc.exists:
            print(f"Documento padre {parent_id} no encontrado")
            return
        
        parent_data = parent_doc.to_dict()
        versions = parent_data.get("versions", [])
        
        if version_id not in versions:
            versions.append(version_id)
            parent_ref.update({
                "versions": versions,
                "updated_at": datetime.utcnow().isoformat() + "Z"
            })
            
    except Exception as e:
        print(f"Error actualizando versiones del documento padre: {e}")

def save_document_metadata(
    file_id: str,
    metadata: Dict[str, Any],
    file_hash: str,
    version: int = 1,
    parent_id: Optional[str] = None
) -> None:
    try:
        db = get_firestore_client()
        
        # Determinar la colección basada en si el documento es público
        is_public = metadata.get("public", False)
        collection_name = "library" if is_public else "documents"
        
        doc_ref = db.collection(collection_name).document(file_id)
        
        doc_data = {
            **metadata,
            "file_id": file_id,
            "hash": file_hash,
            "version": version,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "updated_at": datetime.utcnow().isoformat() + "Z"
        }
        
        # Si es documento principal (versión 1), incluir array de versiones vacío
        if version == 1:
            doc_data["versions"] = []
        
        # Si tiene un documento padre, agregar referencia
        if parent_id:
            doc_data["parent_id"] = parent_id
        
        doc_ref.set(doc_data)
        
        # Si es una nueva versión, actualizar el documento padre
        if parent_id:
            # Usar la misma colección para actualizar el documento padre
            update_parent_document_versions(parent_id, file_id, collection_name)
                
    except Exception as e:
        print(f"Error guardando metadatos: {e}")
        raise

def log_event(user_id: str, action: str, details: Dict[str, Any]) -> None:
    try:
        db = get_firestore_client()
        event_ref = db.collection("events").document()
        event_ref.set({
            "user_id": user_id,
            "action": action,
            "details": details,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })
    except Exception as e:
        print(f"Error registrando evento: {e}")

def get_document_by_filename(filename: str) -> Optional[Dict[str, Any]]:
    try:
        db = get_firestore_client()
        docs = db.collection("documents").where(
            filter=FieldFilter("filename", "==", filename)
        ).stream()
        
        versions = []
        for doc in docs:
            doc_data = doc.to_dict()
            doc_data["id"] = doc.id
            versions.append(doc_data)
        
        return versions if versions else None
    except Exception as e:
        print(f"Error obteniendo documento por filename: {e}")
        return None

def get_document_by_stem(file_stem: str, collection_name: str = "documents") -> Optional[Dict[str, Any]]:
    try:
        db = get_firestore_client()
        doc_ref = db.collection(collection_name).document(file_stem)
        doc = doc_ref.get()
        
        if not doc.exists:
            return None
            
        doc_data = doc.to_dict()
        doc_data["id"] = doc.id
        return doc_data
    except Exception as e:
        print(f"Error obteniendo documento por stem: {e}")
        return None

def get_highest_version(file_stem: str, collection_name: str = "documents") -> int:
    try:
        db = get_firestore_client()
        doc_ref = db.collection(collection_name).document(file_stem)
        doc = doc_ref.get()
        
        if not doc.exists:
            return 0
            
        doc_data = doc.to_dict()
        versions = doc_data.get("versions", [])
        
        if not versions:
            return 1
            
        # Consultamos cada documento de versión para obtener su número
        max_version = 1  # El documento base es la versión 1
        
        for version_id in versions:
            try:
                version_ref = db.collection(collection_name).document(version_id)
                version_doc = version_ref.get()
                
                if version_doc.exists:
                    version_data = version_doc.to_dict()
                    version_num = version_data.get("version", 0)
                    if version_num > max_version:
                        max_version = version_num
            except:
                pass
                
        return max_version
    except Exception as e:
        print(f"Error obteniendo la versión más alta: {e}")
        return 0

def upload_file_to_storage(
    file_bytes: bytes,
    filename: str,
    content_type: Optional[str] = None,
) -> str:
    try:
        bucket = get_storage_bucket()
        # Use filename directly as it already contains the full path
        blob_path = filename
        blob = bucket.blob(blob_path)
        blob.upload_from_string(file_bytes, content_type=content_type)
        return blob_path
    except Exception as e:
        raise Exception(f"Error subiendo archivo: {e}")

def download_file_from_storage(blob_path: str) -> bytes:
    try:
        bucket = get_storage_bucket()
        blob = bucket.blob(blob_path)
        if not blob.exists():
            raise FileNotFoundError(f"Archivo no encontrado: {blob_path}")
        return blob.download_as_bytes()
    except Exception as e:
        raise Exception(f"Error descargando archivo: {e}")

def list_files_in_storage(prefix: str = "") -> List[Dict[str, Any]]:
    """Lista blobs de Storage incluyendo marcadores de carpeta (terminados en '/').
    Esto permite representar carpetas vacías en el árbol.
    """
    try:
        bucket = get_storage_bucket()
        files: List[Dict[str, Any]] = []

        # Lista todos los blobs que comienzan con el prefijo dado
        for blob in bucket.list_blobs(prefix=prefix):
            is_folder = blob.name.endswith("/")
            files.append({
                "path": blob.name,
                "filename": os.path.basename(blob.name.rstrip("/")) or blob.name.rstrip("/"),
                "size": 0 if is_folder else (blob.size or 0),
                "updated": blob.updated.isoformat() if getattr(blob, "updated", None) else None,
                "content_type": (blob.content_type or ("application/x-directory" if is_folder else "application/octet-stream")),
                "is_folder": is_folder,
            })

        # Para carpetas profundamente anidadas, necesitamos asegurarnos de que se incluyan todos los marcadores de carpeta intermedios
        # Extraer todos los directorios padres de las rutas de archivos para crear marcadores de carpeta
        folder_markers = set()
        for file_info in files:
            path = file_info.get("path", "")
            if not path:
                continue
                
            # Generar todos los marcadores de carpeta intermedios
            parts = path.split('/')
            for i in range(1, len(parts)):
                folder_path = '/'.join(parts[:i]) + '/'
                if folder_path.startswith(prefix) and folder_path not in folder_markers:
                    folder_markers.add(folder_path)
        
        # Agregar marcadores de carpeta para todas las carpetas intermedias que no existen explícitamente
        for folder_path in folder_markers:
            if not any(f.get("path") == folder_path for f in files):
                folder_name = os.path.basename(folder_path.rstrip("/")) or folder_path.rstrip("/")
                files.append({
                    "path": folder_path,
                    "filename": folder_name,
                    "size": 0,
                    "updated": None,
                    "content_type": "application/x-directory",
                    "is_folder": True,
                })

        return files
    except Exception as e:
        raise Exception(f"Error listando archivos: {e}")

def list_cover_images() -> List[Dict[str, Any]]:
    """Lista las imágenes de portada almacenadas en Biblioteca_Portadas/"""
    try:
        return list_files_in_storage("Biblioteca_Portadas/")
    except Exception as e:
        raise Exception(f"Error listando imágenes de portada: {e}")

def get_cover_image_url(image_path: str) -> str:
    """Genera una URL pública para una imagen de portada"""
    try:
        bucket = get_storage_bucket()
        blob = bucket.blob(image_path)
        
        # Genera una URL firmada válida por 1 hora
        from datetime import timedelta
        url = blob.generate_signed_url(expiration=timedelta(hours=1))
        return url
    except Exception as e:
        raise Exception(f"Error generando URL para imagen: {e}")

def delete_file_from_storage(blob_path: str) -> None:
    try:
        bucket = get_storage_bucket()
        blob = bucket.blob(blob_path)
        if not blob.exists():
            raise FileNotFoundError(f"Archivo no encontrado: {blob_path}")
        blob.delete()
    except Exception as e:
        raise Exception(f"Error eliminando archivo: {e}")

def get_documents_by_storage_path(storage_path: str) -> List[Dict[str, Any]]:
    """
    Busca documentos en Firestore que tengan un determinado storage_path.
    Busca tanto en la colección "documents" como en "library".
    
    Args:
        storage_path: Ruta del archivo en Firebase Storage
        
    Returns:
        Lista de documentos encontrados con ese storage_path
    """
    try:
        db = get_firestore_client()
        results = []
        
        # 1. Primero buscar por storage_path en la colección "documents"
        docs = db.collection("documents").where(filter=FieldFilter("storage_path", "==", storage_path)).stream()
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            results.append(data)
            
        # 2. También buscar por path en la colección "documents"
        docs = db.collection("documents").where(filter=FieldFilter("path", "==", storage_path)).stream()
        for doc in docs:
            # Evitar duplicados si ya lo encontramos por storage_path
            if any(r.get("id") == doc.id for r in results):
                continue
            data = doc.to_dict()
            data["id"] = doc.id
            results.append(data)
            
        # 3. Buscar en la colección "library" por storage_path
        docs = db.collection("library").where(filter=FieldFilter("storage_path", "==", storage_path)).stream()
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            results.append(data)
            
        # 4. También buscar por path en la colección "library"
        docs = db.collection("library").where(filter=FieldFilter("path", "==", storage_path)).stream()
        for doc in docs:
            # Evitar duplicados si ya lo encontramos por storage_path
            if any(r.get("id") == doc.id for r in results):
                continue
            data = doc.to_dict()
            data["id"] = doc.id
            results.append(data)
            
        # 5. Imprimir información sobre los resultados
        if results:
            print(f"Documentos encontrados para '{storage_path}': {len(results)}")
            for doc in results:
                print(f"- ID: {doc.get('id')}, Colección: {doc.get('collection', 'Desconocida')}")
        
        return results
    except Exception as e:
        print(f"Error buscando documentos por storage_path: {e}")
        return []

def delete_document_from_firestore(doc_id: str) -> bool:
    """
    Elimina un documento de Firestore por su ID.
    Busca primero en qué colección está el documento.
    
    Args:
        doc_id: ID del documento en Firestore
        
    Returns:
        True si la eliminación fue exitosa, False en caso contrario
    """
    try:
        db = get_firestore_client()
        
        # Intentar encontrar el documento en library primero
        library_doc = db.collection("library").document(doc_id).get()
        if library_doc.exists:
            db.collection("library").document(doc_id).delete()
            return True
        
        # Si no está en library, buscar en documents
        docs_doc = db.collection("documents").document(doc_id).get()
        if docs_doc.exists:
            db.collection("documents").document(doc_id).delete()
            return True
        
        # Documento no encontrado
        print(f"Documento {doc_id} no encontrado en ninguna colección")
        return False
        
    except Exception as e:
        print(f"Error eliminando documento de Firestore: {e}")
        return False

def get_documents_by_storage_path(storage_path: str) -> List[Dict[str, Any]]:
    """
    Busca documentos en Firestore que tengan un determinado storage_path.
    Busca tanto en la colección "documents" como en "library".
    
    Args:
        storage_path: Ruta del archivo en Firebase Storage
        
    Returns:
        Lista de documentos encontrados con ese storage_path
    """
    try:
        db = get_firestore_client()
        results = []
        
        # 1. Primero buscar por storage_path en la colección "documents"
        docs = db.collection("documents").where(filter=FieldFilter("storage_path", "==", storage_path)).stream()
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            results.append(data)
            
        # 2. También buscar por path en la colección "documents"
        docs = db.collection("documents").where(filter=FieldFilter("path", "==", storage_path)).stream()
        for doc in docs:
            # Evitar duplicados si ya lo encontramos por storage_path
            if any(r.get("id") == doc.id for r in results):
                continue
            data = doc.to_dict()
            data["id"] = doc.id
            results.append(data)
            
        # 3. Buscar en la colección "library" por storage_path
        docs = db.collection("library").where(filter=FieldFilter("storage_path", "==", storage_path)).stream()
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            results.append(data)
            
        # 4. También buscar por path en la colección "library"
        docs = db.collection("library").where(filter=FieldFilter("path", "==", storage_path)).stream()
        for doc in docs:
            # Evitar duplicados si ya lo encontramos por storage_path
            if any(r.get("id") == doc.id for r in results):
                continue
            data = doc.to_dict()
            data["id"] = doc.id
            results.append(data)
            
        # 5. Imprimir información sobre los resultados
        if results:
            print(f"Documentos encontrados para '{storage_path}': {len(results)}")
            for doc in results:
                print(f"- ID: {doc.get('id')}, Colección: {doc.get('collection', 'Desconocida')}")
        
        return results
    except Exception as e:
        print(f"Error buscando documentos por storage_path: {e}")
        return []

def delete_folder_from_storage(folder_path: str) -> Dict[str, Any]:
    """
    Elimina una carpeta y todo su contenido de Firebase Storage.
    
    Args:
        folder_path: Ruta de la carpeta, debe terminar con '/'
        
    Returns:
        Dict con información sobre la eliminación:
        - deleted_count: Número de archivos eliminados
        
    Raises:
        FileNotFoundError: Si la carpeta no existe
        Exception: Si hay errores durante la eliminación
    """
    if not folder_path.endswith('/'):
        folder_path = folder_path + '/'
    
    try:
        bucket = get_storage_bucket()
        blobs = list(bucket.list_blobs(prefix=folder_path))
        
        if not blobs:
            # Verificar si la carpeta existe como un blob marcador
            marker_blob = bucket.blob(folder_path)
            if marker_blob.exists():
                marker_blob.delete()
                return {"deleted_count": 1}
            else:
                raise FileNotFoundError(f"Carpeta no encontrada: {folder_path}")
        
        deleted_count = 0
        for blob in blobs:
            blob.delete()
            deleted_count += 1
            
        return {"deleted_count": deleted_count}
    except Exception as e:
        if "not found" in str(e).lower():
            raise FileNotFoundError(f"Carpeta no encontrada: {folder_path}")
        raise Exception(f"Error eliminando carpeta: {e}")

async def create_admin_user(email: str, password: str) -> Dict[str, Any]:
    try:
        auth_client = get_auth_client()
        user = auth_client.create_user(
            email=email,
            password=password,
            email_verified=True
        )
        auth_client.set_custom_user_claims(user.uid, {'admin': True})
        
        firestore_client = get_firestore_client()
        firestore_client.collection("users").document(user.uid).set({
            "uid": user.uid,
            "email": email,
            "role": "admin",
            "created_at": datetime.now().isoformat()
        })
        
        return {
            "uid": user.uid,
            "email": email,
            "admin": True,
            "created_at": datetime.now().isoformat()
        }
    except Exception as e:
        raise Exception(f"Error creando usuario admin: {e}")

def verify_token(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token faltante")
    
    id_token = auth_header.split("Bearer ")[1]
    
    try:
        auth_client = get_auth_client()
        decoded_token = auth_client.verify_id_token(id_token)
        return decoded_token
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")

def get_user_info(uid: str) -> Dict[str, Any]:
    try:
        auth_client = get_auth_client()
        user = auth_client.get_user(uid)
        return {
            "uid": user.uid,
            "email": user.email,
            "email_verified": user.email_verified,
            "disabled": user.disabled,
            "custom_claims": user.custom_claims or {},
            "creation_time": user.user_metadata.creation_timestamp,
            "last_sign_in": user.user_metadata.last_sign_in_timestamp
        }
    except Exception as e:
        raise Exception(f"Error obteniendo usuario: {e}")