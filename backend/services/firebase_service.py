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
        base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        service_account_path = os.path.join(base_path, settings.FIREBASE_SERVICE_ACCOUNT_KEY_PATH)

        if not os.path.exists(service_account_path):
            raise FileNotFoundError(f"Archivo de credenciales no encontrado: {service_account_path}")

        if not firebase_admin._apps:
            cred = credentials.Certificate(service_account_path)
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
    """Genera una ruta con fecha para el archivo."""
    today = datetime.now()
    return f"documents/{today.year:04d}/{today.month:02d}/{today.day:02d}/{filename}"

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

def update_parent_document_versions(parent_id: str, version_id: str) -> None:
    try:
        db = get_firestore_client()
        parent_ref = db.collection("documents").document(parent_id)
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
        doc_ref = db.collection("documents").document(file_id)
        
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
            update_parent_document_versions(parent_id, file_id)
                
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

def get_document_by_stem(file_stem: str) -> Optional[Dict[str, Any]]:
    try:
        db = get_firestore_client()
        doc_ref = db.collection("documents").document(file_stem)
        doc = doc_ref.get()
        
        if not doc.exists:
            return None
            
        doc_data = doc.to_dict()
        doc_data["id"] = doc.id
        return doc_data
    except Exception as e:
        print(f"Error obteniendo documento por stem: {e}")
        return None

def get_highest_version(file_stem: str) -> int:
    try:
        db = get_firestore_client()
        doc_ref = db.collection("documents").document(file_stem)
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
                version_ref = db.collection("documents").document(version_id)
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
        versioned_filename = generate_versioned_filename(filename)
        blob_path = _dated_blob_path(versioned_filename)
        blob = bucket.blob(blob_path)
        blob.upload_from_string(file_bytes, content_type=content_type)
        return blob_path
    except Exception as e:
        raise Exception(f"Error subiendo archivo: {e}")


def upload_file_to_custom_path(
    file_bytes: bytes,
    custom_path: str,
    content_type: Optional[str] = None,
) -> str:
    """
    Sube archivo a Firebase Storage usando una ruta personalizada específica.
    NO agrega fechas automáticas ni versionado - usa la ruta exacta proporcionada.
    """
    try:
        bucket = get_storage_bucket()
        blob = bucket.blob(custom_path)
        blob.upload_from_string(file_bytes, content_type=content_type)
        
        print(f"✅ Archivo subido a ruta personalizada: {custom_path}")
        return custom_path
        
    except Exception as e:
        raise Exception(f"Error subiendo archivo a ruta personalizada: {e}")


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
    try:
        bucket = get_storage_bucket()
        files = []
        
        for blob in bucket.list_blobs(prefix=prefix):
            if not blob.name.endswith("/"):
                files.append({
                    "path": blob.name,
                    "filename": os.path.basename(blob.name),
                    "size": blob.size or 0,
                    "updated": blob.updated.isoformat() if blob.updated else None,
                    "content_type": blob.content_type or "application/octet-stream"
                })
                
        return files
    except Exception as e:
        raise Exception(f"Error listando archivos: {e}")

def delete_file_from_storage(blob_path: str) -> None:
    try:
        bucket = get_storage_bucket()
        blob = bucket.blob(blob_path)
        if not blob.exists():
            raise FileNotFoundError(f"Archivo no encontrado: {blob_path}")
        blob.delete()
    except Exception as e:
        raise Exception(f"Error eliminando archivo: {e}")

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