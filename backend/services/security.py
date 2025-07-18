from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth

security = HTTPBearer()

def verify_firebase_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        decoded_token = auth.verify_id_token(token)

        # Obtener los claims personalizados correctamente
        custom_claims = decoded_token.get("custom_claims") or {}
        role = decoded_token.get("role") or custom_claims.get("role") or ("admin" if decoded_token.get("admin") else None)

        return {
            "user_id": decoded_token.get("uid"),
            "email": decoded_token.get("email"),
            "role": role,
            "custom_claims": custom_claims
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de Firebase inválido o expirado",
        )
