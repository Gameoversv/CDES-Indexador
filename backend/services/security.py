from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth

security = HTTPBearer()

def verify_firebase_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        decoded_token = auth.verify_id_token(token)

        # Claims personalizados: Firebase los expone al mismo nivel (e.g. decoded_token['admin'])
        custom_claims = decoded_token.get("custom_claims") or {}
        # Unificar detección de rol y admin
        role = (
            decoded_token.get("role")
            or custom_claims.get("role")
        )
        admin_flag = bool(
            decoded_token.get("admin")
            or custom_claims.get("admin")
        )

        return {
            "user_id": decoded_token.get("uid"),
            "email": decoded_token.get("email"),
            "role": role,
            "admin": admin_flag,
            "custom_claims": custom_claims,
        }
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de Firebase inválido o expirado",
        )
