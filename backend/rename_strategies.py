#!/usr/bin/env python3
"""
Script para renombrar las carpetas de estrategias en Firebase Storage
De: Estrategia I, II, III, IV
A: Ambiental u OT, Economía, Población, Governabilidad
"""

import os
import sys
from pathlib import Path

# Agregar el directorio del backend al path para poder importar los módulos
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from services.firebase_service import get_storage_bucket, list_files_in_storage

def rename_strategy_folders():
    """Renombra las carpetas de estrategias en Firebase Storage"""
    
    # Mapeo de nombres antiguos a nuevos
    strategy_mapping = {
        "Estrategia I": "Ambiental u OT",
        "Estrategia II": "Economía", 
        "Estrategia III": "Población",
        "Estrategia IV": "Governabilidad"
    }
    
    bucket = get_storage_bucket()
    
    print("🔍 Listando archivos en PES_2030/...")
    files = list_files_in_storage(prefix="PES_2030/")
    
    # Agrupar archivos por estrategia
    files_by_strategy = {}
    for file_info in files:
        path = file_info.get("path", "")
        parts = path.split("/")
        
        if len(parts) >= 2 and parts[0] == "PES_2030":
            old_strategy = parts[1]
            if old_strategy in strategy_mapping:
                if old_strategy not in files_by_strategy:
                    files_by_strategy[old_strategy] = []
                files_by_strategy[old_strategy].append(file_info)
    
    # Renombrar cada estrategia
    for old_name, new_name in strategy_mapping.items():
        if old_name in files_by_strategy:
            print(f"\n📂 Procesando estrategia: {old_name} → {new_name}")
            files_to_rename = files_by_strategy[old_name]
            print(f"   Archivos encontrados: {len(files_to_rename)}")
            
            for file_info in files_to_rename:
                old_path = file_info["path"]
                new_path = old_path.replace(f"PES_2030/{old_name}/", f"PES_2030/{new_name}/", 1)
                
                try:
                    # Obtener el blob original
                    old_blob = bucket.blob(old_path)
                    
                    if old_blob.exists():
                        print(f"   📄 Moviendo: {old_path} → {new_path}")
                        
                        # Crear el nuevo blob copiando el contenido
                        new_blob = bucket.blob(new_path)
                        new_blob.upload_from_string(
                            old_blob.download_as_bytes(),
                            content_type=old_blob.content_type
                        )
                        
                        # Copiar metadata si existe
                        if old_blob.metadata:
                            new_blob.metadata = old_blob.metadata
                            new_blob.patch()
                        
                        # Eliminar el blob original
                        old_blob.delete()
                        
                        print(f"   ✅ Movido exitosamente")
                    else:
                        print(f"   ⚠️  El archivo no existe: {old_path}")
                        
                except Exception as e:
                    print(f"   ❌ Error moviendo {old_path}: {e}")
        else:
            print(f"⚠️  No se encontraron archivos para la estrategia: {old_name}")
    
    print("\n🎉 Proceso de renombrado completado!")

if __name__ == "__main__":
    print("🚀 Iniciando renombrado de carpetas de estrategias...")
    rename_strategy_folders()
