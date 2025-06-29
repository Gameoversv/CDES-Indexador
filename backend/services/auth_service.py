"""
Servicio de Autenticación - Gestión de Usuarios con Firebase Auth

Este módulo maneja toda la lógica de negocio relacionada con la autenticación
y autorización de usuarios utilizando Firebase Authentication. Se encarga de:

- Registro de nuevos usuarios en Firebase Auth
- Verificación de tokens JWT de Firebase
- Gestión de roles y custom claims (administradores)
- Integración con Firestore para metadatos de usuarios
- Logging de eventos de seguridad y auditoría

Características principales:
- Registro seguro con validación de emails únicos
- Verificación robusta de tokens JWT
- Sistema de roles con custom claims de Firebase
- Logging automático de eventos de seguridad
- Manejo centralizado de errores de autenticación

Dependencias:
- Firebase Admin SDK para autenticación
- Firestore para almacenar metadatos de usuarios
- Sistema de auditoría para tracking de eventos


"""

from firebase_admin import auth, firestore
from firebase_admin.exceptions import FirebaseError
from services.firebase_service import get_auth_client, get_firestore_client
from utils.audit_logger import log_event
from fastapi import HTTPException, status
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Dict, Any, List
from datetime import datetime


# ==================================================================================
#                           MODELOS DE DATOS CON PYDANTIC
# ==================================================================================

class UserRegister(BaseModel):
    """
    Modelo para el registro de nuevos usuarios.
    
    Valida automáticamente los datos de entrada para el registro,
    asegurando que el email sea válido y la contraseña cumpla
    con los requisitos mínimos de seguridad.
    
    Attributes:
        email: Dirección de correo electrónico única del usuario
        password: Contraseña segura (mínimo 6 caracteres por Firebase)
        display_name: Nombre para mostrar del usuario (opcional)
    """
    
    email: str = Field(
        ...,
        description="Dirección de correo electrónico del usuario",
        example="usuario@ejemplo.com"
    )
    
    password: str = Field(
        ...,
        min_length=6,
        max_length=128,
        description="Contraseña del usuario (mínimo 6 caracteres)",
        example="contraseña_segura_123"
    )
    
    display_name: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Nombre para mostrar del usuario (opcional)",
        example="Juan Pérez"
    )


class UserLogin(BaseModel):
    """
    Modelo para el inicio de sesión de usuarios.
    
    ⚠️ NOTA: Este modelo está definido para posibles futuras extensiones.
    Actualmente la autenticación se maneja completamente en el frontend
    con Firebase Auth, y el backend solo verifica tokens JWT.
    
    Attributes:
        email: Dirección de correo electrónico
        password: Contraseña del usuario
    """
    
    email: str = Field(
        ...,
        description="Dirección de correo electrónico",
        example="usuario@ejemplo.com"
    )
    
    password: str = Field(
        ...,
        min_length=6,
        description="Contraseña del usuario",
        example="contraseña_usuario"
    )


class TokenData(BaseModel):
    """
    Modelo que representa los datos decodificados de un token JWT de Firebase.
    
    Este modelo se utiliza para transportar información del usuario autenticado
    a través de las dependencias de FastAPI y entre diferentes servicios.
    
    Attributes:
        uid: Identificador único del usuario en Firebase
        email: Dirección de correo electrónico verificada
        is_admin: Indica si el usuario tiene privilegios de administrador
        email_verified: Indica si el email ha sido verificado
        name: Nombre para mostrar del usuario (si está disponible)
    """
    
    uid: str = Field(
        ...,
        description="Identificador único del usuario en Firebase",
        example="abc123xyz789"
    )
    
    email: str = Field(
        ...,
        description="Dirección de correo electrónico del usuario",
        example="usuario@ejemplo.com"
    )
    
    is_admin: bool = Field(
        default=False,
        description="Indica si el usuario tiene privilegios de administrador"
    )
    
    email_verified: Optional[bool] = Field(
        default=None,
        description="Indica si el email del usuario ha sido verificado"
    )
    
    name: Optional[str] = Field(
        default=None,
        description="Nombre para mostrar del usuario",
        example="Juan Pérez"
    )


# ==================================================================================
#                           FUNCIONES DE REGISTRO DE USUARIOS
# ==================================================================================

async def register_user(user_data: UserRegister) -> Dict[str, Any]:
    """
    Registra un nuevo usuario en Firebase Authentication y Firestore.
    
    Esta función realiza un proceso completo de registro que incluye:
    1. Crear el usuario en Firebase Authentication
    2. Almacenar metadatos adicionales en Firestore
    3. Registrar el evento en los logs de auditoría
    4. Devolver información del usuario creado
    
    Args:
        user_data: Datos validados del usuario a registrar
        
    Returns:
        Dict[str, Any]: Información del usuario registrado incluyendo UID
        
    Raises:
        HTTPException 409: Si el email ya está registrado
        HTTPException 400: Si hay errores de validación de Firebase
        HTTPException 500: Si hay errores inesperados durante el registro
        
    Example:
        user_info = await register_user(UserRegister(
            email="nuevo@ejemplo.com",
            password="contraseña_segura",
            display_name="Usuario Nuevo"
        ))
        # Resultado: {"uid": "abc123", "email": "nuevo@ejemplo.com", ...}
    """
    try:
        # ===== CREAR USUARIO EN FIREBASE AUTHENTICATION =====
        firebase_auth = get_auth_client()
        
        # Configurar datos del usuario para Firebase
        user_creation_data = {
            "email": user_data.email,
            "password": user_data.password,
            "email_verified": False,  # Requerir verificación de email
            "disabled": False         # Usuario activo por defecto
        }
        
        # Añadir nombre para mostrar si se proporcionó
        if user_data.display_name:
            user_creation_data["display_name"] = user_data.display_name

        # Crear usuario en Firebase
        user = firebase_auth.create_user(**user_creation_data)
        
        # ===== ALMACENAR METADATOS EN FIRESTORE =====
        firestore_client = get_firestore_client()
        
        # Datos adicionales para almacenar en Firestore
        user_metadata = {
            "email": user.email,
            "role": "user",                    # Rol por defecto
            "display_name": user_data.display_name or "",
            "created_at": firestore.SERVER_TIMESTAMP,
            "last_login": None,
            "is_active": True,
            "registration_ip": None,           # Se puede añadir desde el request
            "email_verified": False
        }
        
        # Guardar en colección de usuarios
        firestore_client.collection("users").document(user.uid).set(user_metadata)
        
        # ===== REGISTRAR EVENTO DE AUDITORÍA =====
        log_event(user.uid, 'USER_REGISTERED', {
            'email': user.email,
            'display_name': user_data.display_name or '',
            'registration_method': 'email_password'
        })
        
        # ===== PREPARAR RESPUESTA =====
        response_data = {
            "uid": user.uid,
            "email": user.email,
            "display_name": user_data.display_name or '',
            "message": "Usuario registrado exitosamente",
            "email_verified": False,
            "created_at": datetime.now().isoformat() + "Z"
        }
        
        # Mensaje de depuración - comentado para producción
        # print(f"✅ Usuario registrado: {user.email} (UID: {user.uid})")
        
        return response_data

    except FirebaseError as e:
        # ===== MANEJO DE ERRORES ESPECÍFICOS DE FIREBASE =====
        error_code = getattr(e, 'code', 'UNKNOWN')
        
        if "EMAIL_ALREADY_EXISTS" in str(e) or error_code == 'email-already-exists':
            # Email ya registrado
            log_event(None, 'REGISTRATION_FAILED', {
                'email': user_data.email,
                'reason': 'email_already_exists'
            })
            
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este correo electrónico ya está registrado. Intenta iniciar sesión."
            )
        elif "WEAK_PASSWORD" in str(e) or error_code == 'weak-password':
            # Contraseña muy débil
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La contraseña es demasiado débil. Debe tener al menos 6 caracteres."
            )
        elif "INVALID_EMAIL" in str(e) or error_code == 'invalid-email':
            # Email inválido
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El formato del correo electrónico no es válido."
            )
        else:
            # Otros errores de Firebase
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error de Firebase durante el registro: {str(e)}"
            )
            
    except Exception as e:
        # ===== MANEJO DE ERRORES GENERALES =====
        # Registrar error para debugging
        log_event(None, 'REGISTRATION_ERROR', {
            'email': user_data.email,
            'error_type': type(e).__name__,
            'error_message': str(e)
        })
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error inesperado durante el registro. Por favor, intenta de nuevo."
        )


# ==================================================================================
#                           FUNCIONES DE VERIFICACIÓN DE TOKENS
# ==================================================================================

async def verify_id_token(id_token: str) -> TokenData:
    """
    Verifica un token JWT de Firebase y extrae los datos del usuario.
    
    Esta función es fundamental para la seguridad de la aplicación, ya que:
    1. Verifica que el token sea válido y no haya expirado
    2. Decodifica la información del usuario
    3. Extrae custom claims (como permisos de administrador)
    4. Valida la integridad criptográfica del token
    
    Args:
        id_token: Token JWT de Firebase enviado por el cliente
        
    Returns:
        TokenData: Información del usuario autenticado con roles
        
    Raises:
        HTTPException 401: Si el token es inválido, expirado o malformado
        
    Example:
        user_data = await verify_id_token("eyJhbGciOiJSUzI1NiIs...")
        print(f"Usuario: {user_data.email}, Admin: {user_data.is_admin}")
    """
    try:
        # ===== VERIFICAR Y DECODIFICAR TOKEN =====
        # Firebase verifica automáticamente:
        # - Firma criptográfica del token
        # - Fecha de expiración
        # - Emisor (Firebase Project ID)
        # - Audiencia (Firebase Project ID)
        decoded_token = get_auth_client().verify_id_token(id_token)
        
        # ===== EXTRAER DATOS BÁSICOS =====
        uid = decoded_token["uid"]
        email = decoded_token.get("email", "")
        name = decoded_token.get("name", None)
        email_verified = decoded_token.get("email_verified", False)
        
        # ===== EXTRAER CUSTOM CLAIMS (ROLES) =====
        # Los custom claims están en el nivel raíz del token decodificado
        is_admin = decoded_token.get("admin", False)
        
        # ===== ACTUALIZAR ÚLTIMO LOGIN EN FIRESTORE (OPCIONAL) =====
        # Descomenta si quieres trackear el último login
        # try:
        #     firestore_client = get_firestore_client()
        #     firestore_client.collection("users").document(uid).update({
        #         "last_login": firestore.SERVER_TIMESTAMP
        #     })
        # except:
        #     pass  # No fallar si no se puede actualizar
        
        # ===== CREAR OBJETO TokenData =====
        token_data = TokenData(
            uid=uid,
            email=email,
            is_admin=is_admin,
            email_verified=email_verified,
            name=name
        )
        
        # Mensaje de depuración - comentado para producción
        # print(f"🔐 Token verificado para: {email} (Admin: {is_admin})")
        
        return token_data

    except auth.InvalidIdTokenError as e:
        # Token específicamente inválido o expirado
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticación inválido o expirado. Por favor, inicia sesión nuevamente.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.ExpiredIdTokenError as e:
        # Token expirado
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticación expirado. Por favor, inicia sesión nuevamente.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        # Otros errores de verificación
        # print(f"❌ Error verificando token: {e}")  # Debug - comentado para producción
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se pudo verificar el token de autenticación.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ==================================================================================
#                           FUNCIONES DE GESTIÓN DE ROLES
# ==================================================================================

async def set_user_as_admin(uid: str) -> Dict[str, Any]:
    """
    Promociona un usuario a administrador estableciendo custom claims.
    
    Esta función otorga privilegios de administrador a un usuario existente:
    1. Establece el custom claim 'admin' = True en Firebase
    2. Actualiza el rol en Firestore para consistencia
    3. Registra el evento en logs de auditoría
    4. Invalida tokens existentes (requiere nuevo login)
    
    ⚠️ IMPORTANTE: El usuario debe cerrar sesión y volver a iniciar sesión
    para que los nuevos custom claims tengan efecto.
    
    Args:
        uid: Identificador único del usuario en Firebase
        
    Returns:
        Dict[str, Any]: Confirmación de la promoción
        
    Raises:
        HTTPException 400: Si hay errores al establecer custom claims
        HTTPException 404: Si el usuario no existe
        HTTPException 500: Si hay errores inesperados
        
    Example:
        result = await set_user_as_admin("abc123xyz789")
        print(result["message"])  # "Usuario promocionado a administrador"
    """
    try:
        # ===== VERIFICAR QUE EL USUARIO EXISTE =====
        firebase_auth = get_auth_client()
        
        try:
            user = firebase_auth.get_user(uid)
        except auth.UserNotFoundError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Usuario con UID '{uid}' no encontrado."
            )
        
        # ===== ESTABLECER CUSTOM CLAIM DE ADMINISTRADOR =====
        # Esto invalida automáticamente todos los tokens existentes del usuario
        firebase_auth.set_custom_user_claims(uid, {'admin': True})
        
        # ===== ACTUALIZAR ROL EN FIRESTORE =====
        firestore_client = get_firestore_client()
        firestore_client.collection("users").document(uid).update({
            "role": "admin",
            "promoted_to_admin_at": firestore.SERVER_TIMESTAMP
        })
        
        # ===== REGISTRAR EVENTO DE AUDITORÍA =====
        log_event(uid, 'USER_PROMOTED_TO_ADMIN', {
            'user_email': user.email,
            'promoted_by': 'system',  # Se puede cambiar para incluir quién hizo la promoción
            'custom_claims_set': True
        })
        
        # Mensaje de depuración - comentado para producción
        # print(f"✅ Usuario {user.email} promocionado a administrador")
        
        return {
            "message": "Usuario promocionado a administrador exitosamente",
            "uid": uid,
            "email": user.email,
            "admin_privileges": True,
            "note": "El usuario debe cerrar sesión y volver a iniciar para que los cambios tengan efecto",
            "promoted_at": datetime.now().isoformat() + "Z"
        }
        
    except HTTPException:
        # Re-lanzar HTTPException tal como están
        raise
    except FirebaseError as e:
        # Errores específicos de Firebase
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error de Firebase estableciendo privilegios de administrador: {str(e)}"
        )
    except Exception as e:
        # Errores inesperados
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado promocionando usuario a administrador: {str(e)}"
        )


async def revoke_admin_privileges(uid: str) -> Dict[str, Any]:
    """
    Revoca los privilegios de administrador de un usuario.
    
    Args:
        uid: Identificador único del usuario
        
    Returns:
        Dict[str, Any]: Confirmación de la revocación
        
    Raises:
        HTTPException: Si hay errores durante la revocación
    """
    try:
        firebase_auth = get_auth_client()
        
        # Verificar que el usuario existe
        try:
            user = firebase_auth.get_user(uid)
        except auth.UserNotFoundError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Usuario con UID '{uid}' no encontrado."
            )
        
        # Remover custom claim de administrador
        firebase_auth.set_custom_user_claims(uid, {'admin': False})
        
        # Actualizar rol en Firestore
        firestore_client = get_firestore_client()
        firestore_client.collection("users").document(uid).update({
            "role": "user",
            "admin_revoked_at": firestore.SERVER_TIMESTAMP
        })
        
        # Registrar evento de auditoría
        log_event(uid, 'ADMIN_PRIVILEGES_REVOKED', {
            'user_email': user.email,
            'revoked_by': 'system'
        })
        
        return {
            "message": "Privilegios de administrador revocados exitosamente",
            "uid": uid,
            "email": user.email,
            "admin_privileges": False,
            "revoked_at": datetime.now().isoformat() + "Z"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error revocando privilegios de administrador: {str(e)}"
        )


# ==================================================================================
#                           FUNCIONES AUXILIARES
# ==================================================================================

async def get_user_info(uid: str) -> Dict[str, Any]:
    """
    Obtiene información completa de un usuario desde Firebase y Firestore.
    
    Args:
        uid: Identificador único del usuario
        
    Returns:
        Dict[str, Any]: Información completa del usuario
        
    Raises:
        HTTPException: Si el usuario no existe o hay errores
    """
    try:
        firebase_auth = get_auth_client()
        firestore_client = get_firestore_client()
        
        # Obtener datos de Firebase Auth
        try:
            user = firebase_auth.get_user(uid)
        except auth.UserNotFoundError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Usuario no encontrado: {uid}"
            )
        
        # Obtener metadatos de Firestore
        user_doc = firestore_client.collection("users").document(uid).get()
        user_metadata = user_doc.to_dict() if user_doc.exists else {}
        
        return {
            "uid": user.uid,
            "email": user.email,
            "display_name": user.display_name,
            "email_verified": user.email_verified,
            "disabled": user.disabled,
            "custom_claims": user.custom_claims or {},
            "creation_time": user.user_metadata.creation_timestamp,
            "last_sign_in": user.user_metadata.last_sign_in_timestamp,
            "firestore_metadata": user_metadata
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error obteniendo información del usuario: {str(e)}"
        )


# ============================================================================
#                           NUEVAS FUNCIONES DE USUARIOS
# ============================================================================

async def list_users(limit: int = 100) -> List[Dict[str, Any]]:
    """Devuelve una lista básica de usuarios registrados."""
    try:
        firebase_auth = get_auth_client()
        users: List[Dict[str, Any]] = []

        page = firebase_auth.list_users(page_token=None, max_results=limit)
        for user in page.users:
            users.append({
                "uid": user.uid,
                "email": user.email,
                "display_name": user.display_name,
                "disabled": user.disabled,
                "custom_claims": user.custom_claims or {},
                "email_verified": user.email_verified,
            })

        return users

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listando usuarios: {str(e)}"
        )


async def update_user(uid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Actualiza la información básica de un usuario."""
    try:
        firebase_auth = get_auth_client()
        firestore_client = get_firestore_client()

        user = firebase_auth.update_user(uid, **{k: v for k, v in data.items() if k in {"email", "password", "display_name", "disabled"}})

        updates = {}
        if "role" in data:
            updates["role"] = data["role"]
        if "display_name" in data:
            updates["display_name"] = data["display_name"]
        if updates:
            firestore_client.collection("users").document(uid).update(updates)

        return {
            "uid": user.uid,
            "email": user.email,
            "display_name": user.display_name,
            "disabled": user.disabled,
        }

    except auth.UserNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario no encontrado: {uid}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error actualizando usuario: {str(e)}"
        )


async def delete_user(uid: str) -> Dict[str, Any]:
    """Elimina un usuario por UID."""
    try:
        firebase_auth = get_auth_client()
        firestore_client = get_firestore_client()

        firebase_auth.delete_user(uid)
        firestore_client.collection("users").document(uid).delete()

        return {"message": "Usuario eliminado", "uid": uid}

    except auth.UserNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario no encontrado: {uid}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error eliminando usuario: {str(e)}"
        )
