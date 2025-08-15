import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any
import logging
from datetime import datetime, timedelta
from config import settings
from utils.audit_logger import log_event
import hashlib

# Importar Firebase Auth para generar enlaces de reset
from services.firebase_service import get_auth_client, get_firestore_client

logger = logging.getLogger(__name__)

# USAR DOMINIO FIREBASE COMO REMITENTE
SYSTEM_EMAIL = "noreply@indexador-demo-gemini.firebaseapp.com"

# Email del administrador que recibirá las solicitudes
ADMIN_EMAIL = settings.ADMIN_EMAIL if hasattr(settings, 'ADMIN_EMAIL') else "admin@ejemplo.com"

class EmailService:
    def __init__(self):
        # Leer directamente desde settings de .env
        self.smtp_server = settings.SMTP_SERVER
        self.smtp_port = settings.SMTP_PORT
        self.email_user = settings.EMAIL_USER
        self.email_password = settings.EMAIL_PASSWORD
        
        logger.info(f"   EmailService configurado:")
        logger.info(f"   Sistema (From): {SYSTEM_EMAIL}")
        logger.info(f"   Administrador (To): {ADMIN_EMAIL}")
        logger.info(f"   SMTP Server: {self.smtp_server}:{self.smtp_port}")
        logger.info(f"   SMTP User: {self.email_user}")
        logger.info(f"   SMTP Password: {'Configurado' if self.email_password else 'No configurado'}")
        logger.info(f"   SMTP Funcional: {'Sí' if self.email_user and self.email_password else 'No'}")

    async def _check_recent_requests(self, user_email: str) -> int:
        """
        Verificar cuántas solicitudes ha hecho el usuario en la última hora.
        """
        try:
            firestore_client = get_firestore_client()
            
            # Hash del email para privacy
            email_hash = hashlib.sha256(user_email.encode()).hexdigest()
            
            # Buscar solicitudes de la última hora
            one_hour_ago = datetime.now() - timedelta(hours=1)
            
            # USAR NUEVO SINTAXIS DE FIRESTORE PARA EVITAR WARNINGS
            from google.cloud.firestore_v1.base_query import FieldFilter
            
            requests_ref = firestore_client.collection("password_reset_requests")
            
            # Usar el nuevo sintaxis de filtros
            query = requests_ref.where(
                filter=FieldFilter("email_hash", "==", email_hash)
            ).where(
                filter=FieldFilter("timestamp", ">=", one_hour_ago)
            ).limit(10)
            
            requests = list(query.stream())
            count = len(requests)
            
            logger.info(f"Rate limiting check: {count} solicitudes en última hora para usuario")
            return count
            
        except Exception as e:
            logger.warning(f"Error checking rate limit: {e}")
            # En caso de error, permitir la solicitud (fail-open)
            return 0

    async def _log_reset_request(self, user_email: str) -> None:
        """
        Registrar solicitud de reset para rate limiting.
        """
        try:
            firestore_client = get_firestore_client()
            
            # Hash del email para privacy
            email_hash = hashlib.sha256(user_email.encode()).hexdigest()
            
            request_data = {
                "email_hash": email_hash,
                "timestamp": datetime.now(),
                "type": "password_reset_request",
                "status": "logged"
            }
            
            # Guardar en Firestore
            doc_ref = firestore_client.collection("password_reset_requests").document()
            doc_ref.set(request_data)
            
            logger.info(f"Solicitud de reset registrada para rate limiting")
            
        except Exception as e:
            logger.warning(f"Error logging reset request: {e}")

    async def _verify_user_exists_in_firebase(self, user_email: str) -> bool:
        """
        Verificar que el usuario existe en Firebase Auth.
        """
        try:
            auth_client = get_auth_client()
            user_record = auth_client.get_user_by_email(user_email)
            logger.info(f"Usuario verificado en Firebase: {user_email}")
            return True
        except Exception as e:
            logger.warning(f"Usuario NO encontrado en Firebase: {user_email} - {e}")
            return False

    async def send_password_reset_request(self, user_email: str, user_name: str = None) -> Dict[str, Any]:
        """
        Genera enlace de reset de Firebase y lo envía al administrador para aprobación.
        AHORA VERIFICA QUE EL USUARIO EXISTA ANTES DE ENVIAR EMAIL
        """
        try:
            logger.info(f"Generando enlace de reset Firebase para: {user_email}")
            
            # VALIDAR DOMINIO
            if not await self._validate_email_domain(user_email):
                logger.warning(f"Dominio no autorizado: {user_email}")
                return {
                    "success": False,
                    "message": "Dominio de email no autorizado",
                    "error_type": "UNAUTHORIZED_DOMAIN"
                }
            
            # VERIFICAR QUE EL USUARIO EXISTE EN FIREBASE (NUEVA VALIDACIÓN)
            user_exists = await self._verify_user_exists_in_firebase(user_email)
            if not user_exists:
                logger.warning(f"❌ Usuario no registrado en el sistema: {user_email}")
                
                # Log de auditoría para intento de usuario no existente
                try:
                    log_event(
                        user_id=user_email,
                        event_type="PASSWORD_RESET_USER_NOT_FOUND",
                        details={
                            "attempted_email": user_email,
                            "user_name": user_name,
                            "reason": "user_not_registered",
                            "timestamp": datetime.now().isoformat()
                        },
                        severity="WARNING"
                    )
                except Exception as log_error:
                    logger.warning(f"Error en log de auditoría: {log_error}")
                
                return {
                    "success": False,
                    "message": f"El email {user_email} no está registrado en el sistema. Contacta al administrador para crear tu cuenta.",
                    "error_type": "USER_NOT_FOUND"
                }
            
            # 3. VERIFICAR CREDENCIALES SMTP
            if not self.email_user or not self.email_password:
                logger.warning("❌ Credenciales SMTP no configuradas - usando modo simulación")
                # No retornamos error, continuamos en modo simulación
            
            # VERIFICAR RATE LIMITING
            recent_requests = await self._check_recent_requests(user_email)
            if recent_requests >= 5:  # Máximo 5 solicitudes por hora
                logger.warning(f"Rate limit exceeded para: {user_email} ({recent_requests} solicitudes)")
                return {
                    "success": False,
                    "message": f"Demasiadas solicitudes ({recent_requests}/5). Intenta en 1 hora.",
                    "error_type": "RATE_LIMIT_EXCEEDED"
                }
            
            # REGISTRAR SOLICITUD
            await self._log_reset_request(user_email)
            
            # GENERAR ENLACE DE RESET USANDO FIREBASE AUTH
            firebase_reset_link = await self._generate_firebase_reset_link(user_email)
            
            if not firebase_reset_link:
                # Si no se puede generar el enlace, usar proceso manual
                logger.warning(f"No se pudo generar enlace Firebase, usando proceso manual")
                return await self._send_manual_reset_request(user_email, user_name)
            
            # ENVIAR ENLACE AL ADMINISTRADOR
            subject = f"CDES - Aprobación de Reset de Contraseña ({user_email})"
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Solicitud de Reset de Contraseña</title>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: #6B46C1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                    .content {{ padding: 20px; background: #f9f9f9; }}
                    .footer {{ background: #333; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; }}
                    .button {{ background: #6B46C1; color: white !important; padding: 12px 24px; text-decoration: none !important;  border-radius: 5px; display: inline-block; margin: 10px 5px;border: none;font-weight: bold;                 
                    }}
                    
                    .button:hover {{
                        background: #553C9A !important;   /* ← Color hover más oscuro */
                        color: white !important;          /* ← Mantener texto blanco en hover */
                    }}
                    
                    .button:visited {{
                        color: white !important;          /* ← Texto blanco en enlaces visitados */
                    }}
                    
                    .button:active {{
                        color: white !important;          /* ← Texto blanco cuando se hace clic */
                    }}
                    
                    /* Estilo para botón de panel de administración */
                    .button-admin {{background: #059669; color: white !important; padding: 12px 24px;text-decoration: none !important;border-radius: 5px;display: inline-block;margin: 10px 5px;border: none;font-weight: bold;
                    }}
                    
                    .button-admin:hover {{
                        background: #047857 !important;
                        color: white !important;
                    }}
                    
                    .warning {{ background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 15px 0; }}
                    .info-box {{ background: #E0E7FF; border: 1px solid #6B46C1; padding: 15px; border-radius: 5px; margin: 15px 0; }}
                    .reset-link {{ background: #F3F4F6; border: 2px solid #6B46C1; padding: 15px; border-radius: 5px; margin: 15px 0; word-break: break-all; }}
                    .rate-limit {{ background: #DBEAFE; border: 1px solid #3B82F6; padding: 15px; border-radius: 5px; margin: 15px 0; }}
                    .verified-user {{ background: #D1FAE5; border: 1px solid #10B981; padding: 15px; border-radius: 5px; margin: 15px 0; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>CDES - Sistema Indexador</h1>
                        <h2>Solicitud de Reset de Contraseña</h2>
                    </div>
                    
                    <div class="content">
                        <div class="info-box">
                            <h3>Nueva Solicitud con Enlace Firebase</h3>
                            <p><strong>Usuario:</strong> {user_email}</p>
                            <p><strong>Nombre:</strong> {user_name or 'No especificado'}</p>
                            <p><strong>Fecha:</strong> {datetime.now().strftime('%d/%m/%Y - %H:%M')}</p>
                            <p><strong>Sistema:</strong> Indexador CDES</p>
                            <p><strong>Estado:</strong> Usuario registrado</p>
                        </div>
                        
                        <div class="rate-limit">
                            <h4>Control de Solicitudes</h4>
                            <p><strong>Solicitudes en última hora:</strong> {recent_requests + 1}/5</p>
                            <p><strong>Estado:</strong> {'Cerca del límite' if recent_requests >= 3 else 'Normal'}</p>
                        </div>
                        
                        <div class="warning">
                            <strong>Acción Requerida del Administrador</strong>
                            <p>Firebase ha generado automáticamente un enlace seguro de reset. Como administrador, debes:</p>
                            <ol>
                                <li><strong>Verificar la identidad</strong> del usuario por teléfono/email</li>
                                <li><strong>Revisar la solicitud</strong> para confirmar legitimidad</li>
                                <li><strong>Si es legítima:</strong> Enviar el enlace al usuario</li>
                                <li><strong>Si es sospechosa:</strong> Ignorar y reportar</li>
                            </ol>
                        </div>
                        
                        <div class="reset-link">
                            <h4>Enlace de Reset Generado por Firebase:</h4>
                            <p><strong> Válido por 1 hora</strong></p>
                            <div style="background: white; padding: 10px; border-radius: 3px; font-family: monospace; font-size: 12px;">
                                {firebase_reset_link}
                            </div>
                        </div>
                        
                        <div style="text-align: center; margin: 20px 0;">
                            <p><strong>Opciones de administrador:</strong></p>
                            <a href="mailto:{user_email}?subject=Reset de Contraseña CDES&body=Hola,%0A%0ATu solicitud de cambio de contraseña ha sido aprobada.%0A%0AEnlace de reset: {firebase_reset_link}%0A%0AEste enlace es válido por 1 hora.%0A%0ASaludos,%0AEquipo CDES" 
                               class="button">
                                Aprobar y Enviar al Usuario
                            </a>
                            
                            <!-- Botón Panel Admin (Verde) -->
                            <a href="http://localhost:5173/admin" 
                               class="button-admin">
                                Panel de Administración
                            </a>
                        </div>
                        
                        <div class="info-box">
                            <h4>Información de Contacto:</h4>
                            <p><strong>Email del usuario:</strong> {user_email}</p>
                            <p><strong>Instrucciones:</strong> Verificar identidad antes de enviar enlace</p>
                            <p><strong>Seguridad:</strong> El enlace expira automáticamente en 1 hora</p>
                            <p><strong>Verificación:</strong> Usuario registrado en Firebase</p>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p><strong>Consejo de Desarrollo Estratégico de Santiago (CDES)</strong></p>
                        <p>Sistema Indexador de Documentos | indexador-demo-gemini</p>
                        <p><small>Este es un mensaje automático del sistema - No responder</small></p>
                        <p><small>Usuario verificado en Firebase Auth</small></p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Enviar email al administrador
            result = await self._send_email(
                to_email=ADMIN_EMAIL,
                subject=subject,
                html_content=html_content
            )
            
            # Log de auditoría
            try:
                log_event(
                    user_id=user_email,
                    event_type="FIREBASE_RESET_LINK_GENERATED",
                    details={
                        "requested_by": user_email,
                        "admin_notified": ADMIN_EMAIL,
                        "firebase_link_generated": True,
                        "link_expires_in": "1 hour",
                        "rate_limit_count": recent_requests + 1,
                        "user_verified_in_firebase": True,
                        "timestamp": datetime.now().isoformat()
                    },
                    severity="INFO"
                )
            except Exception as log_error:
                logger.warning(f"Error en log de auditoría: {log_error}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error enviando solicitud: {e}")
            return {"success": False, "message": str(e), "error_type": "INTERNAL_SERVER_ERROR"}

    async def _generate_firebase_reset_link(self, user_email: str) -> str:
        """
        Genera un enlace de reset de contraseña usando Firebase Auth.
        YA NO NECESITA VERIFICAR USUARIO PORQUE SE HIZO ANTES
        """
        try:
            auth_client = get_auth_client()
            
            try:
                # CORRECCIÓN: Firebase Admin SDK solo necesita el email
                # Ya sabemos que el usuario existe porque se verificó antes
                reset_link = auth_client.generate_password_reset_link(user_email)
                
                logger.info(f"Enlace de reset generado exitosamente para: {user_email}")
                return reset_link
                
            except Exception as e:
                logger.error(f"Error generando enlace Firebase: {e}")
                return None
            
        except Exception as e:
            logger.error(f"Error general generando enlace Firebase: {e}")
            return None

    async def _send_manual_reset_request(self, user_email: str, user_name: str) -> Dict[str, Any]:
        """
        Fallback a proceso manual si Firebase falla.
        SOLO SE LLAMA SI EL USUARIO YA FUE VERIFICADO
        """
        logger.warning(f"Usando proceso manual para: {user_email}")
        
        subject = f"CDES - Solicitud Manual de Reset ({user_email})"
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #6B46C1; color: white; padding: 20px; text-align: center;">
                <h1>CDES - Solicitud Manual de Reset</h1>
            </div>
            
            <div style="padding: 20px; background: #f9f9f9;">
                <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 15px 0;">
                    <strong>Proceso Manual Requerido</strong>
                    <p>No se pudo generar enlace automático de Firebase. Proceso manual requerido.</p>
                </div>
                
                <p><strong>Usuario:</strong> {user_email}</p>
                <p><strong>Nombre:</strong> {user_name or 'No especificado'}</p>
                <p><strong>Fecha:</strong> {datetime.now().strftime('%d/%m/%Y - %H:%M')}</p>
                
                <h4>Pasos manuales:</h4>
                <ol>
                    <li>Verificar identidad del usuario</li>
                    <li>Acceder al panel de administración</li>
                    <li>Generar nueva contraseña temporal</li>
                    <li>Contactar al usuario directamente</li>
                </ol>
            </div>
        </div>
        """
        
        return await self._send_email(
            to_email=ADMIN_EMAIL,
            subject=subject,
            html_content=html_content
        )

    async def _send_email(self, to_email: str, subject: str, html_content: str) -> Dict[str, Any]:
        """
        Enviar email usando SMTP con dominio Firebase como remitente.
        """
        try:
            logger.info(f"Enviando email:")
            logger.info(f"   De: {SYSTEM_EMAIL}")
            logger.info(f"   Para: {to_email}")
            logger.info(f"   Asunto: {subject}")
            
            # Crear mensaje con dominio Firebase como remitente
            msg = MIMEMultipart('alternative')
            msg['From'] = SYSTEM_EMAIL
            msg['To'] = to_email
            msg['Subject'] = subject
            msg['Reply-To'] = ADMIN_EMAIL
            
            # Adjuntar contenido HTML
            html_part = MIMEText(html_content, 'html', 'utf-8')
            msg.attach(html_part)
            
            # VERIFICAR CREDENCIALES ANTES DE CONECTAR
            if not self.email_user or not self.email_password:
                logger.warning("Credenciales SMTP no configuradas - modo simulación")
                logger.info(f"[SIMULADO] Email enviado de {SYSTEM_EMAIL} a {to_email}")
                logger.info(f"[SIMULADO] Subject: {subject}")
                return {
                    "success": True,
                    "message": "Email simulado (credenciales no configuradas). En producción configurar EMAIL_USER y EMAIL_PASSWORD."
                }
            
            # PROBAR CONEXIÓN SMTP CON MANEJO DE ERRORES ESPECÍFICOS
            logger.info(f"Conectando a {self.smtp_server}:{self.smtp_port}")
            
            try:
                server = smtplib.SMTP(self.smtp_server, self.smtp_port)
                server.starttls()
                
                logger.info(f"Autenticando como: {self.email_user}")
                server.login(self.email_user, self.email_password)
                
                logger.info(f"Enviando mensaje...")
                server.send_message(msg)
                server.quit()
                
                logger.info(f"Email enviado exitosamente")
                return {
                    "success": True,
                    "message": "Email enviado correctamente al administrador"
                }
                
            except smtplib.SMTPAuthenticationError as auth_error:
                logger.error(f"Error de autenticación SMTP: {auth_error}")
                logger.error(f"SOLUCIÓN:")
                logger.error(f"   1. Verificar 2FA habilitado en Gmail")
                logger.error(f"   2. Generar nueva App Password")
                logger.error(f"   3. Actualizar EMAIL_PASSWORD en .env")
                return {
                    "success": False,
                    "message": "Error de autenticación Gmail. Verificar App Password en configuración.",
                    "error_type": "EMAIL_SERVICE_ERROR"
                }
                
            except smtplib.SMTPException as smtp_error:
                logger.error(f"Error SMTP: {smtp_error}")
                return {
                    "success": False,
                    "message": f"Error SMTP: {str(smtp_error)}",
                    "error_type": "EMAIL_SERVICE_ERROR"
                }
                
        except Exception as e:
            logger.error(f"Error enviando email: {e}")
            return {
                "success": False,
                "message": f"Error interno: {str(e)}",
                "error_type": "INTERNAL_SERVER_ERROR"
            }
    
    async def _validate_email_domain(self, user_email: str) -> bool:
        """Validar que el email es de dominio permitido."""
        allowed_domains = [
            "@cdes.gob.do",  # Dominio oficial
            "@gmail.com",    # Para testing
            "@hotmail.com",  # Para testing
        ]
        
        domain_valid = any(user_email.lower().endswith(domain.lower()) for domain in allowed_domains)
        
        if not domain_valid:
            logger.warning(f"Dominio no autorizado: {user_email}")
        
        return domain_valid

# Instancia global
email_service = EmailService()