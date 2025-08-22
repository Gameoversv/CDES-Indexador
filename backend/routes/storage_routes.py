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

    # Unidades/roles con carpetas propias (usa exactamente el nombre de carpeta en Storage)
    "coordinacionadministrativa": "Coordinación Administrativa",
    # Aceptar código interno 'CoordinadorAdministrativa'
    "coordinadoradministrativa": "Coordinación Administrativa",
    
    # REPARACIÓN PARA COORDINACIÓN PROYECTOS Y PLANIFICACIÓN
    # Aceptar cualquier variante y normalizar al nombre REAL en Storage
    "coordinacionproyectosyplanificacion": "CoordinacionProyectosPlanificacion",
    "coordinacionproyectosplanificacion": "CoordinacionProyectosPlanificacion",
    "coordinacion proyectos y planificacion": "CoordinacionProyectosPlanificacion",
    "coordinacion proyectos planificacion": "CoordinacionProyectosPlanificacion",
    "coordinacionproyectos": "CoordinacionProyectosPlanificacion",
    "coordinacionplanificacion": "CoordinacionProyectosPlanificacion",
    "proyectosplanificacion": "CoordinacionProyectosPlanificacion",
    "proyectosyplanificacion": "CoordinacionProyectosPlanificacion",
    "proyectos": "CoordinacionProyectosPlanificacion",
    "planificacion": "CoordinacionProyectosPlanificacion",
    "proyectosplanificacion": "CoordinacionProyectosPlanificacion",
    
    # Aceptar ambas variantes con/sin 'de'
    "coordinaciondecomunicaciones": "Coordinación de Comunicaciones",
    "coordinacioncomunicaciones": "Coordinación de Comunicaciones",
    # Asistencia General (nombre REAL en Storage)
    "asistenciageneral": "AsistenciaGeneral",
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
    
    # Caso especial para Coordinación Proyectos y Planificación - lista específica de rutas
    if any(pattern in target_norm for pattern in ["proyecto", "planific", "coordinacionproyecto"]):
        print(f"🔎 DEBUG-PROYECTOS - _find_actual_role_folder_prefix detected proyectos pattern in: '{role_folder}'")
        specific_prefixes = [
            "CDES_inst/CoordinacionProyectosPlanificacion/",
            "CDES_inst/Coordinación Proyectos y Planificación/",
            "CDES_inst/Coordinacion Proyectos y Planificacion/",
            "CDES_inst/Coordinacion Proyectos Planificacion/",
            "CDES_inst/Proyectos y Planificacion/",
            "CDES_inst/Proyectos/",
            "CDES_inst/Planificacion/"
        ]
        # Probar directamente estas rutas
        for prefix in specific_prefixes:
            try:
                print(f"🔎 DEBUG-PROYECTOS - Checking specific prefix: {prefix}")
                files = list_files_in_storage(prefix=prefix)
                if files and any((f.get("path") or "").startswith(prefix) for f in files):
                    print(f"� DEBUG-PROYECTOS - Found direct match for {role_folder} at {prefix}")
                    return prefix
            except Exception as e:
                print(f"� DEBUG-PROYECTOS - Error checking specific prefix {prefix}: {e}")
        
        # Si no encontramos coincidencia, devolver la primera variante como predeterminada
        print(f"🔎 DEBUG-PROYECTOS - No direct match found, returning default prefix")
    # Usar el nombre REAL existente en Storage por defecto
    return "CDES_inst/CoordinacionProyectosPlanificacion/"

    try:
        candidates = list_files_in_storage(prefix="CDES_inst/")
        # recolectar primeros segmentos debajo de CDES_inst/
        first_levels: dict[str, str] = {}
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
        real = first_levels.get(target_norm)
        if real:
            return f"CDES_inst/{real}/"
        return None
    except Exception as e:
        print(f"🔍 DEBUG - _find_actual_role_folder_prefix error: {e}")
        return None

def get_storage_folder_for_user(user_role: Optional[str], email: Optional[str]) -> Optional[str]:
    """
    Determina la carpeta de Firebase Storage basada en el rol del usuario.
    Si es DireccionEjecutiva, retorna None para acceder a toda la raíz.
    """
    nr = _norm(user_role)
    
    # Debug para Coordinación Proyectos y Planificación
    if user_role and ("proyectos" in nr or "planificacion" in nr or "planific" in nr):
        print(f"🔎 DEBUG-PROYECTOS - Detected proyectos/planificacion in role: '{user_role}' (normalized: '{nr}')")
    
    # Usuarios administrativos (Dirección Ejecutiva) ven toda la estructura
    if nr in {"direccionejecutiva", "direccion ejecutiva"}:
        return None  # None significa acceso a toda la raíz CDES_inst/
        
    # Manejo específico para Coordinación Proyectos y Planificación por nombre de rol
    if nr and ("proyectos" in nr or "planificacion" in nr or "planific" in nr or 
              "coordinacionproyectos" in nr or "proyectosyplanificacion" in nr):
        print(f"🔎 DEBUG-PROYECTOS - Mapped role directly: '{user_role}' → 'CoordinacionProyectosPlanificacion'")
        return "CoordinacionProyectosPlanificacion"

    # Detectar por email si no hay rol claro
    if isinstance(email, str) and email:
        e = email.lower()
        # Verificar patrones administrativos en email
        if any(pattern in e for pattern in ["director", "ejecutiv"]):
            return None  # Acceso administrativo completo
            
        # Caso específico para correos conocidos de Proyectos
    if e in ["proyectos@cdes.cl", "coordinacionproyectos@cdes.cl", "planificacion@cdes.cl", 
        "coordproyectos@cdes.cl", "coordplanificacion@cdes.cl", "coordadmin@gmail.com"]:
        print(f"🔎 DEBUG-PROYECTOS - Exact email match for Proyectos: {e}")
        return "CoordinacionProyectosPlanificacion"
            
        # Fallback por email pattern hacia carpetas específicas
        if "asistente" in e or "asist" in e or "asistencia" in e or "general" in e:
            return "AsistenciaGeneral"
        # Coord. Administrativa: cubrir coordadmin / coord + admin / administracion / administrativa
        if (
            "coordadmin" in e
            or ("coord" in e and ("admin" in e or "administr" in e))
            or "administrativa" in e
            or "administracion" in e
        ):
            return "Coordinación Administrativa"
        # Detección mejorada para Proyectos - notar que ahora usamos OR en lugar de AND
        if "proyectos" in e or "planificacion" in e or "planific" in e:
            print(f"🔎 DEBUG-PROYECTOS - Email pattern match for Proyectos: {e}")
            return "CoordinacionProyectosPlanificacion"
        if "comunicacion" in e or "comunicaciones" in e or "coms" in e:
            return "Coordinación de Comunicaciones"

    # Intentar por rol conocido
    if nr in ROLE_TO_FOLDER_MAPPING:
        folder = ROLE_TO_FOLDER_MAPPING[nr]
        if "proyectos" in nr or "planificacion" in nr:
            print(f"🔎 DEBUG-PROYECTOS - Mapping hit from dict: '{nr}' → '{folder}'")
        return folder

    # Sin coincidencias o sin rol: NO dar acceso completo.
    # Retornar cadena vacía para que no vea más que PES_2030.
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
        print(f"🔍 DEBUG - UID: {uid}, Email: {email}")
        
    # 1. Obtener el rol del usuario desde Firestore (o token como fallback)
        user_doc_ref = firestore.collection("users").document(uid)
        user_doc = user_doc_ref.get()

        print(f"🔍 DEBUG - User doc exists: {user_doc.exists}")
        
        user_role = None
        if user_doc.exists:
            user_data = user_doc.to_dict()
            # Prioritize 'puesto_trabajo' (folder name used in storage), then legacy 'puesto', then 'role'
            user_role = user_data.get("puesto_trabajo") or user_data.get("puesto") or user_data.get("role")
            print(f"🔍 DEBUG - User data: {user_data}")
            print(f"🔍 DEBUG - User role resolved (puesto_trabajo/puesto/role): {user_role}")
        else:
            print(f"🔍 DEBUG - User not found in Firestore")
            # Intentar localizar por email si el doc por UID no existe
            try:
                if email:
                    # Buscar el usuario por email (usando filter keyword)
                    candidates = list(firestore.collection("users").where(filter=FieldFilter("email", "==", email)).limit(1).stream())
                    if candidates:
                        cdoc = candidates[0]
                        cdata = cdoc.to_dict() or {}
                        user_role = cdata.get("puesto_trabajo") or cdata.get("puesto") or cdata.get("role")
                        print(f"🔍 DEBUG - Found user by email. Role: {user_role}")
            except Exception as qe:
                print(f"🔍 DEBUG - Query by email failed: {qe}")
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
                    if user_role:
                        print(f"🔍 DEBUG - Role from token claims: {user_role}")
                except Exception as ce:
                    print(f"🔍 DEBUG - Claims role fallback failed: {ce}")
            # FALLBACK DIRECTO: Si no se encuentra el usuario en Firestore, usar el email para inferir rol
            e = (email or "").strip().lower()
            if not user_role and e:
                if e == "coordadmin@gmail.com":
                    user_role = "Coordinación Administrativa"
                    print(f"🔍 DEBUG - Fallback by email equality to role: {user_role}")
                elif ("director" in e) or ("ejecutiv" in e):
                    user_role = "Dirección Ejecutiva"
                    print(f"🔍 DEBUG - Fallback by email pattern to role: {user_role}")
                elif ("asistente" in e) or ("general" in e):
                    user_role = "Asistencia General"
                    print(f"🔍 DEBUG - Fallback by email pattern to role: {user_role}")
                elif ("proyectos" in e) or ("planificacion" in e) or ("planific" in e):
                    user_role = "Coordinación Proyectos y Planificación"
                    print(f"� DEBUG-PROYECTOS - Fallback by email pattern to role: {user_role} for {e}")
                elif ("comunicacion" in e) or ("comunicaciones" in e):
                    user_role = "Coordinación de Comunicaciones"
                    print(f"🔍 DEBUG - Fallback by email pattern to role: {user_role}")
            # Fallback a claims en el token (comentado)
            #user_role = token_data.get("role") or (token_data.get("custom_claims", {}) or {}).get("role")
            #if not user_role:
                #user_role = "AsistenciaGeneral"  # Rol por defecto

        print(f"🔍 DEBUG - Final user role: {user_role}")

        # 2. Determinar la carpeta de storage usando el mapeo inteligente
        storage_folder = get_storage_folder_for_user(user_role, email)
        
        # CASO ESPECIAL - FORZAR COMO COORDINACIÓN PROYECTOS Y PLANIFICACIÓN
        if not storage_folder and email in ["coordadmin@gmail.com", "proyectos@cdes.cl", "planificacion@cdes.cl"]:
            storage_folder = "CoordinacionProyectosPlanificacion"
            print(f"� DEBUG-PROYECTOS - Forced special role mapping for {email} to: {storage_folder}")
        
        print(f"🔍 DEBUG - Mapped storage folder: {storage_folder}")
        
        # 3. Construir el listado de blobs permitido según el rol
        files_list: List[Dict[str, Any]] = []
        root_path = ""  # Para construir un árbol desde la raíz visual (limitando contenidos según permisos)

        if storage_folder is None:
            # Usuario administrativo (DireccionEjecutiva) - ve toda la estructura desde la raíz
            print("🔍 DEBUG - DireccionEjecutiva access: viewing entire Firebase Storage root")
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
                resolved_prefix = _find_actual_role_folder_prefix(storage_folder)
                if resolved_prefix:
                    print(f"🔍 DEBUG - Resolved role folder prefix: {resolved_prefix}")
                    allowed_prefixes.append(resolved_prefix)
                    
                    # CASO ESPECIAL: Coordinación Proyectos y Planificación - Agregar TODAS las variantes posibles
                    if "proyectos" in _norm(storage_folder) or "planificacion" in _norm(storage_folder):
                        special_prefixes = [
                            "CDES_inst/CoordinacionProyectosPlanificacion/",
                            "CDES_inst/Coordinacion Proyectos y Planificacion/",
                            "CDES_inst/Coordinación Proyectos y Planificación/",
                            "CDES_inst/Coordinacion Proyectos Planificacion/",
                            "CDES_inst/Proyectos y Planificacion/",
                            "CDES_inst/Proyectos/",
                            "CDES_inst/Planificacion/"
                        ]
                        print(f"� DEBUG-PROYECTOS - Adding ALL possible CoordinacionProyectos prefixes")
                        for special_prefix in special_prefixes:
                            if special_prefix not in allowed_prefixes:
                                allowed_prefixes.append(special_prefix)
                                print(f"🔎 DEBUG-PROYECTOS - Added special prefix: {special_prefix}")
                else:
                    # Intentos alternativos: sin acentos, con/sin espacios
                    sf_no_accents = _strip_accents_keep_spaces(storage_folder)
                    compact = _norm(storage_folder)
                    # reconstruir nombres plausibles
                    variants = [
                        f"CDES_inst/{storage_folder}/",
                        f"CDES_inst/{sf_no_accents}/",
                    ]
                    # Para variante compacta, no sabemos mayúsculas; listaremos CDES_inst y filtraremos luego en árbol
                    # Aun así, agregamos la ruta mostrada para que el nodo exista
                    for v in variants:
                        if v not in allowed_prefixes:
                            allowed_prefixes.append(v)

            for pref in allowed_prefixes:
                pref_files = list_files_in_storage(prefix=pref)
                files_list.extend(pref_files)

            # Añadir marcador de carpeta CDES_inst/ siempre para jerarquía parcial
            if not any(f.get("path") == "CDES_inst/" for f in files_list):
                files_list.append({
                    "path": "CDES_inst/",
                    "filename": "CDES_inst",
                    "size": 0,
                    "updated": None,
                    "content_type": "application/x-directory",
                    "is_folder": True,
                })
            # No agregar marcadores de carpeta de rol si no existe en Storage
            # Y la carpeta PES_2030/
            if not any(f.get("path") == "PES_2030/" for f in files_list):
                files_list.append({
                    "path": "PES_2030/",
                    "filename": "PES_2030",
                    "size": 0,
                    "updated": None,
                    "content_type": "application/x-directory",
                    "is_folder": True,
                })

        print(f"🔍 DEBUG - Root path: '{root_path}'")
        print(f"🔍 DEBUG - Files found: {len(files_list)}")
        print(f"🔍 DEBUG - First file: {files_list[0] if files_list else 'None'}")

        # 5. Construir la respuesta JSON jerárquica
        file_tree = _build_tree_from_paths(files_list, root_path)
        print(f"🔍 DEBUG - Tree nodes: {len(file_tree)}")

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
        print(f"🔍 DEBUG - Exception: {str(e)}")
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