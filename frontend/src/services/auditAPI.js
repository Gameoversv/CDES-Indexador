// auditAPI.js
import { api } from "./api";

// util rango fechas -> start_date/end_date ISO
function toISO(d) { return d.toISOString(); }
function computeRange(dateRange) {
  if (!dateRange || dateRange === "all") return {};
  const now = new Date();
  const hoursMap = { "1h": 1, "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };
  if (!(dateRange in hoursMap)) return {};
  const start = new Date(now.getTime() - hoursMap[dateRange] * 60 * 60 * 1000);
  return { start_date: toISO(start), end_date: toISO(now) };
}

// agrega al objeto solo si el valor es real (no "", "all", "undefined", null, undefined)
function appendIf(obj, key, val) {
  if (val === undefined || val === null) return;
  if (val === "" || val === "all" || val === "undefined") return;
  obj[key] = val;
}

/**
 * API para la gestión de auditoría
 */
export const auditAPI = {
  /**
   * Registra un evento de auditoría
   * @param {string} event_type
   * @param {object} details
   * @param {"DEBUG"|"INFO"|"WARNING"|"ERROR"|"CRITICAL"} severity
   */
  logEvent: (event_type, details = {}, severity = "INFO") =>
    api.post("/audit/event", {
      event_type: String(event_type || "").toUpperCase(),
      details: {
        ...details,
        timestamp_iso: new Date().toISOString(), // evita colisión con 'timestamp' del server
        user_agent: navigator.userAgent,
        source: "frontend",
      },
      severity: String(severity || "INFO").toUpperCase(),
    }),

  /**
   * Obtiene logs con filtros
   * params: { limit, offset, eventType, userId, severity, source, dateRange, start_date, end_date }
   */
  getLogs: (params = {}) => {
    const {
      limit = 200,
      offset = 0,
      eventType,
      userId,
      severity,
      source,
      dateRange,
      start_date,
      end_date,
    } = params;

    // calcular rango si no pasan fechas explícitas
    const range =
      !start_date && !end_date
        ? computeRange(dateRange)
        : { start_date, end_date };

    // construir query limpiando vacíos
    const q = {};
    appendIf(q, "limit", String(limit));
    appendIf(q, "offset", String(offset));
    appendIf(q, "event_type", eventType);
    appendIf(q, "user_id", userId);
    appendIf(q, "severity", severity);
    appendIf(q, "source", source);
    appendIf(q, "start_date", range.start_date);
    appendIf(q, "end_date", range.end_date);

    const qs = new URLSearchParams(q).toString();
    return api.get(`/audit/logs?${qs}`);
  },

  /** Estadísticas */
  getStats: (days = 30) => api.get(`/audit/stats?days=${days}`),

  /** Exportación (json|csv) */
  exportLogs: (format = "json", days = 30) =>
    api.get(`/audit/export?format=${format}&days=${days}`, {
      responseType: format === "csv" ? "blob" : "json",
    }),

  /** Limpieza de logs (requiere admin) */
  cleanup: (days_to_keep = 90) =>
    api.delete(`/audit/logs/cleanup?days_to_keep=${days_to_keep}`),
};
