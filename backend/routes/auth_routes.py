from fastapi import APIRouter, Depends, HTTPException, status
from services.security import verify_firebase_token
from services.firebase_admin_tools import db

router = APIRouter()


@router.get("/me")
async def get_me(token_data=Depends(verify_firebase_token)):
    uid = token_data["user_id"]

    user_ref = db.collection("users").document(uid)
    doc = user_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no registrado en Firestore")

    user_data = doc.to_dict()

    if "role" not in user_data or "username" not in user_data:
        raise HTTPException(status_code=400, detail="El usuario no tiene rol o username definido")

    return {
        "user_id": uid,
        "email": token_data.get("email"),
        "username": user_data["username"],
        "role": user_data["role"],
        "custom_claims": token_data.get("custom_claims", {}),
        "admin": (
            user_data["role"] == "admin" or
            token_data.get("custom_claims", {}).get("admin") is True
        )
    }


# ✅ Funciones auxiliares consistentes

def get_current_user(token_data=Depends(verify_firebase_token)):
    return token_data


def get_current_admin_user(token_data=Depends(verify_firebase_token)):
    is_admin = (
        token_data.get("role") == "admin" or
        token_data.get("custom_claims", {}).get("role") == "admin" or
        token_data.get("admin") is True or
        token_data.get("custom_claims", {}).get("admin") is True
    )

    if not is_admin:
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos de administrador"
        )

    return token_data
