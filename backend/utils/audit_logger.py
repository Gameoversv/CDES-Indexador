"""
Sistema de Auditoría y Logging - Registro de Eventos de Seguridad

Este módulo proporciona un sistema completo de auditoría para registrar,
almacenar y consultar eventos críticos del sistema. Es fundamental para:

- Cumplimiento normativo y regulatorio
- Análisis de seguridad y detección de amenazas
- Debugging y resolución de problemas
- Monitoreo de actividad de usuarios
- Trazabilidad de operaciones críticas

Funcionalidades principales:
- Registro automático de eventos con timestamps precisos
- Almacenamiento seguro en Firestore
- Consultas filtradas y paginadas
- Estadísticas y métricas de actividad
- Niveles de severidad para clasificación
- Retención y limpieza de logs antiguos

Tipos de eventos registrados:
- Autenticación (login, logout, fallos)
- Operaciones de documentos (upload, download, search)
- Cambios administrativos (roles, permisos)
- Errores del sistema y excepciones
- Eventos personalizados de aplicación

Estructura de eventos:
- timestamp: Momento exacto del evento
- user_id: Usuario que generó el evento (opcional)
- event_type: Categoría del evento
- details: Información contextual adicional
- severity: Nivel de importancia (INFO, WARNING, ERROR)
- source: Origen del evento (api, system, user)
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import traceback

from firebase_admin import firestore
from google.cloud.firestore_v1 import FieldFilter  # <- NUEVO
from services.firebase_service import get_firestore_client


# ==================================================================================
#                           CONFIGURACIÓN Y CONSTANTES
# ==================================================================================

AUDIT_COLLECTION = "audit_logs"

SEVERITY_LEVELS = {
    "DEBUG": 0,
    "INFO": 1,
    "WARNING": 2,
    "ERROR": 3,
    "CRITICAL": 4
}

MAX_QUERY_LIMIT = 10000
DEFAULT_QUERY_LIMIT = 100
DEFAULT_RETENTION_DAYS = 365


# ==================================================================================
#                           UTILIDADES INTERNAS
# ==================================================================================

def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None

def _norm_upper(x: Optional[str]) -> str:
    return str(x or "").upper()

def _norm_lower(x: Optional[str]) -> str:
    return str(x or "").lower()

def _filter_logs_in_memory(logs: List[Dict[str, Any]], filters: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Aplica filtros en memoria sin requerir índices compuestos."""
    if not filters:
        return logs

    f_event = _norm_upper(filters.get("event_type"))
    f_uid   = filters.get("user_id")
    f_sev   = _norm_upper(filters.get("severity"))
    f_src   = _norm_lower(filters.get("source"))
    f_sd    = _parse_iso(filters.get("start_date"))
    f_ed    = _parse_iso(filters.get("end_date"))

    out: List[Dict[str, Any]] = []
    for log in logs:
        ev   = _norm_upper(log.get("event_type"))
        uid  = log.get("user_id")
        sev  = _norm_upper(log.get("severity"))
        src  = _norm_lower(log.get("source"))
        ts_s = log.get("timestamp") or log.get("created_at") or (log.get("details") or {}).get("timestamp_iso")
        ts   = _parse_iso(ts_s)

        if filters.get("event_type") and ev != f_event:
            continue
        if f_uid and uid != f_uid:
            continue
        if filters.get("severity") and sev != f_sev:
            continue
        if filters.get("source") and src != f_src:
            continue
        if f_sd and ts and ts < f_sd:
            continue
        if f_ed and ts and ts > f_ed:
            continue

        out.append(log)
    return out


# ==================================================================================
#                           FUNCIONES DE REGISTRO DE EVENTOS
# ==================================================================================

def log_event(
    user_id: Optional[str],
    event_type: str,
    details: Optional[Dict[str, Any]] = None,
    severity: str = "INFO",
    source: str = "api"
) -> Optional[str]:
    """Registra un evento de auditoría en Firestore."""
    try:
        severity = _norm_upper(severity)
        if severity not in SEVERITY_LEVELS:
            severity = "INFO"

        event_data = {
            "timestamp": firestore.SERVER_TIMESTAMP,
            "user_id": user_id,
            "event_type": _norm_upper(event_type),
            "details": details or {},
            "severity": severity,
            "severity_level": SEVERITY_LEVELS[severity],
            "source": source,
            "created_at": datetime.now().isoformat() + "Z",
        }

        if details is not None and "timestamp_iso" not in event_data["details"]:
            event_data["details"]["timestamp_iso"] = datetime.now().isoformat() + "Z"

        firestore_client = get_firestore_client()
        doc_ref = firestore_client.collection(AUDIT_COLLECTION).add(event_data)
        return doc_ref[1].id if doc_ref and doc_ref[1] else None

    except Exception as e:
        try:
            error_event = {
                "timestamp": firestore.SERVER_TIMESTAMP,
                "user_id": "system",
                "event_type": "AUDIT_LOG_ERROR",
                "details": {
                    "original_event_type": event_type,
                    "original_user_id": user_id,
                    "error": str(e),
                    "error_type": type(e).__name__
                },
                "severity": "ERROR",
                "severity_level": SEVERITY_LEVELS["ERROR"],
                "source": "audit_system"
            }
            firestore_client = get_firestore_client()
            firestore_client.collection(AUDIT_COLLECTION).add(error_event)
        except:
            pass
        return None


def log_system_event(event_type: str, details: Optional[Dict[str, Any]] = None, severity: str = "INFO") -> Optional[str]:
    return log_event(
        user_id=None,
        event_type=event_type,
        details=details,
        severity=severity,
        source="system"
    )


def log_error(
    error: Exception,
    context: str,
    user_id: Optional[str] = None,
    additional_details: Optional[Dict[str, Any]] = None
) -> Optional[str]:
    error_details = {
        "error_message": str(error),
        "error_type": type(error).__name__,
        "context": context,
        "stack_trace": traceback.format_exc(),
        **(additional_details or {})
    }
    return log_event(
        user_id=user_id,
        event_type="SYSTEM_ERROR",
        details=error_details,
        severity="ERROR",
        source="system"
    )


# ==================================================================================
#                           CONSULTA DE LOGS (SIN ÍNDICES COMPUESTOS)
# ==================================================================================

def fetch_logs(
    limit: int = DEFAULT_QUERY_LIMIT,
    offset: int = 0,
    filters: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Consulta por rango de fechas y orden por timestamp directamente en Firestore
    (operaciones que NO requieren índices compuestos) y aplica el resto de filtros
    en memoria (event_type, user_id, severity, source). Luego pagina el resultado.
    """
    try:
        if limit > MAX_QUERY_LIMIT:
            limit = MAX_QUERY_LIMIT
        if offset < 0:
            offset = 0

        start_dt = _parse_iso(filters.get("start_date")) if filters else None
        end_dt   = _parse_iso(filters.get("end_date")) if filters else None

        firestore_client = get_firestore_client()
        q = firestore_client.collection(AUDIT_COLLECTION)

        if start_dt:
            q = q.where(filter=FieldFilter("timestamp", ">=", start_dt))  # <- actualizado
        if end_dt:
            q = q.where(filter=FieldFilter("timestamp", "<=", end_dt))    # <- actualizado

        q = q.order_by("timestamp", direction=firestore.Query.DESCENDING)

        # Traemos un "colchón" razonable para filtrar en memoria sin índices compuestos
        wanted = min(MAX_QUERY_LIMIT, max(limit + offset, DEFAULT_QUERY_LIMIT * 5))
        docs = list(q.limit(wanted).stream())

        raw_logs: List[Dict[str, Any]] = []
        for doc in docs:
            d = doc.to_dict() or {}
            d["id"] = doc.id
            ts = d.get("timestamp")
            if ts and hasattr(ts, "timestamp"):
                d["timestamp"] = datetime.fromtimestamp(ts.timestamp()).isoformat() + "Z"
            raw_logs.append(d)

        filtered = _filter_logs_in_memory(raw_logs, filters)
        paged = filtered[offset: offset + limit]

        return {
            "logs": paged,
            "total_count": len(filtered),
            "limit": limit,
            "offset": offset,
            "filters_applied": filters or {},
            "query_timestamp": datetime.now().isoformat() + "Z"
        }

    except Exception as e:
        try:
            log_error(e, "fetch_logs", additional_details={
                "limit": limit,
                "offset": offset,
                "filters": filters
            })
        except:
            pass
        return {
            "logs": [],
            "total_count": 0,
            "limit": limit,
            "offset": offset,
            "filters_applied": filters or {},
            "error": str(e),
            "query_timestamp": datetime.now().isoformat() + "Z"
        }


def get_recent_logs(limit: int = DEFAULT_QUERY_LIMIT) -> List[Dict[str, Any]]:
    result = fetch_logs(limit=limit)
    return result.get("logs", [])


def get_logs_by_user(user_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    result = fetch_logs(
        limit=limit,
        filters={"user_id": user_id}
    )
    return result.get("logs", [])


def get_logs_by_event_type(event_type: str, limit: int = 100) -> List[Dict[str, Any]]:
    result = fetch_logs(
        limit=limit,
        filters={"event_type": event_type}
    )
    return result.get("logs", [])


# ==================================================================================
#                           ESTADÍSTICAS
# ==================================================================================

def get_audit_statistics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict[str, Any]:
    try:
        if not end_date:
            end_date = datetime.now().isoformat() + "Z"
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).isoformat() + "Z"

        logs_data = fetch_logs(
            limit=MAX_QUERY_LIMIT,
            filters={
                "start_date": start_date,
                "end_date": end_date
            }
        )
        logs = logs_data.get("logs", [])

        stats = {
            "total_events": len(logs),
            "period": {"start_date": start_date, "end_date": end_date},
            "events_by_type": {},
            "events_by_severity": {},
            "events_by_user": {},
            "events_by_source": {},
            "events_by_day": {},
            "unique_users": set(),
            "error_rate": 0.0
        }

        error_count = 0
        for log in logs:
            et = _norm_upper(log.get("event_type", "UNKNOWN"))
            stats["events_by_type"][et] = stats["events_by_type"].get(et, 0) + 1

            sev = _norm_upper(log.get("severity", "INFO"))
            stats["events_by_severity"][sev] = stats["events_by_severity"].get(sev, 0) + 1
            if sev in ["ERROR", "CRITICAL"]:
                error_count += 1

            uid = log.get("user_id")
            if uid:
                stats["events_by_user"][uid] = stats["events_by_user"].get(uid, 0) + 1
                stats["unique_users"].add(uid)

            src = log.get("source", "unknown")
            stats["events_by_source"][src] = stats["events_by_source"].get(src, 0) + 1

            ts = log.get("timestamp")
            if isinstance(ts, str) and len(ts) >= 10:
                day = ts[:10]
                stats["events_by_day"][day] = stats["events_by_day"].get(day, 0) + 1

        stats["unique_users"] = len(stats["unique_users"])
        stats["error_rate"] = (error_count / len(logs) * 100) if logs else 0

        stats["events_by_type"] = dict(sorted(stats["events_by_type"].items(), key=lambda x: x[1], reverse=True))
        stats["events_by_user"] = dict(sorted(stats["events_by_user"].items(), key=lambda x: x[1], reverse=True))

        return stats

    except Exception as e:
        try:
            log_error(e, "get_audit_statistics", additional_details={"start_date": start_date, "end_date": end_date})
        except:
            pass
        return {
            "total_events": 0,
            "error": str(e),
            "period": {"start_date": start_date, "end_date": end_date}
        }


# ==================================================================================
#                           MANTENIMIENTO
# ==================================================================================

def cleanup_old_logs(days_to_keep: int = DEFAULT_RETENTION_DAYS) -> Dict[str, Any]:
    try:
        cutoff_date = datetime.now() - timedelta(days=days_to_keep)

        log_system_event(
            "AUDIT_CLEANUP_STARTED",
            details={"cutoff_date": cutoff_date.isoformat(), "days_to_keep": days_to_keep},
            severity="WARNING"
        )

        firestore_client = get_firestore_client()
        old_logs_query = (
            firestore_client.collection(AUDIT_COLLECTION)
            .where(filter=FieldFilter("timestamp", "<", cutoff_date))  # <- actualizado
            .limit(1000)
        )

        deleted_count = 0
        batch = firestore_client.batch()
        batch_size = 0

        for doc in old_logs_query.stream():
            batch.delete(doc.reference)
            batch_size += 1
            deleted_count += 1
            if batch_size >= 500:
                batch.commit()
                batch = firestore_client.batch()
                batch_size = 0

        if batch_size > 0:
            batch.commit()

        result = {
            "deleted_logs": deleted_count,
            "cutoff_date": cutoff_date.isoformat() + "Z",
            "days_kept": days_to_keep,
            "status": "completed"
        }

        log_system_event("AUDIT_CLEANUP_COMPLETED", details=result, severity="WARNING")
        return result

    except Exception as e:
        error_result = {"deleted_logs": 0, "error": str(e), "days_to_keep": days_to_keep, "status": "failed"}
        try:
            log_error(e, "cleanup_old_logs", additional_details=error_result)
        except:
            pass
        return error_result


# ==================================================================================
#                           UTILIDAD / VALIDACIÓN
# ==================================================================================

def validate_event_type(event_type: str) -> bool:
    valid_types = {
        "LOGIN", "LOGOUT", "LOGIN_FAILED",
        "DOCUMENT_UPLOAD", "DOCUMENT_DOWNLOAD", "DOCUMENT_SEARCH",
        "USER_REGISTERED", "USER_PROMOTED_TO_ADMIN",
        "SYSTEM_ERROR", "AUDIT_LOG_ERROR",
        "SYSTEM_STARTUP", "SYSTEM_SHUTDOWN"
    }
    return _norm_upper(event_type) in valid_types


def format_log_for_display(log: Dict[str, Any]) -> str:
    timestamp = log.get("timestamp", "Unknown")
    user_id = log.get("user_id", "System")
    event_type = log.get("event_type", "UNKNOWN")
    severity = log.get("severity", "INFO")
    return f"[{timestamp}] {severity} - {event_type} (User: {user_id})"


# ==================================================================================
#                           INICIALIZACIÓN
# ==================================================================================

def initialize_audit_system() -> None:
    log_system_event(
        "AUDIT_SYSTEM_INITIALIZED",
        details={
            "audit_collection": AUDIT_COLLECTION,
            "retention_days": DEFAULT_RETENTION_DAYS,
            "max_query_limit": MAX_QUERY_LIMIT
        },
        severity="INFO"
    )

# initialize_audit_system()  # Comentado para evitar logs en cada import
