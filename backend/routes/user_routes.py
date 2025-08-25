from typing import Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from typing import Literal

from services.firebase_admin_tools import auth
from services.firebase_service import verify_token, get_firestore_client
from utils.audit_logger import log_event as audit_log, log_error

router = APIRouter()

# ===========================================
#           UTILIDAD DE CONTEXTO
# ===========================================

def _ctx(request: Optional[Request], extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {
        **(extra or {}),
        "client_ip": (request.client.host if request and request.client else None),
        "user_agent": (request.headers.get("user-agent") if request else None),
        "route": (str(request.url.path) if request else None),
        "source": "api",
    }

# ===========================================
#             MODELOS DE DATOS
# ===========================================

class UserCreate(BaseModel):
    display_name: str
    email: EmailStr
    password: str
    role: Literal[
        "admin",
        "DireccionEjecutiva",
        "CoordinadorAdministrativa",
        "CoordinacionProyectosPlanificacion",
        "CoordinacionComunicaciones",
        "AsistenciaGeneral",
    ]
    status: Literal["active", "inactive"]

class UserUpdate(BaseModel):
    display_name: str
    role: Literal[
        "admin",
        "DireccionEjecutiva",
        "CoordinadorAdministrativa",
        "CoordinacionProyectosPlanificacion",
        "CoordinacionComunicaciones",
        "AsistenciaGeneral",
    ]
    status: Literal["active", "inactive"]

class PasswordChangeRequest(BaseModel):
    email: EmailStr
    new_password: str

# ===========================================
#             ENDPOINTS DE USUARIOS
# ===========================================

@router.get("/")
def list_users(request: Request, token_data=Depends(verify_token)):
    firestore = get_firestore_client()
    try:
        users_ref = firestore.collection("users")
        users = []
        for doc in users_ref.stream():
            user = doc.to_dict()
            user["id"] = doc.id
            users.append(user)

        audit_log(
            user_id=token_data["user_id"],
            event_type="CUSTOM_USERS_LISTED",
            details=_ctx(request, {"count": len(users)}),
            severity="INFO",
        )
        return users
    except Exception as e:
        log_error(e, "GET_/users", user_id=token_data["user_id"], additional_details=_ctx(request))
        raise HTTPException(status_code=500, detail="Error listando usuarios")


@router.post("/")
def create_user(request: Request, data: UserCreate, token_data=Depends(verify_token)):
    try:
        user_record = auth.create_user(
            email=data.email,
            password=data.password,
            display_name=data.display_name,
            disabled=(data.status != "active"),
        )
        # Asignar admin si corresponde
        if data.role == "admin":
            auth.set_custom_user_claims(user_record.uid, {"admin": True})

    except Exception as e:
        log_error(
            e,
            "POST_/users (firebase create_user)",
            user_id=token_data["user_id"],
            additional_details=_ctx(request, {"target_email": data.email})
        )
        raise HTTPException(status_code=400, detail=f"Firebase Auth error: {e}")

    # Guardar en Firestore
    firestore = get_firestore_client()
    doc = firestore.collection("users").document()
    doc.set({
        "uid": user_record.uid,
        "display_name": data.display_name,
        "email": data.email,
        "role": data.role,
        "status": data.status
    })

    # Logs de auditoría
    audit_log(
        event_type="USER_REGISTERED",
        user_id=token_data["user_id"],
        severity="INFO",
        details=_ctx(request, {
            "target_uid": user_record.uid,
            "target_email": data.email,
            "role": data.role
        })
    )
    if data.role == "admin":
        audit_log(
            event_type="USER_PROMOTED_TO_ADMIN",
            user_id=token_data["user_id"],
            severity="WARNING",
            details=_ctx(request, {
                "target_uid": user_record.uid,
                "target_email": data.email
            })
        )

    return {"message": "Usuario creado", "id": doc.id}


@router.put("/{id}")
def update_user(request: Request, id: str, data: UserUpdate, token_data=Depends(verify_token)):
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
        # Manejo de claims admin según rol
        if data.role == "admin":
            auth.set_custom_user_claims(uid, {"admin": True})
        else:
            auth.set_custom_user_claims(uid, {})

    except Exception as e:
        log_error(
            e,
            "PUT_/users/{id} (firebase update_user)",
            user_id=token_data["user_id"],
            additional_details=_ctx(request, {"target_uid": uid, "target_email": email})
        )
        raise HTTPException(status_code=400, detail=f"Firebase Auth error: {e}")

    # Actualizar Firestore
    previous_role = existing.get("role")
    doc_ref.update({
        "display_name": data.display_name,
        "role": data.role,
        "status": data.status
    })

    # Logs de auditoría
    audit_log(
        event_type="CUSTOM_USER_UPDATED",
        user_id=token_data["user_id"],
        severity="INFO",
        details=_ctx(request, {
            "target_uid": uid,
            "target_email": email,
            "old_role": previous_role,
            "new_role": data.role,
            "status": data.status
        })
    )
    if previous_role != "admin" and data.role == "admin":
        audit_log(
            event_type="USER_PROMOTED_TO_ADMIN",
            user_id=token_data["user_id"],
            severity="WARNING",
            details=_ctx(request, {
                "target_uid": uid,
                "target_email": email
            })
        )
    if previous_role == "admin" and data.role != "admin":
        audit_log(
            event_type="CUSTOM_ADMIN_REVOKED",
            user_id=token_data["user_id"],
            severity="WARNING",
            details=_ctx(request, {
                "target_uid": uid,
                "target_email": email,
                "new_role": data.role
            })
        )

    return {"message": "Usuario actualizado"}


@router.delete("/{id}")
def delete_user(request: Request, id: str, token_data=Depends(verify_token)):
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
        except Exception as e:
            log_error(
                e,
                "DELETE_/users/{id} (firebase delete_user)",
                user_id=token_data["user_id"],
                additional_details=_ctx(request, {"target_uid": uid, "target_email": email})
            )
            # No hacemos raise aquí: igual intentamos borrar en Firestore

    doc_ref.delete()

    audit_log(
        event_type="CUSTOM_USER_DELETED",
        user_id=token_data["user_id"],
        severity="WARNING",
        details=_ctx(request, {
            "target_uid": uid,
            "target_email": email
        })
    )

    return {"message": "Usuario eliminado"}


@router.post("/change-password")
def change_password(request: Request, data: PasswordChangeRequest, token_data=Depends(verify_token)):
    try:
        user_record = auth.get_user_by_email(data.email)
        auth.update_user(user_record.uid, password=data.new_password)
    except Exception as e:
        log_error(
            e,
            "POST_/users/change-password",
            user_id=token_data["user_id"],
            additional_details=_ctx(request, {"target_email": data.email})
        )
        raise HTTPException(status_code=400, detail=f"Firebase Auth error: {e}")

    # ⚠️ Nunca guardar contraseñas en Firestore

    audit_log(
        event_type="CUSTOM_PASSWORD_CHANGED",
        user_id=token_data["user_id"],
        severity="INFO",
        details=_ctx(request, {
            "target_uid": user_record.uid,
            "target_email": data.email
        })
    )

    return {"message": "Contraseña actualizada correctamente"}
