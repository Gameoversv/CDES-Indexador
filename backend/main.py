# backend/main.py

from fastapi import FastAPI, Request, status, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import asyncio

from config import settings
from services.firebase_service import (
    initialize_firebase, get_firestore_client, get_auth_client, verify_token
)
from services.meilisearch_service import initialize_meilisearch
from utils.audit_logger import log_event
from routes import auth_routes, document_routes, audit_routes, user_routes

# ============================
# Inicialización del backend
# ============================

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        initialize_firebase()
        firestore = get_firestore_client()
        firestore.collection("health_check").document("test").set({"status": "ok"})
    except Exception as e:
        print(f"❌ Error iniciando Firebase: {e}")

    try:
        initialize_meilisearch()
    except Exception as e:
        print(f"❌ Error iniciando Meilisearch: {e}")

    if settings.APP_ENV == "development":
        await _crear_usuario_admin_inicial()
        await asignar_claim_admin_manual()  # ✅ Asignar admin manualmente a Wilkin

    yield  # Backend listo


async def _crear_usuario_admin_inicial():
    admin_email = "admin@example.com"
    admin_password = "adminpassword"

    try:
        user = None
        try:
            user = get_auth_client().get_user_by_email(admin_email)
        except Exception:
            pass

        if not user:
            new_user = get_auth_client().create_user(
                email=admin_email,
                password=admin_password
            )
            get_auth_client().set_custom_user_claims(new_user.uid, {'admin': True})
            log_event(new_user.uid, 'ADMIN_USER_CREATED', {'email': admin_email})
        else:
            user_claims = get_auth_client().get_user(user.uid).custom_claims
            if not user_claims or not user_claims.get("admin"):
                get_auth_client().set_custom_user_claims(user.uid, {'admin': True})
                log_event(user.uid, 'ADMIN_CLAIM_UPDATED', {'email': admin_email})

    except Exception as e:
        print(f"⚠️ Error creando admin inicial: {e}")


async def asignar_claim_admin_manual():
    """
    Asigna manualmente el claim de administrador a un usuario específico por correo.
    SOLO USAR EN DESARROLLO.
    """
    email = "wilkinvargas@hotmail.com"
    try:
        user = get_auth_client().get_user_by_email(email)
        get_auth_client().set_custom_user_claims(user.uid, {"admin": True})
        print(f"✅ Claim de administrador asignado correctamente a: {email}")
    except Exception as e:
        print(f"❌ Error al asignar claim a {email}: {e}")


# ============================
# Configuración de FastAPI
# ============================

app = FastAPI(
    title="Indexador de Documentos con Gemini AI",
    version="1.0.0",
    lifespan=lifespan,
    description="API REST para indexar documentos con Gemini AI, Firebase y Meilisearch.",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS: permitir peticiones desde el frontend
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================
# Rutas de la API
# ============================

app.include_router(auth_routes.router, prefix="/auth", tags=["🔐 Autenticación"])
app.include_router(user_routes.router, prefix="/admin/users", tags=["👤 Usuarios"])

app.include_router(document_routes.router, prefix="/documents", tags=["📄 Documentos"])
app.include_router(audit_routes.router, prefix="/audit", tags=["📊 Auditoría"])


# ============================
# Endpoints básicos
# ============================

@app.get("/", tags=["🏠 General"])
async def root():
    return {
        "message": "🚀 Bienvenido al Indexador de Documentos con Gemini AI",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "✅ Operativo"
    }


@app.get("/health", tags=["🏠 General"])
async def health_check():
    return {
        "status": "healthy",
        "firebase": "✅",
        "meilisearch": "✅"
    }


@app.get("/users/me", tags=["👤 Usuarios"])
async def get_current_user(token_data=Depends(verify_token)):
    return token_data


# ============================
# Manejador global de errores
# ============================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"❌ Error en {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Error interno del servidor",
            "message": "Algo salió mal. Intenta de nuevo.",
            "code": "INTERNAL_SERVER_ERROR"
        },
    )


# ============================
# Punto de entrada para dev
# ============================

if __name__ == "__main__":
    print("📖 Ejecuta con: uvicorn main:app --reload")
