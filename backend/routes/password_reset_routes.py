from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Dict, Any
import logging
import datetime

from services.email_service import email_service
from utils.audit_logger import log_event

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/auth",
    tags=["recuperación de contraseña"]
)

class PasswordResetRequest(BaseModel):
    email: EmailStr
    user_name: str = None

class PasswordResetResponse(BaseModel):
    success: bool
    message: str
    error_type: str = None  # ← Nuevo campo para tipo de error

@router.post("/request-password-reset", response_model=PasswordResetResponse)
async def request_password_reset(request: PasswordResetRequest):
    """
    Envía una solicitud de cambio de contraseña al administrador.
    """
    try:
        logger.info(f"Solicitud de reset de contraseña para: {request.email}")
        
        # Log de auditoría
        try:
            log_event(
                user_id=request.email,
                event_type="PASSWORD_RESET_REQUEST",
                details={
                    "user_name": request.user_name or "No especificado",
                    "timestamp": datetime.datetime.now().isoformat()
                },
                severity="INFO"
            )
        except Exception as log_error:
            logger.warning(f"Error en log_event: {log_error}")
        
        # Usar el servicio de email
        try:
            result = await email_service.send_password_reset_request(
                user_email=request.email,
                user_name=request.user_name or "No especificado"
            )
        except Exception as email_error:
            logger.error(f"Error en email_service: {email_error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error interno del servicio de email"
            )
        
        if result.get("success", True):
            # Log de éxito
            try:
                log_event(
                    user_id=request.email,
                    event_type="PASSWORD_RESET_EMAIL_SENT",
                    details={
                        "admin_email": "admin@ejemplo.com",
                        "status": "success",
                        "timestamp": datetime.datetime.now().isoformat()
                    },
                    severity="INFO"
                )
            except Exception as log_error:
                logger.warning(f"Error logging éxito: {log_error}")
            
            return PasswordResetResponse(
                success=True,
                message="Tu solicitud ha sido enviada al administrador. Te contactaremos pronto."
            )
        else:
            error_message = result.get("message", "Error desconocido")
            
            # ✅ DETECTAR TIPO DE ERROR ESPECÍFICO
            error_type = None
            if "rate limit" in error_message.lower() or "demasiadas solicitudes" in error_message.lower():
                error_type = "RATE_LIMIT_EXCEEDED"
            elif "dominio no autorizado" in error_message.lower():
                error_type = "UNAUTHORIZED_DOMAIN"
            elif "smtp" in error_message.lower() or "credenciales" in error_message.lower():
                error_type = "EMAIL_SERVICE_ERROR"
            else:
                error_type = "UNKNOWN_ERROR"
            
            # Log de error específico
            try:
                log_event(
                    user_id=request.email,
                    event_type="PASSWORD_RESET_EMAIL_FAILED",
                    details={
                        "admin_email": "admin@ejemplo.com",
                        "status": "failed",
                        "error": error_message,
                        "error_type": error_type,
                        "timestamp": datetime.datetime.now().isoformat()
                    },
                    severity="WARNING"
                )
            except Exception as log_error:
                logger.warning(f"Error logging fallo: {log_error}")
            
            # ✅ RETORNAR ERROR ESPECÍFICO EN LUGAR DE EXCEPTION
            return PasswordResetResponse(
                success=False,
                message=error_message,
                error_type=error_type
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error procesando solicitud de reset: {e}")
        
        # Log de error crítico
        try:
            log_event(
                user_id=request.email,
                event_type="PASSWORD_RESET_ERROR",
                details={
                    "error": str(e),
                    "status": "critical_error",
                    "timestamp": datetime.datetime.now().isoformat()
                },
                severity="ERROR"
            )
        except Exception as log_error:
            logger.warning(f"Error logging error crítico: {log_error}")
        
        return PasswordResetResponse(
            success=False,
            message="Error interno procesando la solicitud",
            error_type="INTERNAL_SERVER_ERROR"
        )

@router.get("/password-reset-status")
async def get_password_reset_info():
    """
    Información sobre el proceso de recuperación de contraseña.
    """
    return {
        "process": "manual_admin_approval",
        "admin_email": "admin@ejemplo.com",
        "estimated_response_time": "24-48 horas",
        "rate_limit": {
            "max_requests": 5,
            "time_window": "1 hora",
            "reset_time": "cada hora en punto"
        },
        "contact_info": {
            "phone": "+1-809-XXX-XXXX",
            "office_hours": "Lunes a Viernes, 8:00 AM - 5:00 PM"
        },
        "steps": [
            "1. Usuario completa formulario de solicitud",
            "2. Administrador recibe notificación por email",
            "3. Administrador verifica identidad del usuario",
            "4. Administrador genera nueva contraseña temporal",
            "5. Usuario recibe nueva contraseña por email o teléfono"
        ]
    }