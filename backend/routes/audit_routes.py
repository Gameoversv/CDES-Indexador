from typing import Annotated, Optional, Dict, List, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, status, Query, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import io, csv
from google.cloud.firestore_v1.base_query import FieldFilter

from utils.audit_logger import (
    log_event,
    fetch_logs,
    get_audit_statistics,
    validate_event_type,
    cleanup_old_logs as cleanup_old_logs_fn,
)
from routes.auth_routes import get_current_user, get_current_admin_user
from services.firebase_service import get_firestore_client  # <-- NUEVO

router = APIRouter(tags=["auditoría"])


# ===============================
# Modelos
# ===============================

class AuditEvent(BaseModel):
    event_type: str = Field(..., min_length=1, max_length=50)
    details: Optional[Dict[str, Any]] = None
    severity: Optional[str] = "INFO"


class AuditLogEntry(BaseModel):
    timestamp: str
    user_id: Optional[str]
    event_type: str
    details: Optional[Dict[str, Any]]
    severity: str = "INFO"


class AuditLogsResponse(BaseModel):
    logs: List[Dict[str, Any]]
    total_count: int
    limit: int
    offset: int = 0
    query_timestamp: str = Field(default_factory=lambda: datetime.now().isoformat() + "Z")


# ===============================
# Helpers
# ===============================

def _ctx(request: Optional[Request], extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Contexto estándar para adjuntar a los logs."""
    return {
        **(extra or {}),
        "client_ip": (request.client.host if request and request.client else None),
        "user_agent": (request.headers.get("user-agent") if request else None),
        "route": (str(request.url.path) if request else None),
        "source": "api",
    }

# -------- Enriquecimiento de usuario (NUEVO) --------

FIRESTORE_IN_LIMIT = 10

def _chunked(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i+n]

def _short_uid(u: Optional[str]) -> Optional[str]:
    if not u:
        return u
    return f"UID:{u[:6]}…{u[-4:]}" if len(u) >= 12 else u

def _enrich_logs_with_users(logs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Adjunta display_name/email a cada log usando user_id (uid) consultando la colección 'users'.
    Agrega 'user_display' ya listo para UI.
    """
    try:
        uids = sorted({l.get("user_id") for l in logs if l.get("user_id")})
        if not uids:
            for l in logs:
                if l.get("user_id"):
                    l["user_display"] = _short_uid(l["user_id"])
            return logs

        db = get_firestore_client()
        uid_to_profile: Dict[str, Dict[str, Any]] = {}

        # Firestore where-in limita a 10 elementos
        for chunk in _chunked(uids, FIRESTORE_IN_LIMIT):
            # Actualización para usar filter keyword con FieldFilter
            from firebase_admin import firestore
            q = db.collection("users").where(filter=firestore.FieldFilter("uid", "in", chunk))
            for doc in q.stream():
                d = doc.to_dict() or {}
                uid = d.get("uid")
                if uid:
                    uid_to_profile[uid] = {
                        "display_name": d.get("display_name"),
                        "email": d.get("email"),
                    }

        for l in logs:
            uid = l.get("user_id")
            info = uid_to_profile.get(uid)
            if info:
                l.setdefault("details", {})
                l["details"].setdefault("display_name", info.get("display_name"))
                l["details"].setdefault("user_email", info.get("email"))
                l["user_display"] = (
                    info.get("display_name")
                    or info.get("email")
                    or _short_uid(uid)
                )
            else:
                if uid:
                    l["user_display"] = _short_uid(uid)
        return logs
    except Exception:
        # En caso de fallo de FS, no romper respuesta
        for l in logs:
            if l.get("user_id") and not l.get("user_display"):
                l["user_display"] = _short_uid(l["user_id"])
        return logs


# ===============================
# Registrar evento
# ===============================

@router.post("/event", status_code=status.HTTP_201_CREATED)
async def register_audit_event(
    request: Request,
    payload: AuditEvent,
    current_user: Annotated[dict, Depends(get_current_user)]
) -> Dict[str, str]:
    try:
        # Normalizar y validar
        event_type = (payload.event_type or "").upper()
        severity = (payload.severity or "INFO").upper()

        if validate_event_type and not validate_event_type(event_type):
            # Puedes optar por rechazar o mapear a un tipo genérico
            log_event(
                user_id=current_user.get("user_id"),
                event_type="AUDIT_INVALID_EVENT",
                details=_ctx(request, {"original_event_type": payload.event_type}),
                severity="WARNING",
            )
            raise HTTPException(status_code=400, detail="Tipo de evento inválido")

        enhanced_details = {
            **(payload.details or {}),
            "user_email": current_user.get("email"),
            "user_is_admin": current_user.get("custom_claims", {}).get("admin") is True,
            **_ctx(request),
        }

        log_event(
            user_id=current_user["user_id"],
            event_type=event_type,
            details=enhanced_details,
            severity=severity,
        )

        return {
            "message": "Evento de auditoría registrado exitosamente",
            "event_type": event_type,
            "timestamp": datetime.now().isoformat() + "Z",
        }
    except HTTPException:
        raise
    except Exception as e:
        log_event(
            user_id=current_user.get("user_id"),
            event_type="AUDIT_LOG_ERROR",
            details={
                "attempted_event_type": payload.event_type if payload else None,
                "error": str(e),
                "error_type": type(e).__name__,
                **_ctx(request),
            },
            severity="ERROR",
        )
        raise HTTPException(500, "Error registrando evento de auditoría")


# ===============================
# Consultar logs
# ===============================

@router.get("/logs", response_model=AuditLogsResponse)
async def get_audit_logs(
    request: Request,
    current_admin: Annotated[dict, Depends(get_current_admin_user)],
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    event_type: Optional[str] = None,
    user_id: Optional[str] = None,
    severity: Optional[str] = None,
    source: Optional[str] = None,              # filtro adicional
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> AuditLogsResponse:
    try:
        filters: Dict[str, Any] = {}
        if event_type:
            filters["event_type"] = event_type
        if user_id:
            filters["user_id"] = user_id
        if severity:
            filters["severity"] = severity
        if source:
            filters["source"] = source

        if start_date:
            try:
                datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                filters["start_date"] = start_date
            except ValueError:
                raise HTTPException(400, "Fecha inicio inválida (ISO)")
        if end_date:
            try:
                datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                filters["end_date"] = end_date
            except ValueError:
                raise HTTPException(400, "Fecha fin inválida (ISO)")

        logs_data = fetch_logs(limit=limit, offset=offset, filters=filters)

        # Enriquecer con nombre/correo del usuario
        logs = _enrich_logs_with_users(logs_data.get("logs", []))

        log_event(
            user_id=current_admin["user_id"],
            event_type="AUDIT_LOGS_QUERIED",
            details={
                "filters_applied": filters,
                "limit": limit,
                "offset": offset,
                "results_count": len(logs),
                **_ctx(request),
            },
            severity="INFO",
        )

        return AuditLogsResponse(
            logs=logs,
            total_count=logs_data.get("total_count", len(logs)),
            limit=limit,
            offset=offset,
        )
    except Exception as e:
        log_event(
            user_id=current_admin.get("user_id"),
            event_type="AUDIT_QUERY_ERROR",
            details={
                "error": str(e),
                "error_type": type(e).__name__,
                "filters": locals().get("filters", {}),
                **_ctx(request),
            },
            severity="ERROR",
        )
        raise HTTPException(500, "Error consultando logs de auditoría")


# ===============================
# Estadísticas
# ===============================

@router.get("/stats")
async def get_audit_stats(
    request: Request,
    current_admin: Annotated[dict, Depends(get_current_admin_user)],
    days: int = Query(default=30, ge=1, le=365)
) -> Dict[str, Any]:
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        stats = get_audit_statistics(
            start_date=start_date.isoformat() + "Z",
            end_date=end_date.isoformat() + "Z",
        )

        log_event(
            user_id=current_admin["user_id"],
            event_type="AUDIT_STATS_QUERIED",
            details={"days": days, **_ctx(request)},
            severity="INFO",
        )

        return {
            **stats,
            "period": {
                "days": days,
                "start_date": start_date.isoformat() + "Z",
                "end_date": end_date.isoformat() + "Z",
            },
            "generated_at": datetime.now().isoformat() + "Z",
        }
    except Exception as e:
        log_event(
            user_id=current_admin.get("user_id"),
            event_type="AUDIT_STATS_ERROR",
            details={
                "error": str(e),
                "error_type": type(e).__name__,
                "requested_days": days,
                **_ctx(request),
            },
            severity="ERROR",
        )
        raise HTTPException(500, "Error obteniendo estadísticas de auditoría")


# ===============================
# Limpieza de logs
# ===============================

@router.delete("/logs/cleanup")
async def cleanup_old_logs(
    request: Request,
    current_admin: Annotated[dict, Depends(get_current_admin_user)],
    days_to_keep: int = Query(default=90, ge=1, le=3650)
) -> Dict[str, Any]:
    try:
        # Ejecuta limpieza real en el logger
        result = cleanup_old_logs_fn(days_to_keep=days_to_keep)

        # Traza de API (además de los eventos que ya registra el logger)
        log_event(
            user_id=current_admin["user_id"],
            event_type="AUDIT_CLEANUP_TRIGGERED_FROM_API",
            details={"days_to_keep": days_to_keep, "result": result, **_ctx(request)},
            severity="WARNING",
        )

        return {
            "message": "Limpieza de logs completada",
            **result,
            "executed_at": datetime.now().isoformat() + "Z",
        }
    except Exception as e:
        log_event(
            user_id=current_admin.get("user_id"),
            event_type="AUDIT_CLEANUP_FAILED",
            details={"error": str(e), **_ctx(request)},
            severity="ERROR",
        )
        raise HTTPException(500, "Error durante la limpieza de logs")


# ===============================
# Exportación
# ===============================

@router.get("/export")
async def export_logs(
    request: Request,
    current_admin: Annotated[dict, Depends(get_current_admin_user)],
    format: str = Query(default="json", regex="^(json|csv)$"),
    days: int = Query(default=30, ge=1, le=365)
):
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        export_data = fetch_logs(
            limit=10000,
            offset=0,
            filters={
                "start_date": start_date.isoformat() + "Z",
                "end_date": end_date.isoformat() + "Z",
            },
        )
        logs = export_data.get("logs", [])
        logs = _enrich_logs_with_users(logs)  # enriquecer también en exportación

        log_event(
            user_id=current_admin["user_id"],
            event_type="AUDIT_LOGS_EXPORTED",
            details={
                "format": format,
                "logs_count": len(logs),
                "period_days": days,
                **_ctx(request),
            },
            severity="INFO",
        )

        if format == "csv":
            # Generar CSV real
            buffer = io.StringIO()
            # Determinar columnas
            fieldnames = set()
            for row in logs:
                fieldnames.update(row.keys())
            fieldnames = sorted(fieldnames)

            writer = csv.DictWriter(buffer, fieldnames=fieldnames)
            writer.writeheader()
            for row in logs:
                writer.writerow(row)
            buffer.seek(0)

            filename = f"audit_{start_date.date()}_to_{end_date.date()}.csv"
            return StreamingResponse(
                iter([buffer.getvalue()]),
                media_type="text/csv",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )

        # JSON por defecto
        return {
            "message": "Exportación preparada",
            "format": "json",
            "logs_count": len(logs),
            "period": {
                "days": days,
                "start_date": start_date.isoformat() + "Z",
                "end_date": end_date.isoformat() + "Z",
            },
            "data": logs,
            "exported_at": datetime.now().isoformat() + "Z",
        }

    except Exception as e:
        log_event(
            user_id=current_admin.get("user_id"),
            event_type="AUDIT_EXPORT_ERROR",
            details={
                "error": str(e),
                "error_type": type(e).__name__,
                "format": format,
                **_ctx(request),
            },
            severity="ERROR",
        )
        raise HTTPException(500, "Error exportando logs de auditoría")
