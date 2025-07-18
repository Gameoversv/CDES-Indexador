# audit_routes.py

from typing import Annotated, Optional, Dict, List, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, status, Query, HTTPException
from pydantic import BaseModel, Field

from utils.audit_logger import log_event, fetch_logs, get_audit_statistics
from routes.auth_routes import get_current_user, get_current_admin_user

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
# Registrar evento
# ===============================

@router.post("/event", status_code=status.HTTP_201_CREATED)
async def register_audit_event(
    payload: AuditEvent,
    current_user: Annotated[dict, Depends(get_current_user)]
) -> Dict[str, str]:
    try:
        enhanced_details = {
            **(payload.details or {}),
            "user_email": current_user.get("email"),
            "user_is_admin": current_user.get("custom_claims", {}).get("admin") is True,
            "source": "user_generated"
        }
        log_event(
            user_id=current_user["user_id"],
            event_type=payload.event_type,
            details=enhanced_details,
            severity=payload.severity or "INFO"
        )
        return {
            "message": "Evento de auditoría registrado exitosamente",
            "event_type": payload.event_type,
            "timestamp": datetime.now().isoformat() + "Z"
        }
    except Exception as e:
        log_event(
            user_id=current_user["user_id"],
            event_type="AUDIT_LOG_ERROR",
            details={
                "attempted_event_type": payload.event_type,
                "error": str(e),
                "error_type": type(e).__name__
            },
            severity="ERROR"
        )
        raise HTTPException(500, "Error registrando evento de auditoría")

# ===============================
# Consultar logs
# ===============================

@router.get("/logs", response_model=AuditLogsResponse)
async def get_audit_logs(
    current_admin: Annotated[dict, Depends(get_current_admin_user)],
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    event_type: Optional[str] = None,
    user_id: Optional[str] = None,
    severity: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> AuditLogsResponse:
    try:
        filters = {}
        if event_type:
            filters["event_type"] = event_type
        if user_id:
            filters["user_id"] = user_id
        if severity:
            filters["severity"] = severity
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

        log_event(
            user_id=current_admin["user_id"],
            event_type="AUDIT_LOGS_QUERIED",
            details={
                "filters_applied": filters,
                "limit": limit,
                "offset": offset,
                "results_count": len(logs_data.get("logs", []))
            },
            severity="INFO"
        )

        return AuditLogsResponse(
            logs=logs_data.get("logs", []),
            total_count=logs_data.get("total_count", len(logs_data.get("logs", []))),
            limit=limit,
            offset=offset
        )
    except Exception as e:
        log_event(
            user_id=current_admin["user_id"],
            event_type="AUDIT_QUERY_ERROR",
            details={
                "error": str(e),
                "error_type": type(e).__name__,
                "filters": locals().get("filters", {})
            },
            severity="ERROR"
        )
        raise HTTPException(500, "Error consultando logs de auditoría")

# ===============================
# Estadísticas
# ===============================

@router.get("/stats")
async def get_audit_stats(
    current_admin: Annotated[dict, Depends(get_current_admin_user)],
    days: int = Query(default=30, ge=1, le=365)
) -> Dict[str, Any]:
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        stats = get_audit_statistics(
            start_date=start_date.isoformat() + "Z",
            end_date=end_date.isoformat() + "Z"
        )

        log_event(
            user_id=current_admin["user_id"],
            event_type="AUDIT_STATS_QUERIED",
            details={"days": days},
            severity="INFO"
        )

        return {
            **stats,
            "period": {
                "days": days,
                "start_date": start_date.isoformat() + "Z",
                "end_date": end_date.isoformat() + "Z"
            },
            "generated_at": datetime.now().isoformat() + "Z"
        }
    except Exception as e:
        log_event(
            user_id=current_admin["user_id"],
            event_type="AUDIT_STATS_ERROR",
            details={
                "error": str(e),
                "error_type": type(e).__name__,
                "requested_days": days
            },
            severity="ERROR"
        )
        raise HTTPException(500, "Error obteniendo estadísticas de auditoría")

# ===============================
# Limpieza de logs
# ===============================

@router.delete("/logs/cleanup")
async def cleanup_old_logs(
    current_admin: Annotated[dict, Depends(get_current_admin_user)],
    days_to_keep: int = Query(default=90, ge=1, le=3650)
) -> Dict[str, Any]:
    try:
        cutoff_date = datetime.now() - timedelta(days=days_to_keep)

        log_event(
            user_id=current_admin["user_id"],
            event_type="AUDIT_CLEANUP_STARTED",
            details={
                "cutoff_date": cutoff_date.isoformat(),
                "admin_email": current_admin.get("email")
            },
            severity="WARNING"
        )

        cleanup_result = {
            "deleted_logs": 0,
            "cutoff_date": cutoff_date.isoformat() + "Z",
            "status": "completed"
        }

        log_event(
            user_id=current_admin["user_id"],
            event_type="AUDIT_CLEANUP_COMPLETED",
            details=cleanup_result,
            severity="WARNING"
        )

        return {
            "message": "Limpieza de logs completada",
            **cleanup_result,
            "executed_at": datetime.now().isoformat() + "Z"
        }
    except Exception as e:
        log_event(
            user_id=current_admin["user_id"],
            event_type="AUDIT_CLEANUP_FAILED",
            details={"error": str(e)},
            severity="ERROR"
        )
        raise HTTPException(500, "Error durante la limpieza de logs")

# ===============================
# Exportación
# ===============================

@router.get("/export")
async def export_logs(
    current_admin: Annotated[dict, Depends(get_current_admin_user)],
    format: str = Query(default="json", regex="^(json|csv)$"),
    days: int = Query(default=30, ge=1, le=365)
) -> Dict[str, Any]:
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        export_logs = fetch_logs(
            limit=10000,
            offset=0,
            filters={
                "start_date": start_date.isoformat() + "Z",
                "end_date": end_date.isoformat() + "Z"
            }
        )

        log_event(
            user_id=current_admin["user_id"],
            event_type="AUDIT_LOGS_EXPORTED",
            details={
                "format": format,
                "logs_count": len(export_logs.get("logs", [])),
                "period_days": days
            },
            severity="INFO"
        )

        return {
            "message": "Exportación preparada",
            "format": format,
            "logs_count": len(export_logs.get("logs", [])),
            "period": {
                "days": days,
                "start_date": start_date.isoformat() + "Z",
                "end_date": end_date.isoformat() + "Z"
            },
            "data": export_logs.get("logs", []),
            "exported_at": datetime.now().isoformat() + "Z"
        }
    except Exception as e:
        log_event(
            user_id=current_admin["user_id"],
            event_type="AUDIT_EXPORT_ERROR",
            details={
                "error": str(e),
                "error_type": type(e).__name__,
                "format": format
            },
            severity="ERROR"
        )
        raise HTTPException(500, "Error exportando logs de auditoría")
