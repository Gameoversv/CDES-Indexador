import firebase_admin
from firebase_admin import credentials, firestore, auth  # añade `auth`
import os

# Carga el archivo de credenciales (descargado desde Firebase)
cred = credentials.Certificate("firebase-service-account.json")
firebase_admin.initialize_app(cred)

db = firestore.client()
