from typing import Optional, Dict, Any
import unicodedata
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
    """Devuelve datos consolidados del usuario autenticado (Firestore + token).

    Cambios respecto a la versión anterior:
      - Se intenta localizar el documento tanto por ID (uid) como por el campo 'uid'
      - Se admite 'display_name' o 'username' (alias) para máxima compatibilidad
      - No se crean NUEVOS tipos de eventos de auditoría: se mantienen los existentes
      - El evento USERS_ME_QUERIED conserva su nombre; solo se enriquece el detalle
    """
    uid = token_data["user_id"]

    try:
        # 1. Intentar documento con id == uid
        user_doc = db.collection("users").document(uid).get()
        firestore_user = None

        if user_doc.exists:
            firestore_user = user_doc.to_dict() or {}
        else:
            # 2. Buscar por campo 'uid' (patrón usado en creación aleatoria de ID)
            query = db.collection("users").where("uid", "==", uid).limit(1).stream()
            for doc in query:
                firestore_user = doc.to_dict() or {}
                break

        if not firestore_user:
            log_event(
                user_id=uid,
                event_type="USER_NOT_IN_FIRESTORE",
                details=_ctx(request),
                severity="WARNING",
            )
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no registrado en Firestore")

        # Normalizar campos: aceptar display_name o username
        display_name = (
            firestore_user.get("display_name")
            or firestore_user.get("username")
            or token_data.get("email", "").split("@")[0]
        )
        role = firestore_user.get("role") or token_data.get("role")

        if not role or not display_name:
            log_event(
                user_id=uid,
                event_type="USER_PROFILE_INCOMPLETE",
                details=_ctx(request, {"fields_present": list(firestore_user.keys())}),
                severity="WARNING",
            )
            raise HTTPException(status_code=400, detail="El usuario no tiene rol o nombre visible definido")

        # Éxito (mismo tipo de evento existente)
        log_event(
            user_id=uid,
            event_type="USERS_ME_QUERIED",
            details=_ctx(request, {"role": role}),
            severity="INFO",
        )

        # Respuesta extendida manteniendo compatibilidad hacia atrás
        # Determinación de privilegio admin: ahora basado en rol "direccion ejecutiva" (case-insensitive)
        def _norm(text: Optional[str]) -> str:
            if not isinstance(text, str):
                return ""
            # Quitar acentos y pasar a minúsculas
            return unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode("utf-8").lower().strip()

        is_admin_role = _norm(role) == "direccion ejecutiva"
        return {
            "user_id": uid,
            "email": token_data.get("email"),
            "display_name": display_name,
            "username": display_name,  # alias para código legacy
            "role": role,
            "status": firestore_user.get("status"),
            "custom_claims": token_data.get("custom_claims", {}),
            "admin": (
                is_admin_role
                or token_data.get("admin") is True
                or token_data.get("custom_claims", {}).get("admin") is True
            ),
        }

    except HTTPException:
        raise
    except Exception as e:
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
    role_value = token_data.get("role") or token_data.get("custom_claims", {}).get("role")
    def _norm(text: Optional[str]) -> str:
        if not isinstance(text, str):
            return ""
        return unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode("utf-8").lower().strip()
    is_admin = (
        _norm(role_value) == "direccion ejecutiva"
        or token_data.get("admin") is True
        or token_data.get("custom_claims", {}).get("admin") is True
    )

    # Fallback: si no es admin aún, consulta Firestore para rol actualizado
    if not is_admin:
        try:
            uid = token_data.get("user_id")
            if uid:
                user_doc = db.collection("users").document(uid).get()
                fs_user = None
                if user_doc.exists:
                    fs_user = user_doc.to_dict() or {}
                else:
                    query = db.collection("users").where("uid", "==", uid).limit(1).stream()
                    for d in query:
                        fs_user = d.to_dict() or {}
                        break
                if fs_user:
                    fs_role = fs_user.get("role")
                    if _norm(fs_role) == "direccion ejecutiva":
                        is_admin = True
                        token_data["role"] = fs_role  # enriquecer para la request actual
        except Exception:
            pass

    if not is_admin:
        log_event(
            user_id=token_data.get("user_id"),
            event_type="ADMIN_ACCESS_DENIED",
            details=_ctx(request, {
                "role_value": role_value,
                "claims_admin": token_data.get("custom_claims", {}).get("admin"),
                "token_admin": token_data.get("admin"),
            }),
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
