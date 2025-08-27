"""
Script para limpieza de datos del sistema.
- Elimina registros de Firestore (excepto usuario admin)
- Elimina registros de Meilisearch
- Elimina archivos de Firebase Storage
- Elimina usuarios de Firebase Authentication (excepto admin)
"""

import sys
import argparse
from pathlib import Path
import os

# Asegurar que los módulos del backend estén en el path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(backend_dir))

from config import settings
from services.firebase_service import (
    initialize_firebase,
    get_firestore_client,
    get_auth_client,
    get_storage_bucket
)
from services.meilisearch_service import initialize_meilisearch, client as meilisearch_client

ADMIN_EMAIL = "nose@admin.com"

def delete_firestore_documents():
    """Elimina todos los documentos en Firestore excepto el usuario admin."""
    print("\nEliminando documentos de Firestore...")
    db = get_firestore_client()
    
    # Lista de colecciones a limpiar
    collections = [
        'documents',
        'library',
        'audit_logs',
        'events',
        'files',
        'health_check',
        'password_reset_requests'
    ]
    
    # Eliminar documentos de todas las colecciones
    for collection in collections:
        print(f"\nEliminando documentos de la colección '{collection}'...")
        docs = db.collection(collection).stream()
        for doc in docs:
            print(f"Eliminando documento {doc.id}")
            doc.reference.delete()
    
    # Eliminar usuarios excepto el admin
    print("\nEliminando usuarios...")
    docs = db.collection('users').stream()
    for doc in docs:
        data = doc.to_dict()
        if data.get('email') != ADMIN_EMAIL:
            print(f"Eliminando usuario {data.get('email', doc.id)}")
            doc.reference.delete()

def delete_meilisearch_documents():
    """Elimina todos los documentos en Meilisearch."""
    print("\nEliminando documentos de Meilisearch...")
    
    if not meilisearch_client:
        print("Error: No se pudo conectar a Meilisearch")
        return
        
    try:
        # Eliminar documentos del índice principal
        index = meilisearch_client.index('documents')
        task = index.delete_all_documents()
        print("Documentos eliminados del índice principal")
        
        # Eliminar documentos del índice de biblioteca
        library_index = meilisearch_client.index('library')
        task = library_index.delete_all_documents()
        print("Documentos eliminados del índice de biblioteca")
    except Exception as e:
        print(f"Error eliminando documentos de Meilisearch: {e}")

def delete_storage_files():
    """Elimina todos los archivos en Firebase Storage."""
    print("\nEliminando archivos de Firebase Storage...")
    bucket = get_storage_bucket()
    
    blobs = bucket.list_blobs()
    for blob in blobs:
        print(f"Eliminando archivo: {blob.name}")
        blob.delete()

def delete_firebase_users():
    """Elimina todos los usuarios en Firebase Authentication excepto el admin."""
    print("\nEliminando usuarios de Firebase Authentication...")
    auth = get_auth_client()
    
    try:
        # Listar todos los usuarios
        users = auth.list_users()
        for user in users.users:
            if user.email != ADMIN_EMAIL:
                print(f"Eliminando usuario: {user.email}")
                auth.delete_user(user.uid)
    except Exception as e:
        print(f"Error eliminando usuarios: {e}")

def main():
    parser = argparse.ArgumentParser(description='Script de limpieza de datos del sistema')
    parser.add_argument('--all', action='store_true', help='Ejecutar todas las operaciones de limpieza')
    parser.add_argument('--firestore', action='store_true', help='Limpiar solo Firestore')
    parser.add_argument('--meilisearch', action='store_true', help='Limpiar solo Meilisearch')
    parser.add_argument('--storage', action='store_true', help='Limpiar solo Firebase Storage')
    parser.add_argument('--users', action='store_true', help='Limpiar solo usuarios de Firebase')
    parser.add_argument('--yes', '-y', action='store_true', help='No pedir confirmación')
    
    args = parser.parse_args()
    
    # Si no se especifica ninguna opción, mostrar ayuda
    if not any([args.all, args.firestore, args.meilisearch, args.storage, args.users]):
        parser.print_help()
        return
    
    # Inicializar servicios
    print("Inicializando servicios...")
    initialize_firebase()
    initialize_meilisearch()
    
    # Confirmar operación
    if not args.yes:
        operations = []
        if args.all or args.firestore:
            operations.append("Firestore")
        if args.all or args.meilisearch:
            operations.append("Meilisearch")
        if args.all or args.storage:
            operations.append("Firebase Storage")
        if args.all or args.users:
            operations.append("Firebase Authentication")
            
        print("\n¡ADVERTENCIA! Esta operación eliminará datos de:", ", ".join(operations))
        print(f"Los datos del usuario admin ({ADMIN_EMAIL}) serán preservados.")
        confirm = input("\n¿Está seguro que desea continuar? [y/N]: ")
        if confirm.lower() != 'y':
            print("Operación cancelada")
            return
    
    try:
        # Ejecutar operaciones seleccionadas
        if args.all or args.firestore:
            delete_firestore_documents()
            
        if args.all or args.meilisearch:
            delete_meilisearch_documents()
            
        if args.all or args.storage:
            delete_storage_files()
            
        if args.all or args.users:
            delete_firebase_users()
            
        print("\n¡Limpieza completada exitosamente!")
        
    except Exception as e:
        print(f"\nError durante la limpieza: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()