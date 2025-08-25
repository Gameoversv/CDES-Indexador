import api from "./api";

const UPLOAD_TIMEOUT = 300000; // 5 minutos

export const documentsAPI = {
  upload: (formData, onProgress = null) => {
    // Si formData ya es un FormData, usarlo directamente
    // Si es un File, crear un FormData (para compatibilidad con código existente)
    if (!(formData instanceof FormData)) {
      const fileFormData = new FormData();
      fileFormData.append("file", formData);
      formData = fileFormData;
    }
    
    return api.post("/documents/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: UPLOAD_TIMEOUT,
      onUploadProgress: onProgress
        ? (e) => onProgress(Math.round((e.loaded * 100) / e.total))
        : undefined,
    });
  },
  search: (query) => api.get(`/documents/search?query=${encodeURIComponent(query)}`),
  getDocumentsByEstrategia: (estrategia) => api.get(`/documents/by_strategy?strategy=${encodeURIComponent(estrategia)}`),
  getProjectsByStrategy: (estrategia) => api.get(`/documents/storage?prefix=PES_2030/${encodeURIComponent(estrategia)}/`),
  list: () => api.get("/documents/list"),
  listStorage: () => api.get("/documents/storage"),
  download: (id) =>
    api.get(`/documents/download/${encodeURIComponent(id)}`, {
      responseType: "blob",
      timeout: UPLOAD_TIMEOUT,
    }),
  downloadByPath: (path) =>
    api.get(`/documents/download_by_path?path=${encodeURIComponent(path)}`, {
      responseType: "blob",
    }),
};
