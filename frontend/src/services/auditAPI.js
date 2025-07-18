import { api } from "./api";

/**
 * API para la gestión de auditoría del sistema.
 * 
 * Incluye funciones para registrar eventos y obtener logs.
 */
export const auditAPI = {
  /**
   * Registra un evento de auditoría personalizado.
   *
   * @param {string} event_type - Tipo de evento (ej. "LOGIN", "UPLOAD")
   * @param {object} details - Detalles adicionales del evento
   * @param {string} severity - Severidad del evento (INFO, WARNING, ERROR)
   * @returns {Promise} - Promesa de la petición POST
   */
  logEvent: (event_type, details = {}, severity = "INFO") =>
    api.post("/audit/event", {
      event_type,
      details: {
        ...details,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      },
      severity,
    }),

  /**
   * Obtiene los logs de auditoría con filtros opcionales.
   *
   * @param {object} params - Parámetros de filtro como { limit, event_type, user_id, severity }
   * @returns {Promise} - Promesa de la petición GET
   */
  getLogs: (params = {}) => {
    const queryParams = new URLSearchParams({ limit: 200, ...params });
    return api.get(`/audit/logs?${queryParams.toString()}`);
  },
};
