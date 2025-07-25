"""
Configuración de la Aplicación - Indexador de Documentos con IA

Este módulo maneja toda la configuración de la aplicación utilizando Pydantic
para validación automática de variables de entorno.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import os

# ==================================================================================
#                           CONFIGURACIÓN DE RUTAS DE ARCHIVOS
# ==================================================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_FILE_PATH = os.path.join(BASE_DIR, ".env")


# ==================================================================================
#                           CLASE DE CONFIGURACIÓN PRINCIPAL
# ==================================================================================

class Settings(BaseSettings):
    """
    Clase de configuración principal utilizando Pydantic Settings.
    """
    
    model_config = SettingsConfigDict(
        env_file=ENV_FILE_PATH,
        env_file_encoding='utf-8',
        extra='ignore'
    )

    # ===== CONFIGURACIÓN DE FIREBASE =====
    FIREBASE_SERVICE_ACCOUNT_KEY_PATH: str = Field(
        ...,
        description="Ruta al archivo JSON de credenciales de Firebase",
        example="firebase-service-account.json"
    )
    
    FIREBASE_STORAGE_BUCKET: str = Field(
        ...,
        description="Nombre del bucket de Firebase Storage",
        example="mi-proyecto.appspot.com"
    )

    # ===== CONFIGURACIÓN DE IA =====
    AI_PROVIDER: str = Field(
        "google",
        description="Proveedor de IA: google, openai, deepseek",
        pattern=r"^(google|openai|deepseek)$"
    )
    
    GEMINI_API_KEY: str = Field(
        ...,
        description="Clave de API de Google Gemini",
        min_length=20
    )
    
    OPENAI_API_KEY: str | None = Field(
        None,
        description="Clave de API de OpenAI",
        min_length=20
    )
    
    DEEPSEEK_API_KEY: str | None = Field(
        None,
        description="Clave de API de DeepSeek",
        min_length=20
    )
    
    # ===== CONFIGURACIÓN DE PROCESAMIENTO DE IA =====
    API_TIMEOUT: int = Field(
        120,
        description="Timeout para llamadas a APIs de IA en segundos",
        ge=10, le=300
    )
    
    MAX_TEXT_LENGTH: int = Field(
        8000,
        description="Longitud máxima de texto para enviar a la IA",
        ge=1000
    )
    
    MAX_SUMMARY_WORDS: int = Field(
        150,
        description="Número máximo de palabras en el resumen",
        ge=50, le=500
    )
    
    MAX_KEYWORDS: int = Field(
        10,
        description="Número máximo de palabras clave a extraer",
        ge=3, le=20
    )

    # ===== CONFIGURACIÓN DE MEILISEARCH =====
    MEILISEARCH_HOST: str = Field(
        ...,
        description="URL completa del servidor Meilisearch",
        example="http://localhost:7700"
    )
    
    MEILISEARCH_MASTER_KEY: str | None = Field(
        None,
        description="Clave maestra de Meilisearch",
        min_length=16
    )

    # ===== CONFIGURACIÓN DE SEGURIDAD =====
    SECRET_KEY: str = Field(
        ...,
        description="Clave secreta para JWT",
        min_length=32
    )

    # ===== CONFIGURACIÓN DEL ENTORNO =====
    APP_ENV: str = Field(
        "development",
        description="Entorno de la aplicación",
        pattern=r"^(development|staging|production)$"
    )


# ==================================================================================
#                           INSTANCIA GLOBAL DE CONFIGURACIÓN
# ==================================================================================

try:
    settings = Settings()
except Exception as e:
    print(f"ERROR CRÍTICO: No se pudo cargar la configuración: {e}")
    print("Asegúrate de que:")
    print("   1. El archivo .env existe en el directorio backend/")
    print("   2. Todas las variables requeridas están definidas")
    print("   3. Los valores tienen el formato correcto")
    raise


# ==================================================================================
#                           FUNCIÓN DE VALIDACIÓN
# ==================================================================================

def validar_configuracion():
    """Valida que todas las configuraciones están correctas."""
    errores = []
    
    firebase_path = os.path.join(BASE_DIR, settings.FIREBASE_SERVICE_ACCOUNT_KEY_PATH)
    if not os.path.exists(firebase_path):
        errores.append(f"Archivo de credenciales Firebase no encontrado: {firebase_path}")
    
    if not settings.FIREBASE_STORAGE_BUCKET.endswith('.appspot.com'):
        errores.append("El bucket de Firebase Storage debe terminar en '.appspot.com'")
    
    if not settings.MEILISEARCH_HOST.startswith(('http://', 'https://')):
        errores.append("MEILISEARCH_HOST debe ser una URL completa")
    
    if len(settings.SECRET_KEY) < 32:
        errores.append("SECRET_KEY debe tener al menos 32 caracteres")
    
    # Validar configuración del proveedor de IA
    if settings.AI_PROVIDER == "openai" and not settings.OPENAI_API_KEY:
        errores.append("OPENAI_API_KEY es requerida cuando AI_PROVIDER es 'openai'")
    elif settings.AI_PROVIDER == "deepseek" and not settings.DEEPSEEK_API_KEY:
        errores.append("DEEPSEEK_API_KEY es requerida cuando AI_PROVIDER es 'deepseek'")
    
    if errores:
        raise ValueError("Errores de configuración:\n" + "\n".join(f"  • {error}" for error in errores))
    
    return True