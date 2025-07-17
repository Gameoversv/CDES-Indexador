# ⚙️ Carpeta `Admin/` - Panel Administrativo

Este directorio contiene todos los módulos del panel administrativo de la plataforma. Cada subcarpeta representa un módulo funcional separado para una mejor organización, mantenibilidad y escalabilidad.

---

## 📁 Estructura de Carpetas

| Carpeta               | Descripción                                                                 |
|-----------------------|-----------------------------------------------------------------------------|
| `Layout/`            | Componentes base del diseño del panel admin (sidebar, dashboard, etc).      |
| `ModuloAudits/`      | Gestión y visualización de registros de auditoría del sistema.               |
| `ModuloDocuments/`   | Administración de documentos: subir, buscar, listar, descargar, eliminar.   |
| `ModuloLibrary/`     | Gestión de documentos públicos visibles en la biblioteca digital.            |
| `ModuloNews/`        | Módulo de noticias para el portal público (títulos, fechas, enlaces, etc.). |
| `ModuloUsuarios/`    | Gestión de usuarios: CRUD, roles, contraseñas, permisos.                    |

---

## 🎯 Objetivo

Este conjunto de módulos permite a los administradores realizar tareas clave como:

- Monitorear actividad del sistema (auditorías)
- Subir y mantener documentos
- Administrar acceso a la biblioteca pública
- Gestionar noticias para usuarios finales
- Controlar el acceso y roles de los usuarios internos

---

## 📦 Ejemplo de Uso

```jsx
// Enrutamiento típico para módulo admin
<Route path="/admin/documents" element={<ModuloDocuments />} />
<Route path="/admin/audit" element={<ModuloAudits />} />
<Route path="/admin/users" element={<ModuloUsuarios />} />
