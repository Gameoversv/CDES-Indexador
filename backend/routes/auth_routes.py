from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import verify_firebase_token
from app.core.firebase_admin import db

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

    # 🔄 Devuelve directo sin anidar
    return {
        "uid": uid,
        "email": token_data.get("email"),
        "username": user_data["username"],
        "role": user_data["role"]
    }
