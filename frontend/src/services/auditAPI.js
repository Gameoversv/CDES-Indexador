import { api } from "./api";

export const auditAPI = {
  logEvent: (eventType, eventDetails = {}, severity = "INFO") =>
    api.post("/audit/event", {
      event_type: eventType,
      details: {
        ...eventDetails,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      },
      severity,
    }),

  getLogs: (params = {}) => {
    const queryParams = new URLSearchParams({ limit: 100, ...params });
    return api.get(`/audit/logs?${queryParams.toString()}`);
  },
};
