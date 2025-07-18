# routes/profile_routes.py
from fastapi import APIRouter, Depends, HTTPException
from services.firebase_service import verify_token, get_firestore_client

router = APIRouter()

@router.get("/users/me")
async def get_logged_user(token_data=Depends(verify_token)):
    """
    Devuelve los datos del usuario autenticado usando su UID de Firebase.
    """
    uid = token_data["user_id"]
    firestore = get_firestore_client()
    doc_ref = firestore.collection("users").document(uid)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user_data = doc.to_dict()
    user_data["id"] = doc.id
    return user_data
