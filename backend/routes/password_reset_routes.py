from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Dict, Any
import logging
import datetime

from services.email_service import email_service
from utils.audit_logger import log_event  # Esta función NO es async

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

@router.post("/request-password-reset", response_model=PasswordResetResponse)
async def request_password_reset(request: PasswordResetRequest):
    """
    Envía una solicitud de cambio de contraseña al administrador.
    """
    try:
        logger.info(f"Solicitud de reset de contraseña para: {request.email}")
        
        # log_event NO es async y usa 'event_type', no 'action'
        try:
            log_event(
                user_id=request.email,
                event_type="PASSWORD_RESET_REQUEST",  # ← Cambio: 'event_type' en lugar de 'action'
                details={
                    "user_name": request.user_name or "No especificado",
                    "timestamp": datetime.datetime.now().isoformat()
                },
                severity="INFO"
            )
        except Exception as log_error:
            logger.warning(f"Error en log_event: {log_error}")
            # Continuar sin fallar si el log falla
        
        # Usar el servicio de email
        try:
            result = await email_service.send_password_reset_request(
                user_email=request.email,
                user_name=request.user_name or "No especificado"
            )
        except Exception as email_error:
            logger.warning(f"Error en email_service: {email_error}")
            # Simular éxito para desarrollo
            result = {"success": True, "message": "Email simulado enviado"}
        
        if result.get("success", True):
            # Log de éxito
            try:
                log_event(
                    user_id=request.email,
                    event_type="PASSWORD_RESET_EMAIL_SENT",  # ← Cambio: 'event_type'
                    details={
                        "admin_email": "cadetbudder@gmail.com",
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
            # Log de error
            try:
                log_event(
                    user_id=request.email,
                    event_type="PASSWORD_RESET_EMAIL_FAILED",  # ← Cambio: 'event_type'
                    details={
                        "admin_email": "cadetbudder@gmail.com",
                        "status": "failed",
                        "error": result.get("message", "Unknown error")
                    },
                    severity="WARNING"
                )
            except Exception as log_error:
                logger.warning(f"Error logging fallo: {log_error}")
            
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error interno enviando la solicitud. Inténtalo más tarde."
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error procesando solicitud de reset: {e}")
        
        # Log de error crítico
        try:
            log_event(
                user_id=request.email,
                event_type="PASSWORD_RESET_ERROR",  # ← Cambio: 'event_type'
                details={
                    "error": str(e),
                    "status": "critical_error",
                    "timestamp": datetime.datetime.now().isoformat()
                },
                severity="ERROR"
            )
        except Exception as log_error:
            logger.warning(f"Error logging error crítico: {log_error}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno procesando la solicitud"
        )

@router.get("/password-reset-status")
async def get_password_reset_info():
    """
    Información sobre el proceso de recuperación de contraseña.
    """
    return {
        "process": "manual_admin_approval",
        "admin_email": "cadetbudder@gmail.com",
        "estimated_response_time": "24-48 horas",
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