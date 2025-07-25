"""
Servicio de Firebase - Integración con Firebase Admin SDK

Este módulo maneja toda la integración con los servicios de Firebase,
incluyendo funcionalidades de hashing y versionado de documentos.
"""

import hashlib
import os
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional

import firebase_admin
from firebase_admin import credentials, auth, firestore, storage
from firebase_admin.exceptions import FirebaseError
from fastapi import Request, HTTPException

from config import settings

# Variables globales
_firebase_initialized = False
_firebase_app = None

def initialize_firebase() -> None:
    """Inicializa Firebase Admin SDK de forma segura."""
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
    """Obtiene el cliente de Firestore."""
    initialize_firebase()
    return firestore.client()

def get_auth_client():
    """Obtiene el cliente de Auth."""
    initialize_firebase()
    return auth

def get_storage_bucket():
    """Obtiene el bucket de Storage."""
    initialize_firebase()
    # Explicitly specify bucket name in case default is not set correctly
    return storage.bucket(settings.FIREBASE_STORAGE_BUCKET)

def _dated_blob_path(filename: str) -> str:
    """Genera una ruta con fecha para el archivo."""
    today = datetime.now()
    return f"documents/{today.year:04d}/{today.month:02d}/{today.day:02d}/{filename}"

def calculate_file_hash(file_bytes: bytes) -> str:
    """Calcula el hash SHA256 de un archivo."""
    sha256 = hashlib.sha256()
    sha256.update(file_bytes)
    return sha256.hexdigest()

def check_file_hash(file_hash: str) -> Optional[Dict[str, Any]]:
    """Verifica si un hash de archivo ya existe."""
    try:
        db = get_firestore_client()
        docs = db.collection("documents").where("hash", "==", file_hash).limit(1).stream()
        for doc in docs:
            data = doc.to_dict()
            return {"file_id": doc.id, **data}
        return None
    except Exception as e:
        print(f"Error verificando hash: {e}")
        return None

def get_highest_version(file_id_base: str) -> int:
    """Obtiene la versión más alta de un documento."""
    try:
        db = get_firestore_client()
        docs = db.collection("documents").where("file_id_base", "==", file_id_base).stream()
        
        max_version = 0
        for doc in docs:
            doc_data = doc.to_dict()
            version = doc_data.get("version", 1)
            if version > max_version:
                max_version = version
        
        return max_version
    except Exception as e:
        print(f"Error obteniendo versión: {e}")
        return 0

def save_document_metadata(
    file_id: str,
    metadata: Dict[str, Any],
    file_hash: str,
    version: int,
    parent_id: Optional[str] = None
) -> None:
    """Guarda metadatos de documento en Firestore."""
    try:
        db = get_firestore_client()
        doc_ref = db.collection("documents").document(file_id)
        
        doc_data = {
            **metadata,
            "file_id": file_id,
            "hash": file_hash,
            "version": version,
            "parent_id": parent_id,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "updated_at": datetime.utcnow().isoformat() + "Z"
        }
        
        doc_ref.set(doc_data)
        
        # Si es una nueva versión, actualizar el documento padre
        if parent_id and version > 1:
            parent_ref = db.collection("documents").document(parent_id)
            parent_doc = parent_ref.get()
            if parent_doc.exists:
                versions = parent_doc.to_dict().get("versions", [])
                versions.append({
                    "version": version,
                    "file_id": file_id,
                    "created_at": doc_data["created_at"]
                })
                parent_ref.update({"versions": versions})
                
    except Exception as e:
        print(f"Error guardando metadatos: {e}")
        raise

def log_event(user_id: str, action: str, details: Dict[str, Any]) -> None:
    """Registra un evento en Firestore."""
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

def get_document_versions(file_id_base: str) -> List[Dict[str, Any]]:
    """Obtiene todas las versiones de un documento."""
    try:
        db = get_firestore_client()
        docs = db.collection("documents").where("file_id_base", "==", file_id_base).stream()
        
        versions = []
        for doc in docs:
            doc_data = doc.to_dict()
            versions.append({
                "version": doc_data.get("version", 1),
                "file_id": doc.id,
                "created_at": doc_data.get("created_at"),
                "file_size": doc_data.get("file_size_bytes"),
                "hash": doc_data.get("hash")
            })
        
        return sorted(versions, key=lambda x: x["version"])
    except Exception as e:
        print(f"Error obteniendo versiones: {e}")
        return []

def upload_file_to_storage(
    file_bytes: bytes,
    filename: str,
    content_type: Optional[str] = None,
) -> str:
    """Sube un archivo a Firebase Storage."""
    try:
        bucket = get_storage_bucket()
        blob_path = _dated_blob_path(filename)
        blob = bucket.blob(blob_path)
        blob.upload_from_string(file_bytes, content_type=content_type)
        return blob_path
    except Exception as e:
        raise Exception(f"Error subiendo archivo: {e}")

def download_file_from_storage(blob_path: str) -> bytes:
    """Descarga un archivo desde Firebase Storage."""
    try:
        bucket = get_storage_bucket()
        blob = bucket.blob(blob_path)
        if not blob.exists():
            raise FileNotFoundError(f"Archivo no encontrado: {blob_path}")
        return blob.download_as_bytes()
    except Exception as e:
        raise Exception(f"Error descargando archivo: {e}")

def list_files_in_storage(prefix: str = "documents/") -> List[Dict[str, Any]]:
    """Lista archivos en Firebase Storage."""
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
    """Elimina un archivo de Firebase Storage."""
    try:
        bucket = get_storage_bucket()
        blob = bucket.blob(blob_path)
        if not blob.exists():
            raise FileNotFoundError(f"Archivo no encontrado: {blob_path}")
        blob.delete()
    except Exception as e:
        raise Exception(f"Error eliminando archivo: {e}")

async def create_admin_user(email: str, password: str) -> Dict[str, Any]:
    """Crea un usuario administrador."""
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
    """Middleware para verificar tokens de Firebase."""
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
    """Obtiene información de un usuario."""
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