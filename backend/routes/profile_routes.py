# routes/profile_routes.py
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, status

from services.firebase_service import verify_token, get_firestore_client
from utils.audit_logger import log_event as audit_log, log_error

router = APIRouter()

# ===============================
# Utilidad: contexto para logs
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
# Endpoint
# ===============================

@router.get("/users/me")
async def get_logged_user(request: Request, token_data=Depends(verify_token)):
    """
    Devuelve los datos del usuario autenticado usando su UID de Firebase.
    Registra auditoría para éxito, usuario inexistente y errores inesperados.
    """
    uid = token_data["user_id"]
    email = token_data.get("email", "")
    firestore = get_firestore_client()

    try:
        doc_ref = firestore.collection("users").document(uid)
        doc = doc_ref.get()

        if not doc.exists:
            # Log de advertencia: usuario no presente en Firestore
            audit_log(
                user_id=uid,
                event_type="USER_NOT_IN_FIRESTORE",
                details=_ctx(request, {"token_email": email}),
                severity="WARNING",
            )
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

        user_data = doc.to_dict() or {}
        user_data["id"] = doc.id

        # Log de acceso exitoso al perfil
        audit_log(
            user_id=uid,
            event_type="USERS_ME_QUERIED",
            details=_ctx(request, {
                "token_email": email,
                "fields_returned": list(user_data.keys())
            }),
            severity="INFO",
        )

        return user_data

    except HTTPException:
        # Ya se registró el caso de no encontrado; re-lanzar tal cual
        raise
    except Exception as e:
        # Error inesperado con stack trace
        log_error(
            error=e,
            context="GET_/users/me",
            user_id=uid,
            additional_details=_ctx(request, {"token_email": email}),
        )
        raise HTTPException(status_code=500, detail="Error interno")
