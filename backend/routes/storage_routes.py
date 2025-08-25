# backend/routes/storage_routes.py

from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File, Form, Query
from services.firebase_service import (
    verify_token,
    get_firestore_client,
    list_files_in_storage,
    get_storage_bucket,
    get_auth_client,  # Añadir esta importación
    list_cover_images,
    get_cover_image_url,
    get_documents_by_storage_path,
    delete_document_from_firestore,
)
from google.cloud.firestore_v1.base_query import FieldFilter
#from firebase_admin import firestore  # Importar el módulo firestore para acceder a SERVER_TIMESTAMP
from utils.audit_logger import log_event, log_error
from typing import Dict, Any, List, Optional
import unicodedata
import asyncio
from pydantic import BaseModel
from services.meilisearch_service import delete_document

router = APIRouter(
    prefix="/storage",
    tags=["storage"],
    responses={
        401: {"description": "No autenticado"},
        403: {"description": "Sin permisos"},
        500: {"description": "Error interno del servidor"}
    }
)

# Mapeo de roles del sistema a carpetas de Firebase Storage
# Claves normalizadas (minúsculas, sin acentos, sin espacios)
ROLE_TO_FOLDER_MAPPING: Dict[str, str] = {
    # Administrativos (verán toda la raíz: esta clave no se usa como carpeta)
    # 'DireccionEjecutiva' se trata aparte devolviendo None para acceso completo.
    "direccionejecutiva": None,  # Acceso a toda la raíz

    # Unidades/roles con carpetas propias (usa exactamente el nombre de carpeta en Storage)
    "coordinacionadministrativa": "Coordinación Administrativa",
    "coordinadoradministrativa": "Coordinación Administrativa",
    
    # COORDINACIÓN PROYECTOS Y PLANIFICACIÓN
    # Aceptar cualquier variante y normalizar al nombre REAL en Storage
    "coordinacionproyectosyplanificacion": "Coordinación Proyectos y Planificación",
    "coordinacionproyectosplanificacion": "Coordinación Proyectos y Planificación",
    "coordinacion proyectos y planificacion": "Coordinación Proyectos y Planificación",
    "coordinacion proyectos planificacion": "Coordinación Proyectos y Planificación",
    "coordinacionproyectos": "Coordinación Proyectos y Planificación",
    "coordinacionplanificacion": "Coordinación Proyectos y Planificación",
    "proyectosplanificacion": "Coordinación Proyectos y Planificación",
    "proyectosyplanificacion": "Coordinación Proyectos y Planificación",
    "proyectos": "Coordinación Proyectos y Planificación",
    "planificacion": "Coordinación Proyectos y Planificación",
    
    # COORDINACIÓN DE COMUNICACIONES
    "coordinaciondecomunicaciones": "Coordinación de Comunicaciones",
    "coordinacioncomunicaciones": "Coordinación de Comunicaciones",
    "comunicaciones": "Coordinación de Comunicaciones",
    "coordinacioncomunicacion": "Coordinación de Comunicaciones",
    
    # ASISTENCIA GENERAL
    "asistenciageneral": "Asistencia General",
}

def _norm(text: Optional[str]) -> str:
    if not isinstance(text, str):
        return ""
    # quita acentos, pasa a ascii, minúsculas y sin espacios/guiones/bajos
    t = unicodedata.normalize("NFD", text)
    t = t.encode("ascii", "ignore").decode("utf-8").lower()
    for ch in [" ", "_", "-", "/", "."]:
        t = t.replace(ch, "")
    return t.strip()

def _strip_accents_keep_spaces(text: Optional[str]) -> str:
    if not isinstance(text, str):
        return ""
    t = unicodedata.normalize("NFD", text)
    t = t.encode("ascii", "ignore").decode("utf-8")
    return t

def _find_actual_role_folder_prefix(role_folder: Optional[str]) -> Optional[str]:
    """
    Busca bajo CDES_inst/ la carpeta real que corresponde a role_folder,
    haciendo match por nombre normalizado (sin acentos/espacios).
    Devuelve el prefijo exacto 'CDES_inst/<RealName>/' si lo encuentra.
    """
    if not role_folder:
        return None
        
    target_norm = _norm(role_folder)
    
    # Mapeo directo de roles normalizados a carpetas exactas en storage
    EXACT_FOLDER_MAPPING = {
        "coordinacionproyectosyplanificacion": "CDES_inst/Coordinación Proyectos y Planificación/",
        "coordinacionadministrativa": "CDES_inst/Coordinación Administrativa/",
        "coordinadoradministrativa": "CDES_inst/Coordinación Administrativa/",
        "coordinaciondecomunicaciones": "CDES_inst/Coordinación de Comunicaciones/",
        "coordinacioncomunicaciones": "CDES_inst/Coordinación de Comunicaciones/",
        "asistenciageneral": "CDES_inst/Asistencia General/",
        "direccionejecutiva": "CDES_inst/Dirección Ejecutiva/",
    }
    
    # Verificar si tenemos un mapeo exacto
    if target_norm in EXACT_FOLDER_MAPPING:
        exact_prefix = EXACT_FOLDER_MAPPING[target_norm]
        return exact_prefix
    
    # Casos especiales por patrón de nombre
    # Caso especial para Coordinación Proyectos y Planificación
    if any(pattern in target_norm for pattern in ["proyecto", "planific", "coordinacionproyecto"]):
        return "CDES_inst/Coordinación Proyectos y Planificación/"
        
    # Caso para Coordinación Administrativa
    if any(pattern in target_norm for pattern in ["admin", "administrativa"]):
        return "CDES_inst/Coordinación Administrativa/"
        
    # Caso para Coordinación de Comunicaciones
    if any(pattern in target_norm for pattern in ["comunicacion", "comunicaciones"]):
        return "CDES_inst/Coordinación de Comunicaciones/"
        
    # Caso para Asistencia General
    if any(pattern in target_norm for pattern in ["asistencia", "asisten", "general"]):
        return "CDES_inst/Asistencia General/"
    
    # Si no se encuentra un mapeo directo, buscar la carpeta en storage
    try:
        candidates = list_files_in_storage(prefix="CDES_inst/")
        
        # Extraer los nombres de las carpetas de primer nivel bajo CDES_inst/
        first_levels: Dict[str, str] = {}
        for f in candidates:
            p = (f.get("path") or "").strip("/")
            if not p.startswith("CDES_inst/"):
                continue
            rel = p[len("CDES_inst/"):]
            if not rel:
                continue
            head = rel.split("/")[0]
            if head:
                first_levels[_norm(head)] = head  # map norm->real
        
        # Buscar coincidencia exacta primero
        real = first_levels.get(target_norm)
        if real:
            prefix = f"CDES_inst/{real}/"
            return prefix
            
        # Si no hay coincidencia exacta, buscar coincidencia parcial
        for norm_name, real_name in first_levels.items():
            if target_norm in norm_name or norm_name in target_norm:
                prefix = f"CDES_inst/{real_name}/"
                return prefix
                
        return None
        
    except Exception as e:
        return None

def get_storage_folder_for_user(user_role: Optional[str], email: Optional[str]) -> Optional[str]:
    """
    Determina la carpeta de Firebase Storage basada en el rol del usuario.
    Si es DireccionEjecutiva, retorna None para acceder a toda la raíz.
    """
    nr = _norm(user_role)
    
    # 1. Primero revisar mapeo directo desde el diccionario
    if nr in ROLE_TO_FOLDER_MAPPING:
        folder = ROLE_TO_FOLDER_MAPPING[nr]
        return folder
    
    # 2. Casos especiales por nombres de rol (en caso de que no estén en el diccionario)
    # Usuarios administrativos (Dirección Ejecutiva) ven toda la estructura
    if nr in {"direccionejecutiva", "direccion ejecutiva", "direccion"}:
        return None  # None significa acceso a toda la raíz CDES_inst/
    
    # Coordinación Proyectos y Planificación
    if nr and ("proyectos" in nr or "planificacion" in nr or "planific" in nr or 
               "coordinacionproyectos" in nr or "proyectosyplanificacion" in nr):
        return "Coordinación Proyectos y Planificación"
    
    # Coordinación de Comunicaciones
    if nr and ("comunicacion" in nr or "comunicaciones" in nr or "coms" in nr):
        return "Coordinación de Comunicaciones"
    
    # Coordinación Administrativa
    if nr and ("admin" in nr or "administrativa" in nr or "coordinacionadmin" in nr or "coordinadoradmin" in nr):
        return "Coordinación Administrativa"
    
    # Asistencia General
    if nr and ("asistencia" in nr or "asisten" in nr or "general" in nr):
        return "Asistencia General"

    # 3. Si no se ha encontrado coincidencia por rol, intentar por email
    if isinstance(email, str) and email:
        e = email.lower()
        
        # Verificar patrones administrativos en email
        if any(pattern in e for pattern in ["director", "ejecutiv", "direccion"]):
            return None  # Acceso administrativo completo
        
        # Casos específicos para correos conocidos
        if e in ["proyectos@cdes.cl", "coordinacionproyectos@cdes.cl", "planificacion@cdes.cl", 
                "coordproyectos@cdes.cl", "coordplanificacion@cdes.cl"]:
            return "Coordinación Proyectos y Planificación"
        
        if e in ["coordadmin@gmail.com", "administrativa@cdes.cl", "admin@cdes.cl"]:
            return "Coordinación Administrativa"
            
        # Patrones de email generales
        if "asistente" in e or "asist" in e or "asistencia" in e or "general" in e:
            return "Asistencia General"
            
        if ("coord" in e and ("admin" in e or "administr" in e)) or "administrativa" in e or "administracion" in e:
            return "Coordinación Administrativa"
            
        if "proyectos" in e or "planificacion" in e or "planific" in e:
            return "Coordinación Proyectos y Planificación"
            
        if "comunicacion" in e or "comunicaciones" in e or "coms" in e:
            return "Coordinación de Comunicaciones"

    # 4. Sin coincidencias: retornar cadena vacía para que solo vea PES_2030
    return ""

def _build_tree_from_paths(file_list: List[Dict[str, Any]], root_path: str) -> List[Dict[str, Any]]:
    """Construye un árbol jerárquico a partir de blobs, incluyendo carpetas vacías.
    Si un blob es un marcador de carpeta (termina en '/'), lo añade como folder.
    """
    tree: Dict[str, Any] = {"children": {}}

    for file_info in file_list:
        blob_path = (file_info.get("path") or "").strip("/")
        if not blob_path:
            continue

        # Relativizar desde root si aplica
        rel = blob_path
        if root_path:
            rp = root_path.rstrip("/")
            if blob_path.startswith(rp):
                rel = blob_path[len(rp):].lstrip("/")

        parts = [p for p in rel.split("/") if p]
        if not parts:
            continue

        is_folder_marker = bool(file_info.get("is_folder"))
        current = tree["children"]
        path_accum: List[str] = []

        for i, part in enumerate(parts):
            path_accum.append(part)
            full_path = "/".join(path_accum) + ("/" if (i < len(parts) - 1 or (is_folder_marker and i == len(parts) - 1)) else "")
            is_last = i == len(parts) - 1

            # Si no existe la carpeta intermedia, crearla
            if part not in current:
                current[part] = {
                    "name": part,
                    "type": "folder" if (not is_last or is_folder_marker) else "file",
                    "path": full_path,
                    **({"children": {}} if (not is_last or is_folder_marker) else {}),
                }

            node = current[part]

            if is_last:
                if is_folder_marker:
                    # Asegurar que el último nodo sea folder
                    node["type"] = "folder"
                    node["path"] = full_path
                    node.setdefault("children", {})
                else:
                    # Archivo en la hoja
                    node.update({
                        "name": part,
                        "type": "file",
                        "path": blob_path,
                        "size": file_info.get("size"),
                        "updated": file_info.get("updated"),
                        "contentType": file_info.get("content_type"),
                    })
            else:
                # Descender a hijos
                current = node.setdefault("children", {})

    def dict_to_sorted_list(d: Dict[str, Any]) -> List[Dict[str, Any]]:
        items = []
        for v in d.values():
            if v.get("type") == "folder" and isinstance(v.get("children"), dict):
                v["children"] = dict_to_sorted_list(v["children"])
            items.append(v)
        items.sort(key=lambda x: (0 if x.get("type") == "folder" else 1, x.get("name", "")))
        return items

    return dict_to_sorted_list(tree["children"]) or []


@router.get("/tree", status_code=status.HTTP_200_OK)
async def get_storage_tree(request: Request, token_data: Dict[str, Any] = Depends(verify_token)):
    """
    Endpoint seguro que devuelve la estructura jerárquica de archivos
    correspondiente al rol del usuario autenticado.
    """
    uid = token_data.get("user_id")
    email = token_data.get("email")
    firestore = get_firestore_client()

    try:
        # 1. Obtener el rol del usuario desde Firestore (o token como fallback)
        user_doc_ref = firestore.collection("users").document(uid)
        user_doc = user_doc_ref.get()

        user_role = None
        if user_doc.exists:
            user_data = user_doc.to_dict()
            # Prioritize 'puesto_trabajo' (folder name used in storage), then legacy 'puesto', then 'role'
            user_role = user_data.get("puesto_trabajo") or user_data.get("puesto") or user_data.get("role")
        else:
            # Intentar localizar por email si el doc por UID no existe
            try:
                if email:
                    # Buscar el usuario por email (usando filter keyword)
                    candidates = list(firestore.collection("users").where(filter=FieldFilter("email", "==", email)).limit(1).stream())
                    if candidates:
                        cdoc = candidates[0]
                        cdata = cdoc.to_dict() or {}
                        user_role = cdata.get("puesto_trabajo") or cdata.get("puesto") or cdata.get("role")
            except Exception as qe:
                pass
            # Intentar claims del token (role/puesto_trabajo en custom_claims)
            if not user_role:
                try:
                    claims = token_data.get("custom_claims", {}) or {}
                    user_role = (
                        token_data.get("role")
                        or claims.get("puesto_trabajo")
                        or claims.get("puesto")
                        or claims.get("role")
                    )
                except Exception as ce:
                    pass
            # FALLBACK DIRECTO: Si no se encuentra el usuario en Firestore, usar el email para inferir rol
            e = (email or "").strip().lower()
            if not user_role and e:
                if e == "coordadmin@gmail.com":
                    user_role = "Coordinación Administrativa"
                elif ("director" in e) or ("ejecutiv" in e):
                    user_role = "Dirección Ejecutiva"
                elif ("asistente" in e) or ("general" in e):
                    user_role = "Asistencia General"
                elif ("proyectos" in e) or ("planificacion" in e) or ("planific" in e):
                    user_role = "Coordinación Proyectos y Planificación"
                elif ("comunicacion" in e) or ("comunicaciones" in e):
                    user_role = "Coordinación de Comunicaciones"

        # 2. Determinar la carpeta de storage usando el mapeo inteligente
        storage_folder = get_storage_folder_for_user(user_role, email)
        
        # CASO ESPECIAL - FORZAR COMO COORDINACIÓN PROYECTOS Y PLANIFICACIÓN
        if not storage_folder and email in ["coordadmin@gmail.com", "proyectos@cdes.cl", "planificacion@cdes.cl"]:
            storage_folder = "CoordinacionProyectosPlanificacion"
        
        # 3. Construir el listado de blobs permitido según el rol
        files_list: List[Dict[str, Any]] = []
        root_path = ""  # Para construir un árbol desde la raíz visual (limitando contenidos según permisos)

        if storage_folder is None:
            # Usuario administrativo (DireccionEjecutiva) - ve toda la estructura desde la raíz
            files_list = list_files_in_storage(prefix=root_path)

            # Asegurar presencia de carpetas raíz conocidas, incluso si están vacías
            expected_roots = [
                "CDES_inst/",
                "PES_2030/",
            ]
            for marker in expected_roots:
                if not any(f.get("path") == marker for f in files_list):
                    files_list.append({
                        "path": marker,
                        "filename": marker.rstrip("/"),
                        "size": 0,
                        "updated": None,
                        "content_type": "application/x-directory",
                        "is_folder": True,
                    })
            # Importante: no crear marcadores de carpetas de roles inexistentes
        else:
            # Usuario no admin: SOLO ver su carpeta específica y la carpeta PES_2030
            allowed_prefixes: List[str] = ["PES_2030/"]
            
            if storage_folder:
                # Construir el prefijo de la carpeta en CDES_inst/
                role_prefix = _find_actual_role_folder_prefix(storage_folder)
                
                if role_prefix:
                    allowed_prefixes.append(role_prefix)
                    
                    # Agregar variantes potenciales para la carpeta
                    # Esto ayuda con inconsistencias en nombres de carpetas
                    variants = []
                    
                    # Variantes sin acentos
                    sf_no_accents = _strip_accents_keep_spaces(storage_folder)
                    if sf_no_accents != storage_folder:
                        variants.append(f"CDES_inst/{sf_no_accents}/")
                    
                    # Variante con el nombre original del rol
                    variants.append(f"CDES_inst/{storage_folder}/")
                    
                    # Casos especiales para roles conocidos
                    if "proyectos" in _norm(storage_folder) or "planificacion" in _norm(storage_folder):
                        variants.extend([
                            "CDES_inst/Coordinación Proyectos y Planificación/",
                            "CDES_inst/CoordinacionProyectosPlanificacion/",
                            "CDES_inst/Coordinacion Proyectos y Planificacion/",
                            "CDES_inst/Coordinacion Proyectos Planificacion/",
                        ])
                    
                    if "admin" in _norm(storage_folder) or "administrativa" in _norm(storage_folder):
                        variants.extend([
                            "CDES_inst/Coordinación Administrativa/",
                            "CDES_inst/CoordinacionAdministrativa/",
                        ])
                        
                    if "comunicacion" in _norm(storage_folder):
                        variants.extend([
                            "CDES_inst/Coordinación de Comunicaciones/",
                            "CDES_inst/CoordinaciondeComunicaciones/",
                        ])
                        
                    if "asistencia" in _norm(storage_folder) or "general" in _norm(storage_folder):
                        variants.extend([
                            "CDES_inst/Asistencia General/",
                            "CDES_inst/AsistenciaGeneral/",
                        ])
                    
                    # Agregar todas las variantes únicas
                    for v in variants:
                        if v not in allowed_prefixes:
                            allowed_prefixes.append(v)
                else:
                    # Si no se encontró un prefijo, intentar con el nombre directo
                    direct_prefix = f"CDES_inst/{storage_folder}/"
                    allowed_prefixes.append(direct_prefix)

            # Obtener archivos para cada prefijo permitido
            for pref in allowed_prefixes:
                try:
                    pref_files = list_files_in_storage(prefix=pref)
                    files_list.extend(pref_files)
                except Exception as e:
                    pass

            # Asegurar que siempre existan las carpetas principales
            # Añadir marcador de carpeta CDES_inst/ siempre
            if not any(f.get("path") == "CDES_inst/" for f in files_list):
                files_list.append({
                    "path": "CDES_inst/",
                    "filename": "CDES_inst",
                    "size": 0,
                    "updated": None,
                    "content_type": "application/x-directory",
                    "is_folder": True,
                })
                
            # Añadir la carpeta de rol del usuario bajo CDES_inst/
            if storage_folder:
                role_path = f"CDES_inst/{storage_folder}/"
                if not any(f.get("path") == role_path for f in files_list):
                    files_list.append({
                        "path": role_path,
                        "filename": storage_folder,
                        "size": 0,
                        "updated": None,
                        "content_type": "application/x-directory",
                        "is_folder": True,
                    })
            
            # Añadir la carpeta PES_2030/
            if not any(f.get("path") == "PES_2030/" for f in files_list):
                files_list.append({
                    "path": "PES_2030/",
                    "filename": "PES_2030",
                    "size": 0,
                    "updated": None,
                    "content_type": "application/x-directory",
                    "is_folder": True,
                })

        # 5. Construir la respuesta JSON jerárquica
        file_tree = _build_tree_from_paths(files_list, root_path)

        log_event(
            user_id=uid,
            event_type="STORAGE_TREE_ACCESSED",
            details={
                "role": user_role,
                "email": email,
                "storage_folder": ("ALL_FOLDERS" if storage_folder is None else (storage_folder or "NO_FOLDER_ASSIGNED")),
                "access_type": "ADMIN_FULL_ACCESS" if storage_folder is None else "USER_ROLE_AND_PES2030",
                "path": root_path,
                "file_count": len(files_list),
            },
            severity="INFO",
        )

        return file_tree

    except HTTPException:
        # Re-lanzar excepciones HTTP para que FastAPI las maneje
        raise
    except Exception as e:
        log_error(error=e, context="GET /storage/tree", user_id=uid)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Ocurrió un error al construir el árbol de carpetas.")
    
class CreateFolderRequest(BaseModel):
    nombre: str
    ruta_padre: Optional[str] = None

@router.post("/folders", status_code=status.HTTP_201_CREATED)
async def create_folder(request: Request, folder: CreateFolderRequest, token_data: Dict[str, Any] = Depends(verify_token)):
    """Crea una nueva carpeta en Firebase Storage dentro de la ruta especificada.
    Restricción: Solo 'Dirección Ejecutiva' puede crear carpetas.
    """
    uid = token_data.get("user_id")
    email = token_data.get("email")
    firestore = get_firestore_client()

    # 1. Obtener rol del usuario para determinar carpeta base permitida
    user_role = None
    user_doc = firestore.collection("users").document(uid).get()
    if user_doc.exists:
        user_data = user_doc.to_dict()
        user_role = user_data.get("role")
    # Permitir crear SOLO si es Dirección Ejecutiva
    norm_role = _norm(user_role)
    is_admin = norm_role == "direccionejecutiva" or (isinstance(email, str) and any(p in email.lower() for p in ["director", "ejecutiv"]))
    if not is_admin:
        raise HTTPException(status_code=403, detail="Solo Dirección Ejecutiva puede crear carpetas.")
    # Admin opera en cualquier ruta; allowed_prefix vacío implica raíz completa
    storage_folder = None
    allowed_prefix = ""

    # 2. Validar nombre de nueva carpeta
    nombre = folder.nombre.strip()
    if not nombre or any(char in nombre for char in ['..', '/', '\\', '<', '>', ':', '"', '|', '?', '*']):
        raise HTTPException(status_code=400, detail="Nombre de carpeta inválido.")
    # Construir ruta completa de la nueva carpeta
    parent_path = folder.ruta_padre.strip() if folder.ruta_padre else ""
    if parent_path.endswith("/"):
        parent_path = parent_path[:-1]  # quitar "/" final
    # Si el usuario no es admin, asegurar que la ruta padre está dentro de su carpeta permitida
    if allowed_prefix and not parent_path.startswith(allowed_prefix.rstrip("/")):
        raise HTTPException(status_code=403, detail="No tiene permisos para crear en la ruta especificada.")
    # Ruta completa del nuevo folder (terminada en '/')
    new_folder_path = f"{parent_path + '/' if parent_path else ''}{nombre}/"

    try:
        bucket = get_storage_bucket()
        blob = bucket.blob(new_folder_path)
        if blob.exists():
            raise HTTPException(status_code=409, detail="La carpeta ya existe.")
        # Crear carpeta como objeto vacío en Storage
        blob.upload_from_string(b"", content_type="application/x-www-form-urlencoded;charset=UTF-8")  # carpeta vacía:contentReference[oaicite:1]{index=1}
        # Log de auditoría
        log_event(
            user_id=uid,
            event_type="STORAGE_FOLDER_CREATED",
            details={
                "email": email,
                "role": user_role or "",
                "folder_path": new_folder_path
            },
            severity="INFO"
        )
        return {"message": "Carpeta creada exitosamente.", "path": new_folder_path}
    except HTTPException:
        raise
    except Exception as e:
        # Registrar error en log y lanzar 500 genérico
        log_error(error=e, context="POST /storage/folders", user_id=uid, additional_details={"folder_path": nombre})
        raise HTTPException(status_code=500, detail="Error al crear la carpeta.")


@router.post("/upload_by_path", status_code=status.HTTP_201_CREATED)
async def upload_by_storage_path(
    request: Request,
    path: str = Form(..., description="Ruta de carpeta de destino (sin nombre de archivo)"),
    file: UploadFile = File(...),
    token_data: Dict[str, Any] = Depends(verify_token),
):
    """Sube un archivo binario a una ruta de carpeta específica en Firebase Storage.
    Restricción: Solo 'Dirección Ejecutiva' puede subir documentos.
    """
    from services.firebase_service import upload_file_to_storage  # import local para evitar ciclos

    uid = token_data.get("user_id")
    email = token_data.get("email")
    firestore = get_firestore_client()

    # Determinar rol y validar permisos (solo admin puede subir)
    user_role = None
    user_doc = firestore.collection("users").document(uid).get()
    if user_doc.exists:
        user_role = (user_doc.to_dict() or {}).get("role")
    norm_role = _norm(user_role)
    is_admin = norm_role == "direccionejecutiva" or (isinstance(email, str) and any(p in email.lower() for p in ["director", "ejecutiv"]))
    if not is_admin:
        raise HTTPException(status_code=403, detail="Solo Dirección Ejecutiva puede subir documentos.")
    allowed_prefix = ""  # admin puede escribir en cualquier ruta

    # Normalizar path y validar
    target_dir = (path or "").strip()
    if target_dir and not target_dir.endswith("/"):
        target_dir = target_dir + "/"

    # Si no se especifica ruta, usar raíz
    if not target_dir:
        target_dir = ""

    # Admin: no aplica validación de prefijo

    # Construir blob path final
    safe_name = (file.filename or "").strip()
    if not safe_name:
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido")
    dangerous = ['..', '\\', '<', '>', ':', '"', '|', '?', '*']
    if any(ch in safe_name for ch in dangerous):
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido")

    blob_path = f"{target_dir}{safe_name}"

    try:
        content = await file.read()
        await asyncio.to_thread(upload_file_to_storage, content, blob_path, file.content_type)
        log_event(
            user_id=uid,
            event_type="STORAGE_FILE_UPLOADED",
            details={
                "email": email,
                "role": user_role or "",
                "path": blob_path,
                "size": len(content),
                "content_type": file.content_type,
            },
            severity="INFO",
        )
        return {"message": "Archivo subido", "path": blob_path}
    except HTTPException:
        raise
    except Exception as e:
        log_error(error=e, context="POST /storage/upload_by_path", user_id=uid, additional_details={"path": blob_path})
        raise HTTPException(status_code=500, detail="Error al subir el archivo")


@router.get("/cover-images")
async def get_cover_images(
    request: Request,
    token_data: Dict[str, Any] = Depends(verify_token)
):
    """
    Lista todas las imágenes de portada almacenadas en Biblioteca_Portadas/
    """
    try:
        user_id = token_data.get("user_id", "")
        
        images = list_cover_images()
        
        log_event(
            user_id=user_id,
            event_type="COVER_IMAGES_LISTED",
            details={
                "count": len(images),
                "user_email": token_data.get("email", "")
            },
            severity="INFO"
        )
        
        return {
            "images": images,
            "count": len(images)
        }
        
    except Exception as e:
        log_error(
            error=e,
            context="GET /storage/cover-images",
            user_id=token_data.get("user_id", ""),
            additional_details={"user_email": token_data.get("email", "")}
        )
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener imágenes de portada: {str(e)}"
        )


@router.delete("/delete")
async def delete_storage_item(
    request: Request,
    path: str = Query(..., description="Ruta del archivo o carpeta a eliminar"),
    token_data: Dict[str, Any] = Depends(verify_token),
):
    """
    Elimina un archivo o carpeta de Firebase Storage.
    También elimina los documentos correspondientes de Firestore y Meilisearch.
    Restricción: Solo 'Dirección Ejecutiva' puede eliminar.
    """
    from services.firebase_service import delete_file_from_storage, delete_folder_from_storage
    
    uid = token_data.get("user_id")
    email = token_data.get("email")
    firestore = get_firestore_client()

    # Determinar rol y validar permisos (solo admin puede eliminar)
    user_role = None
    user_doc = firestore.collection("users").document(uid).get()
    if user_doc.exists:
        user_role = (user_doc.to_dict() or {}).get("role")
    norm_role = _norm(user_role)
    is_admin = norm_role == "direccionejecutiva" or (isinstance(email, str) and any(p in email.lower() for p in ["director", "ejecutiv"]))
    
    if not is_admin:
        raise HTTPException(status_code=403, detail="Solo Dirección Ejecutiva puede eliminar")
    
    # Normalizar y validar path
    item_path = (path or "").strip()
    if not item_path:
        raise HTTPException(status_code=400, detail="Ruta no especificada")
    
    # Determinar si es archivo o carpeta
    is_folder = item_path.endswith("/")
    
    try:
        if is_folder:
            # 1. Primero encontrar todos los documentos que están dentro de esta carpeta
            docs_to_delete = []
            storage_paths_to_check = []
            
            # Listar todos los archivos en esta carpeta
            files_in_folder = list_files_in_storage(prefix=item_path)
            for file_info in files_in_folder:
                if not file_info.get("is_folder"):
                    storage_paths_to_check.append(file_info.get("path"))
            
            # Buscar documentos asociados a estos archivos en Firestore
            for storage_path in storage_paths_to_check:
                found_docs = get_documents_by_storage_path(storage_path)
                docs_to_delete.extend(found_docs)
            
            # 2. Eliminar la carpeta de Firebase Storage
            result = await asyncio.to_thread(delete_folder_from_storage, item_path)
            
            # 3. Eliminar documentos de Firestore y Meilisearch
            for doc in docs_to_delete:
                doc_id = doc.get("id")
                file_id = doc.get("file_id")
                
                # Eliminar de Firestore
                if doc_id:
                    await asyncio.to_thread(delete_document_from_firestore, doc_id)
                
                # Eliminar de Meilisearch (usando file_id o doc_id)
                index_id = file_id or doc_id
                if index_id:
                    await asyncio.to_thread(delete_document, index_id)
            
            log_event(
                user_id=uid,
                event_type="STORAGE_FOLDER_DELETED",
                details={
                    "email": email,
                    "role": user_role or "",
                    "path": item_path,
                    "files_deleted": result.get("deleted_count", 0),
                    "docs_deleted_count": len(docs_to_delete)
                },
                severity="WARNING",
            )
            return {
                "message": f"Carpeta eliminada: {item_path}",
                "deleted_count": result.get("deleted_count", 0),
                "docs_deleted_count": len(docs_to_delete)
            }
        else:
            # 1. Eliminar el archivo de Firebase Storage
            await asyncio.to_thread(delete_file_from_storage, item_path)
            
            # 2. Buscar y eliminar documentos asociados en Firestore
            found_docs = get_documents_by_storage_path(item_path)
            
            # 3. Eliminar documentos de Firestore y Meilisearch
            for doc in found_docs:
                doc_id = doc.get("id")
                file_id = doc.get("file_id")
                
                # Eliminar de Firestore
                if doc_id:
                    await asyncio.to_thread(delete_document_from_firestore, doc_id)
                
                # Eliminar de Meilisearch (usando file_id o doc_id)
                index_id = file_id or doc_id
                if index_id:
                    await asyncio.to_thread(delete_document, index_id)
            
            log_event(
                user_id=uid,
                event_type="STORAGE_FILE_DELETED",
                details={
                    "email": email,
                    "role": user_role or "",
                    "path": item_path,
                    "docs_deleted_count": len(found_docs)
                },
                severity="WARNING",
            )
            return {
                "message": f"Archivo eliminado: {item_path}",
                "docs_deleted_count": len(found_docs)
            }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Archivo o carpeta no encontrado")
    except HTTPException:
        raise
    except Exception as e:
        log_error(error=e, context="DELETE /storage/delete", user_id=uid, additional_details={"path": item_path})
        raise HTTPException(status_code=500, detail=f"Error al eliminar: {str(e)}")


@router.get("/cover-images/{image_name}/url")
async def get_cover_image_url_endpoint(
    image_name: str,
    request: Request,
    token_data: Dict[str, Any] = Depends(verify_token)
):
    """
    Genera una URL firmada para una imagen de portada específica
    """
    try:
        user_id = token_data.get("user_id", "")
        image_path = f"Biblioteca_Portadas/{image_name}"
        
        url = get_cover_image_url(image_path)
        
        log_event(
            user_id=user_id,
            event_type="COVER_IMAGE_URL_GENERATED",
            details={
                "image_name": image_name,
                "image_path": image_path,
                "user_email": token_data.get("email", "")
            },
            severity="INFO"
        )
        
        return {
            "url": url,
            "image_name": image_name,
            "image_path": image_path
        }
        
    except Exception as e:
        log_error(
            error=e,
            context="GET /storage/cover-images/{image_name}/url",
            user_id=token_data.get("user_id", ""),
            additional_details={
                "image_name": image_name,
                "user_email": token_data.get("email", "")
            }
        )
        raise HTTPException(
            status_code=500,
            detail=f"Error al generar URL para imagen: {str(e)}"
        )
