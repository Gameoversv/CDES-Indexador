from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request

from services.security import verify_firebase_token
from services.firebase_admin_tools import db
from utils.audit_logger import log_event, log_error

router = APIRouter()


# ===============================
# Utilidad: contexto para logs
# ===============================

def _ctx(request: Optional[Request], extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Devuelve un diccionario con metadatos útiles para auditoría.
    """
    return {
        **(extra or {}),
        "client_ip": (request.client.host if request and request.client else None),
        "user_agent": (request.headers.get("user-agent") if request else None),
        "route": (str(request.url.path) if request else None),
        "source": "api",
    }


# ===============================
# Endpoint: perfil del usuario autenticado
# ===============================

@router.get("/me")
async def get_me(request: Request, token_data=Depends(verify_firebase_token)):
    """
    Devuelve los datos consolidados del usuario autenticado.
    Deja trazas de:
      - Usuario no registrado en Firestore
      - Perfil incompleto (falta role/username)
      - Consulta exitosa
      - Error inesperado
    """
    uid = token_data["user_id"]

    try:
        user_ref = db.collection("users").document(uid)
        doc = user_ref.get()

        if not doc.exists:
            log_event(
                user_id=uid,
                event_type="USER_NOT_IN_FIRESTORE",
                details=_ctx(request),
                severity="WARNING",
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no registrado en Firestore",
            )

        user_data = doc.to_dict() or {}

        if "role" not in user_data or "username" not in user_data:
            log_event(
                user_id=uid,
                event_type="USER_PROFILE_INCOMPLETE",
                details=_ctx(request, {"fields_present": list(user_data.keys())}),
                severity="WARNING",
            )
            raise HTTPException(
                status_code=400,
                detail="El usuario no tiene rol o username definido",
            )

        # Éxito
        log_event(
            user_id=uid,
            event_type="USERS_ME_QUERIED",
            details=_ctx(request, {"role": user_data.get("role")}),
            severity="INFO",
        )

        return {
            "user_id": uid,
            "email": token_data.get("email"),
            "username": user_data["username"],
            "role": user_data["role"],
            "custom_claims": token_data.get("custom_claims", {}),
            "admin": (
                user_data["role"] == "admin"
                or token_data.get("custom_claims", {}).get("admin") is True
            ),
        }

    except HTTPException:
        # ya se registró el evento correspondiente
        raise
    except Exception as e:
        # error inesperado con stack trace
        log_error(
            error=e,
            context="GET_/me",
            user_id=uid,
            additional_details=_ctx(request),
        )
        raise HTTPException(status_code=500, detail="Error interno")


# ===============================
# Helpers de identidad y rol
# ===============================

def get_current_user(token_data=Depends(verify_firebase_token)):
    """
    Devuelve el token decodificado como identidad actual.
    (Las rutas que lo usen deberían registrar sus propios eventos.)
    """
    return token_data


async def get_current_admin_user(request: Request, token_data=Depends(verify_firebase_token)):
    """
    Valida privilegios de administrador.
    Registra:
      - ADMIN_ACCESS_DENIED cuando no cumple
      - ADMIN_ACCESS_GRANTED cuando cumple
    """
    is_admin = (
        token_data.get("role") == "admin"
        or token_data.get("custom_claims", {}).get("role") == "admin"
        or token_data.get("admin") is True
        or token_data.get("custom_claims", {}).get("admin") is True
    )

    if not is_admin:
        log_event(
            user_id=token_data.get("user_id"),
            event_type="ADMIN_ACCESS_DENIED",
            details=_ctx(request),
            severity="WARNING",
        )
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos de administrador",
        )

    log_event(
        user_id=token_data.get("user_id"),
        event_type="ADMIN_ACCESS_GRANTED",
        details=_ctx(request),
        severity="INFO",
    )
    return token_data
