import axios from "axios";

// Config
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const DEFAULT_TIMEOUT = 30000;
const UPLOAD_TIMEOUT = 300000;

// Instancia Axios
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Token
const getAuthToken = () => {
  const token = localStorage.getItem("idToken");
  return token && token !== "null" && token !== "undefined" ? token : null;
};

const clearAuthData = () => {
  localStorage.removeItem("idToken");
  localStorage.removeItem("userClaims");
  localStorage.removeItem("userProfile");
};

// Interceptores
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.url?.includes("/upload")) {
      config.timeout = UPLOAD_TIMEOUT;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

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

export { api, UPLOAD_TIMEOUT };

// ==========================
// Módulo de API de Auditoría
// ==========================
export const auditAPI = {
  logEvent: (event_type, details, severity = "INFO") =>
    api.post("/admin/audit", {
      event_type,
      details,
      severity,
    }),
};

// ===========================
// Módulo de API de Documentos
// ===========================
export const documentsAPI = {
  listStorage: () => api.get("/documents/storage"),
  upload: (formData) =>
    api.post("/documents/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: UPLOAD_TIMEOUT,
    }),
  downloadByPath: (path) =>
    api.get("/documents/download_by_path", {
      params: { path },
      responseType: "blob",
    }),
  deleteByPath: (path) =>
    api.delete("/documents/delete_by_path", {
      params: { path },
    }),
  search: (query) => api.get("/documents/search", { params: { q: query } }),
};
