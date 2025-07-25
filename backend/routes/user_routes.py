from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Literal
from services.firebase_admin_tools import auth
from services.firebase_service import verify_token, get_firestore_client
from utils.audit_logger import log_event  # ✅ Importación correcta

import time

router = APIRouter()

# ===========================================
#             MODELOS DE DATOS
# ===========================================

class UserCreate(BaseModel):
    display_name: str
    email: EmailStr
    password: str
    role: Literal["admin", "secretaria", "supervisor"]
    status: Literal["active", "inactive"]

class UserUpdate(BaseModel):
    display_name: str
    role: Literal["admin", "secretaria", "supervisor"]
    status: Literal["active", "inactive"]

class PasswordChangeRequest(BaseModel):
    email: EmailStr
    new_password: str

# ===========================================
#             ENDPOINTS DE USUARIOS
# ===========================================

@router.get("/")
def list_users(token_data=Depends(verify_token)):
    firestore = get_firestore_client()
    users_ref = firestore.collection("users")
    users = []
    for doc in users_ref.stream():
        user = doc.to_dict()
        user["id"] = doc.id
        users.append(user)
    return users

@router.post("/")
def create_user(data: UserCreate, token_data=Depends(verify_token)):
    try:
        user_record = auth.create_user(
            email=data.email,
            password=data.password,
            display_name=data.display_name,
            disabled=(data.status != "active"),
        )
        # Asignar claim si es admin
        if data.role == "admin":
            auth.set_custom_user_claims(user_record.uid, {"admin": True})

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Firebase Auth error: {e}")

    firestore = get_firestore_client()
    doc = firestore.collection("users").document()
    doc.set({
        "uid": user_record.uid,
        "display_name": data.display_name,
        "email": data.email,
        "role": data.role,
        "status": data.status
    })

    # Registrar en logs
    log_event(
        event_type="user_created",
        user_id=token_data["user_id"],
        severity="INFO",
        details={"email": data.email, "role": data.role}
    )

    return {"message": "Usuario creado", "id": doc.id}

@router.put("/{id}")
def update_user(id: str, data: UserUpdate, token_data=Depends(verify_token)):
    firestore = get_firestore_client()
    doc_ref = firestore.collection("users").document(id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    existing = doc.to_dict()
    email = existing.get("email")
    uid = existing.get("uid")
    if not email or not uid:
        raise HTTPException(status_code=400, detail="Usuario sin email o uid válido")

    try:
        auth.update_user(
            uid,
            display_name=data.display_name,
            disabled=(data.status != "active")
        )
        if data.role == "admin":
            auth.set_custom_user_claims(uid, {"admin": True})
        else:
            auth.set_custom_user_claims(uid, {})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Firebase Auth error: {e}")

    doc_ref.update({
        "display_name": data.display_name,
        "role": data.role,
        "status": data.status
    })

    # Registrar en logs
    log_event(
        event_type="user_updated",
        user_id=token_data["user_id"],
        severity="INFO",
        details={"user_id_updated": uid, "new_role": data.role}
    )

    return {"message": "Usuario actualizado"}

@router.delete("/{id}")
def delete_user(id: str, token_data=Depends(verify_token)):
    firestore = get_firestore_client()
    doc_ref = firestore.collection("users").document(id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user_data = doc.to_dict()
    email = user_data.get("email")
    uid = user_data.get("uid")

    if email and uid:
        try:
            auth.delete_user(uid)
        except Exception:
            pass  # Puede que ya esté eliminado

    doc_ref.delete()

    # Registrar en logs
    log_event(
        event_type="user_deleted",
        user_id=token_data["user_id"],
        severity="WARNING",
        details={"email": email, "uid": uid}
    )

    return {"message": "Usuario eliminado"}

@router.post("/change-password")
def change_password(data: PasswordChangeRequest, token_data=Depends(verify_token)):
    try:
        user_record = auth.get_user_by_email(data.email)
        auth.update_user(user_record.uid, password=data.new_password)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Firebase Auth error: {e}")

    firestore = get_firestore_client()
    docs = firestore.collection("users").where("email", "==", data.email).limit(1).stream()
    doc = next(docs, None)
    if doc:
        doc.reference.update({"password": data.new_password})  # opcional

    # Registrar en logs
    log_event(
        event_type="password_changed",
        user_id=token_data["user_id"],
        severity="INFO",
        details={"email_target": data.email}
    )

    return {"message": "Contraseña actualizada correctamente"}
