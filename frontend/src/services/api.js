// src/services/api.js

import axios from "axios";

// ===============================
// Configuración general
// ===============================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const DEFAULT_TIMEOUT = 30000;
const UPLOAD_TIMEOUT = 300000;

// ===============================
// Instancia principal de Axios
// ===============================

const api = axios.create({
  // ¡IMPORTANTE! Elimina o comenta esta línea para que el proxy de Vite funcione.
  // baseURL: 'http://localhost:8000', 
});

// Agrega el token de autorización a cada solicitud
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Tiempo extra para uploads
    if (config.url?.includes("/upload")) {
      config.timeout = UPLOAD_TIMEOUT;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ===============================
// Manejo de token de autenticación
// ===============================

const getAuthToken = () => {
  const token = localStorage.getItem("idToken");
  return token && token !== "null" && token !== "undefined" ? token : null;
};

const clearAuthData = () => {
  localStorage.removeItem("idToken");
  localStorage.removeItem("userClaims");
  localStorage.removeItem("userProfile");
  localStorage.removeItem("user");
};

// ===============================
// Interceptores de Axios
// ===============================

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      clearAuthData();
      if (window?.location.pathname !== "/login") {
        window.location.href = "/login?reason=session_expired";
      }
    }
    return Promise.reject(error);
  }
);

// ===============================
// Utilidades
// ===============================

export const getApiBaseUrl = () => API_BASE_URL;

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem("idToken", token);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    clearAuthData();
    delete api.defaults.headers.common["Authorization"];
  }
};

export const clearAuthToken = () => {
  clearAuthData();
  delete api.defaults.headers.common["Authorization"];
};

export const checkApiHealth = async () => {
  try {
    await api.get("/health", { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
};

// ===============================
// API: Documentos
// ===============================

export const documentsAPI = {
  // Listar archivos en storage
  listStorage: () => api.get("/documents/storage"),

  // Subir documento
  upload: (formData) =>
    api.post("/documents/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: UPLOAD_TIMEOUT,
    }),

  // Descargar por ruta
  downloadByPath: (path) =>
    api.get("/documents/download_by_path", {
      params: { path },
      responseType: "blob",
    }),

  // Eliminar por ruta
  deleteByPath: (path) =>
    api.delete("/documents/delete_by_path", {
      params: { path },
    }),

  // Búsqueda
  search: (query) => api.get("/documents/search", { params: { query } }),

  // Descargar por ID
  download: (id) =>
    api.get(`/documents/download/${id}`, {
      responseType: "blob",
    }),

  // Obtener metadatos de documento
  getDocument: (id) => api.get(`/documents/${id}`),

  // Listar todos los documentos
  list: () => api.get("/documents/list"),
};

// ===============================
// API: Auditoría
// ===============================

// Helpers para rango de fechas
const toISO = (d) => d.toISOString();
const computeRange = (dateRange) => {
  if (!dateRange || dateRange === "all") return {};
  const now = new Date();
  const hoursMap = { "1h": 1, "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };
  if (!hoursMap[dateRange]) return {};
  const start = new Date(now.getTime() - hoursMap[dateRange] * 60 * 60 * 1000);
  return { start_date: toISO(start), end_date: toISO(now) };
};

// Normaliza: quita "", "all", "undefined", null, undefined
const norm = (v) =>
  v === undefined || v === null || v === "" || v === "all" || v === "undefined"
    ? undefined
    : v;

export const auditAPI = {
  /**
   * Registra un evento de auditoría
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
   * params UI: { limit, offset, eventType, userId, severity, source, dateRange, start_date, end_date }
   * backend:   { limit, offset, event_type, user_id, severity, source, start_date, end_date }
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

    const range = start_date || end_date ? { start_date, end_date } : computeRange(dateRange);

    return api.get("/audit/logs", {
      params: {
        limit,
        offset,
        event_type: norm(eventType),
        user_id: norm(userId),
        severity: norm(severity),
        source: norm(source),
        start_date: norm(range.start_date),
        end_date: norm(range.end_date),
      },
    });
  },

  /** Estadísticas */
  getStats: (days = 30) => api.get(`/audit/stats`, { params: { days } }),

  /** Exportación (json|csv) */
  exportLogs: (format = "json", days = 30) =>
    api.get(`/audit/export`, {
      params: { format, days },
      responseType: format === "csv" ? "blob" : "json",
    }),

  /** Limpieza de logs (requiere admin) */
  cleanup: (days_to_keep = 90) =>
    api.delete(`/audit/logs/cleanup`, { params: { days_to_keep } }),
};

// ===============================
// API: Usuarios
// ===============================

export const usersAPI = {
  list: () => api.get("/admin/users"),
  create: (data) => api.post("/admin/users", data),
  update: (uid, data) => api.put(`/admin/users/${uid}`, data),
  delete: (uid) => api.delete(`/admin/users/${uid}`),
  changePassword: (data) => api.post("/admin/users/change-password", data),
};

// ===============================
// API: Autenticación
// ===============================

export const authAPI = {
  getCurrentUser: () => api.get("/auth/me"),
  getProfile: () => api.get("/auth/profile"),
  test: () => api.get("/auth/test"),
};

// ===============================
// API: Biblioteca Pública
// ===============================

export const libraryAPI = {
  // Listar todos los documentos públicos (sin búsqueda)
  list: (limit = 20, offset = 0) =>
    api
      .get(`/documents/public?limit=${limit}&offset=${offset}`)
      .then((res) => {
        return res.data?.hits || [];
      })
      .catch((error) => {
        console.error("Error cargando documentos públicos:", error);
        // Intentar con endpoint local si falla
        return api
          .get(`/documents/public-local?limit=${limit}&offset=${offset}`)
          .then((res) => res.data?.hits || []);
      }),

  // Búsqueda en documentos públicos con Meilisearch
  search: (query, limit = 20, offset = 0) =>
    api.get("/documents/public", {
      params: {
        q: query,
        limit,
        offset,
      },
    }),

  // Subir documento (reutiliza la misma función)
  upload: (formData) => documentsAPI.upload(formData),

  // Descargar por ruta
  downloadByPath: (path) => documentsAPI.downloadByPath(path),

  // Eliminar por ruta
  deleteByPath: (path) => documentsAPI.deleteByPath(path),

  // Eliminar documento por ID
  deleteDocument: (id) => api.delete(`/documents/${id}`),
};

// Export default
export default api;
