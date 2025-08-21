# backend/routes/storage_routes.py

from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File, Form
from services.firebase_service import (
    verify_token,
    get_firestore_client,
    list_files_in_storage,
    get_storage_bucket,
    get_auth_client,  # Añadir esta importación
)
from firebase_admin import firestore  # Importar el módulo firestore para acceder a SERVER_TIMESTAMP
from utils.audit_logger import log_event, log_error
from typing import Dict, Any, List, Optional
import unicodedata
import asyncio
from pydantic import BaseModel

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
# Claves normalizadas (minúsculas, sin acentos, sin espacios/guiones/bajos)
ROLE_TO_FOLDER_MAPPING: Dict[str, str] = {
    # Administrativos (verán toda la raíz: esta clave no se usa como carpeta)
    # 'DireccionEjecutiva' se trata aparte devolviendo None para acceso completo.

    # Unidades/roles con carpetas propias (usa exactamente el nombre de carpeta en Storage)
    "coordinadoradministrativa": "CoordinadorAdministrativa",
    "coordinadorplanificacion": "CoordinadorPlanificacion", 
    "coordinacioncomunicaciones": "CoordinacionComunicaciones",
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

def get_storage_folder_for_user(user_role: Optional[str], email: Optional[str]) -> Optional[str]:
    """
    Determina la carpeta de Firebase Storage basada en el rol del usuario.
    Si es DireccionEjecutiva, retorna None para acceder a toda la raíz.
    """
    nr = _norm(user_role)

    # Usuarios administrativos (Dirección Ejecutiva) ven toda la estructura
    if nr in {"direccionejecutiva", "direccion ejecutiva"}:
        return None  # None significa acceso a toda la raíz CDES_inst/

    # Detectar por email si no hay rol claro
    if isinstance(email, str) and email:
        e = email.lower()
        # Verificar patrones administrativos en email
        if any(pattern in e for pattern in ["director", "ejecutiv"]):
            return None  # Acceso administrativo completo
            
        # Fallback por email pattern hacia carpetas específicas, no a 'admin'
        if "asistente" in e or "general" in e:
            return "AsistenciaGeneral"
        if "coordinador" in e and "administrativa" in e:
            return "CoordinadorAdministrativa"
        if "proyectos" in e and "planificacion" in e:
            return "CoordinacionProyectosPlanificacion"
        if "comunicacion" in e:
            return "CoordinacionComunicaciones"

    # Intentar por rol conocido
    if nr in ROLE_TO_FOLDER_MAPPING:
        return ROLE_TO_FOLDER_MAPPING[nr]

    # Sin coincidencias: para usuarios nuevos sin rol definido, dar acceso básico
    # En lugar de devolver "", devolver None para acceso completo temporal
    return None if not user_role else ""

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
    firestore_client = get_firestore_client()
    auth_client = get_auth_client()

    try:
        print(f"🔍 DEBUG - UID: {uid}, Email: {email}")
        
        # 1. Primero buscar usuario en Firebase Auth
        user_role = None
        firebase_user = None
        
        try:
            firebase_user = auth_client.get_user(uid)
            print(f"🔍 DEBUG - Firebase Auth user found: {firebase_user.email}")
            
            # Obtener custom claims del usuario
            custom_claims = firebase_user.custom_claims or {}
            user_role = custom_claims.get("role")
            
            if not user_role:
                # Fallback: buscar en Firestore
                user_doc_ref = firestore_client.collection("users").document(uid)
                user_doc = user_doc_ref.get()
                
                if user_doc.exists:
                    user_data = user_doc.to_dict()
                    user_role = user_data.get("role")
                    print(f"🔍 DEBUG - Role found in Firestore: {user_role}")
                else:
                    print(f"🔍 DEBUG - User not found in Firestore, will create document")
                    
                    # Asignar rol por defecto basado en email
                    if email and any(pattern in email.lower() for pattern in ["director", "ejecutiv"]):
                        user_role = "DireccionEjecutiva"
                    else:
                        user_role = "AsistenciaGeneral"  # Rol por defecto
                    
                    print(f"🔍 DEBUG - Assigned role: {user_role}")
                    
                    # Crear el documento del usuario en Firestore
                    user_data = {
                        "uid": uid,
                        "email": email,
                        "role": user_role,
                        "display_name": firebase_user.display_name or email.split("@")[0] if email else "Usuario",
                        "created_at": firestore.SERVER_TIMESTAMP,  # Usar firestore.SERVER_TIMESTAMP
                        "status": "active",
                        "is_active": True,
                        "last_login": firestore.SERVER_TIMESTAMP
                    }
                    
                    try:
                        user_doc_ref.set(user_data)
                        print(f"🔍 DEBUG - User document created successfully")
                        
                        # También establecer custom claims en Firebase Auth
                        auth_client.set_custom_user_claims(uid, {"role": user_role})
                        
                        log_event(
                            user_id=uid,
                            event_type="USER_DOCUMENT_CREATED",
                            details={
                                "email": email,
                                "role": user_role,
                                "auto_created": True,
                                "context": "storage_tree_access"
                            },
                            severity="INFO",
                        )
                    except Exception as create_error:
                        print(f"🔍 DEBUG - Error creating user document: {create_error}")
                        # Continuar con el rol detectado aunque no se pueda crear el documento
                        pass
                        
        except Exception as auth_error:
            print(f"🔍 DEBUG - Error getting user from Firebase Auth: {auth_error}")
            
            # ENFOQUE CONSERVADOR: Solo preservar roles existentes, no cambiar a AsistenciaGeneral
            user_role = None
            
            # 1. Intentar obtener desde Firestore (preservar rol existente)
            try:
                user_doc_ref = firestore_client.collection("users").document(uid)
                user_doc = user_doc_ref.get()
                
                if user_doc.exists:
                    user_data = user_doc.to_dict()
                    user_role = user_data.get("role")
                    if user_role:
                        print(f"🔍 DEBUG - Existing role preserved from Firestore: {user_role}")
                    else:
                        print(f"🔍 DEBUG - User exists in Firestore but no role defined")
                        
            except Exception as firestore_error:
                print(f"🔍 DEBUG - Error accessing Firestore: {firestore_error}")
            
            # 2. Si no hay rol en Firestore, intentar desde token (sin asignar automáticamente)
            if not user_role:
                user_role = token_data.get("role") or (token_data.get("custom_claims", {}) or {}).get("role")
                if user_role:
                    print(f"🔍 DEBUG - Role from token: {user_role}")
                else:
                    print(f"⚠️ DEBUG - No role found anywhere")
            
            # 3. Si aún no hay rol, denegar acceso en lugar de asignar AsistenciaGeneral
            if not user_role:
                print(f"⚠️ DEBUG - No role found for user {uid}, access will be restricted")
                log_event(
                    user_id=uid,
                    event_type="ACCESS_DENIED_NO_ROLE",
                    details={
                        "email": email,
                        "reason": "No role assigned to user",
                        "auth_error": str(auth_error)
                    },
                    severity="WARNING",
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Usuario sin rol asignado. Contacte al administrador para asignar permisos."
                )

        print(f"🔍 DEBUG - Final user role: {user_role}")

        # 2. Determinar la carpeta de storage usando el mapeo inteligente
        storage_folder = get_storage_folder_for_user(user_role, email)
        print(f"🔍 DEBUG - Mapped storage folder: {storage_folder}")
        
        # 3. Construir la ruta de búsqueda en Firebase Storage
        if storage_folder is None:
            # Usuario administrativo (DireccionEjecutiva) - ve toda la estructura desde la raíz
            root_path = ""  # Raíz completa de Firebase Storage
            print(f"🔍 DEBUG - DireccionEjecutiva access: viewing entire Firebase Storage root")
        else:
            # Usuario normal - ve solo su carpeta específica dentro de CDES_inst
            if storage_folder == "":
                print("⚠️  DEBUG - Usuario sin carpeta para su rol; se devolverá lista vacía")
                log_event(
                    user_id=uid,
                    event_type="STORAGE_NO_ROLE_FOLDER",
                    details={
                        "role": user_role,
                        "email": email,
                    },
                    severity="INFO",
                )
                return []
            root_path = f"CDES_inst/{storage_folder}/"
        
        print(f"🔍 DEBUG - Root path: '{root_path}'")

        # 4. Listar archivos de forma recursiva desde esa ruta
        files_list = list_files_in_storage(prefix=root_path)

        # Si admin (root_path == "") queremos asegurar la presencia de carpetas raíz conocidas,
        # incluso si están vacías y aún no tienen marcador en Storage.
        if root_path == "":
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
            # Asegurar carpetas de roles conocidas bajo CDES_inst/
            role_folders = [
                "CoordinadorAdministrativa",
                "CoordinacionProyectosPlanificacion", 
                "CoordinacionComunicaciones",
                "AsistenciaGeneral"
            ]
            for rf in role_folders:
                role_marker = f"CDES_inst/{rf}/"
                if not any(f.get("path") == role_marker for f in files_list):
                    files_list.append({
                        "path": role_marker,
                        "filename": rf,
                        "size": 0,
                        "updated": None,
                        "content_type": "application/x-directory",
                        "is_folder": True,
                    })
        else:
            # Usuario no admin: no añadir marcadores falsos; si no hay blobs, el front mostrará "no posee carpeta".
            pass
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
                "access_type": "ADMIN_FULL_ACCESS" if storage_folder is None else "USER_RESTRICTED_ACCESS",
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
    """Crea una nueva carpeta en Firebase Storage dentro de la ruta especificada."""
    uid = token_data.get("user_id")
    email = token_data.get("email")
    firestore = get_firestore_client()

    # 1. Obtener rol del usuario para determinar carpeta base permitida
    user_role = None
    user_doc = firestore.collection("users").document(uid).get()
    if user_doc.exists:
        user_data = user_doc.to_dict()
        user_role = user_data.get("role")
    storage_folder = get_storage_folder_for_user(user_role, email)  # determina carpeta base o None si admin
    if storage_folder == "":
        raise HTTPException(status_code=403, detail="Aún no posee una carpeta asignada a su rol en Storage.")
    allowed_prefix = "" if storage_folder is None else f"CDES_inst/{storage_folder}/"

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
    Respeta restricciones por rol: usuarios no-admin solo pueden escribir dentro de su carpeta.
    """
    from services.firebase_service import upload_file_to_storage  # import local para evitar ciclos

    uid = token_data.get("user_id")
    email = token_data.get("email")
    firestore = get_firestore_client()

    # Determinar carpeta base permitida por rol
    user_role = None
    user_doc = firestore.collection("users").document(uid).get()
    if user_doc.exists:
        user_role = (user_doc.to_dict() or {}).get("role")

    storage_folder = get_storage_folder_for_user(user_role, email)
    if storage_folder == "":
        raise HTTPException(status_code=403, detail="Aún no posee una carpeta asignada a su rol en Storage.")
    allowed_prefix = "" if storage_folder is None else f"CDES_inst/{storage_folder}/"

    # Normalizar path y validar
    target_dir = (path or "").strip()
    if target_dir and not target_dir.endswith("/"):
        target_dir = target_dir + "/"

    if not target_dir and allowed_prefix:
        # Cuando no es admin y no se especifica carpeta, subir a raíz de su carpeta
        target_dir = allowed_prefix

    if allowed_prefix and not target_dir.startswith(allowed_prefix):
        raise HTTPException(status_code=403, detail="No tiene permisos para subir en esta ruta.")

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