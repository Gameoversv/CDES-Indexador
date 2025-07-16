import axios from "axios";

// ✅ Configuración principal de Axios
const instance = axios.create({
  baseURL: "http://localhost:8000", // cambia si usas otra URL en producción
  timeout: 10000,
});

// ❌ Manejo global de errores (opcional)
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Mostrar mensaje de error si existe
    const message =
      error.response?.data?.detail ||
      error.message ||
      "Error en la solicitud";
    console.error("Axios error:", message);
    return Promise.reject(error);
  }
);

export default instance;
