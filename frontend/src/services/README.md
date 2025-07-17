# 📦 Carpeta `services/` - Servicios de API y Firebase

Este directorio contiene todos los módulos de comunicación entre el frontend y servicios externos, como:

- 🔗 API REST personalizada (FastAPI)
- 🔥 Firebase (Authentication, Storage, Firestore)

La estructura está modularizada por funcionalidad para facilitar el mantenimiento y escalabilidad.

---

## 📁 Estructura de Archivos

| Archivo                | Descripción                                                                 |
|------------------------|-----------------------------------------------------------------------------|
| `api.js`              | Cliente Axios centralizado con interceptores, manejo de errores y helpers. |
| `authAPI.js`          | Funciones para autenticación y rutas protegidas.                            |
| `usersAPI.js`         | Gestión de usuarios desde el panel admin (CRUD + cambio de contraseña).     |
| `documentsAPI.js`     | Subida, listado, búsqueda y descarga de documentos.                         |
| `auditAPI.js`         | Registro y consulta de logs de auditoría.                                   |
| `firebase.js`         | Inicialización de Firebase y exportación de servicios (`auth`, `storage`, `firestore`). |
| `index.js`            | Punto único de exportación para importar fácilmente todos los servicios.    |

---

## 🧪 Uso

```js
// ✅ Importación unificada desde cualquier componente
import { getUsers, auth, auditAPI, documentsAPI } from "@/services";

// Ejemplo de uso
const users = await getUsers();
await auditAPI.logEvent("LOGIN", { email: "admin@site.com" });
