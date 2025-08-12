// src/components/utils/auditUtils.js
import {
  Activity,
  Search,
  Filter,
  BarChart3,
  Trash2,
  FileUp,
  Download,
  History,
  Globe,
  UserPlus,
  UserCog,
  UserMinus,
  KeyRound,
  LogIn,
  LogOut,
  ShieldCheck,
  Shield,
  XCircle,
  AlertTriangle,
  Info,
  AlertCircle,
} from "lucide-react";

// ===============================
// Severidades
// ===============================
export const SEVERITY_LEVELS = {
  DEBUG:    { label: "Depuración",  color: "bg-slate-400",  icon: Activity },
  INFO:     { label: "Información", color: "bg-blue-500",   icon: Activity },
  WARNING:  { label: "Advertencia", color: "bg-yellow-500", icon: AlertTriangle },
  ERROR:    { label: "Error",       color: "bg-red-500",    icon: XCircle },
  CRITICAL: { label: "Crítico",     color: "bg-red-700",    icon: AlertCircle },
};

export const getSeverityInfo = (sev) =>
  SEVERITY_LEVELS[String(sev || "INFO").toUpperCase()] || SEVERITY_LEVELS.INFO;

// ===============================
// Origen (opcional)
// ===============================
const SOURCE_MAP = {
  api:      { label: "API",      color: "bg-indigo-500" },
  system:   { label: "Sistema",  color: "bg-zinc-500" },
  frontend: { label: "Frontend", color: "bg-emerald-500" },
};
export const getSourceInfo = (src) =>
  SOURCE_MAP[String(src || "").toLowerCase()] || { label: "Desconocido", color: "bg-zinc-400" };

// ===============================
// Eventos
// ===============================
const pretty = (s) =>
  String(s || "Evento")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

// Alias para unificar nombres
const EVENT_ALIASES = {
  DOCUMENT_UPLOAD: "DOCUMENT_UPLOADED",
  DOCUMENT_DOWNLOAD: "DOCUMENT_DOWNLOADED",
};

export const EVENT_TYPES = {
  // Autenticación / acceso
  LOGIN:                    { label: "Inicio de sesión",              icon: LogIn,        color: "bg-emerald-500" },
  LOGOUT:                   { label: "Cierre de sesión",              icon: LogOut,       color: "bg-emerald-500" },
  LOGIN_FAILED:             { label: "Inicio de sesión fallido",      icon: AlertTriangle,color: "bg-yellow-500" },
  ADMIN_ACCESS_GRANTED:     { label: "Acceso administrador",          icon: ShieldCheck,  color: "bg-indigo-500" },

  // Auditoría
  AUDIT_LOGS_QUERIED:       { label: "Consulta de registros",         icon: Filter,       color: "bg-blue-500" },
  AUDIT_STATS_QUERIED:      { label: "Estadísticas consultadas",      icon: BarChart3,    color: "bg-blue-500" },
  AUDIT_LOGS_EXPORTED:      { label: "Registros exportados",          icon: Download,     color: "bg-blue-500" },
  AUDIT_CLEANUP_STARTED:    { label: "Limpieza de logs iniciada",     icon: Trash2,       color: "bg-yellow-600" },
  AUDIT_CLEANUP_COMPLETED:  { label: "Limpieza de logs completada",   icon: Trash2,       color: "bg-yellow-600" },
  AUDIT_CLEANUP_TRIGGERED_FROM_API: { label: "Limpieza ejecutada (API)", icon: Trash2,   color: "bg-yellow-600" },
  AUDIT_INVALID_EVENT:      { label: "Evento de auditoría inválido",  icon: AlertTriangle,color: "bg-orange-500" },
  AUDIT_SYSTEM_INITIALIZED: { label: "Sistema de auditoría iniciado", icon: Info,         color: "bg-slate-500" },

  // Documentos (nombres nuevos y equivalentes)
  DOCUMENT_UPLOADED:        { label: "Documento subido",              icon: FileUp,       color: "bg-emerald-500" },
  DOCUMENT_DOWNLOADED:      { label: "Documento descargado",          icon: Download,     color: "bg-sky-500" },
  DOCUMENT_DOWNLOADED_BY_PATH: { label: "Descarga por ruta",         icon: Download,     color: "bg-sky-500" },
  DOCUMENT_DELETED_BY_PATH: { label: "Eliminación por ruta",          icon: Trash2,       color: "bg-red-500" },
  DOCUMENT_VERSIONS_VIEWED: { label: "Versiones consultadas",         icon: History,      color: "bg-blue-500" },
  DOCUMENT_STATS_VIEWED:    { label: "Estadísticas de documentos",    icon: BarChart3,    color: "bg-blue-500" },

  // Búsquedas / biblioteca
  SEARCH_PUBLIC_LIBRARY:    { label: "Búsqueda biblioteca pública",   icon: Search,       color: "bg-blue-500" },
  PUBLIC_DOCUMENTS_QUERY:   { label: "Consulta documentos públicos",  icon: Globe,        color: "bg-blue-500" },
  LOCAL_PUBLIC_SEARCH:      { label: "Búsqueda local (fallback)",     icon: Search,       color: "bg-zinc-500" },

  // Equivalente genérico
  DOCUMENT_SEARCH:          { label: "Búsqueda de documentos",        icon: Search,       color: "bg-blue-500" },

  // Usuarios
  USER_CREATED:             { label: "Usuario creado",                icon: UserPlus,     color: "bg-emerald-500" },
  USER_REGISTERED:          { label: "Usuario registrado",            icon: UserPlus,     color: "bg-emerald-500" },
  USER_UPDATED:             { label: "Usuario actualizado",           icon: UserCog,      color: "bg-blue-500" },
  USER_DELETED:             { label: "Usuario eliminado",             icon: UserMinus,    color: "bg-red-500" },
  PASSWORD_CHANGED:         { label: "Contraseña actualizada",        icon: KeyRound,     color: "bg-emerald-500" },

  // Seguridad / sistema / errores
  SECURITY_EVENT:           { label: "Evento de seguridad",           icon: Shield,       color: "bg-red-600" },
  SYSTEM_ERROR:             { label: "Error del sistema",             icon: XCircle,      color: "bg-red-600" },
  AUDIT_QUERY_ERROR:        { label: "Error consultando auditoría",   icon: XCircle,      color: "bg-red-600" },
  AUDIT_STATS_ERROR:        { label: "Error en estadísticas",         icon: XCircle,      color: "bg-red-600" },
  AUDIT_EXPORT_ERROR:       { label: "Error exportando auditoría",    icon: XCircle,      color: "bg-red-600" },
  AUDIT_LOG_ERROR:          { label: "Error registrando auditoría",   icon: XCircle,      color: "bg-red-600" },
  DOWNLOAD_ERROR:           { label: "Error de descarga",             icon: XCircle,      color: "bg-red-600" },
  PUBLIC_SEARCH_ERROR:      { label: "Error en búsqueda pública",     icon: XCircle,      color: "bg-red-600" },
  LOCAL_PUBLIC_SEARCH_ERROR:{ label: "Error en búsqueda local",       icon: XCircle,      color: "bg-red-600" },
};

export const getEventTypeInfo = (type) => {
  const raw = String(type || "").toUpperCase();
  const t = EVENT_ALIASES[raw] || raw;
  return EVENT_TYPES[t] || { label: pretty(t), icon: Activity, color: "bg-zinc-400" };
};

// ===============================
// Helpers de presentación
// ===============================

/** Corta un UID muy largo para que no rompa la UI */
const shortUID = (uid = "") =>
  uid.length > 16 ? `${uid.slice(0, 6)}…${uid.slice(-4)}` : uid;

/** Resume el user-agent (navegador/SO) */
const shortUA = (ua = "") => {
  if (!ua) return "";
  const m = ua.match(/(Chrome|Firefox|Safari|Edg)\/[\d.]+|Windows|Mac OS X|Linux|Android|iOS/gi);
  return m ? Array.from(new Set(m)).join(" · ") : ua.slice(0, 60);
};

/** Nombre visible del usuario (prioriza back: user_display) */
export function getDisplayUser(log) {
  // si el backend ya puso un display amigable, úsalo
  if (log?.user_display) return log.user_display;

  const d = log?.details || {};
  const name =
    d.user_display_name ||
    d.display_name ||
    d.username ||
    d.name;

  const email =
    d.user_email ||
    d.email ||
    d.uploader_email ||
    d.actor_email ||
    log?.user_email;

  if (name && email) return `${name} <${email}>`;
  if (name) return name;
  if (email) return email;

  return log?.user_id ? `UID:${shortUID(log.user_id)}` : "Sistema";
}

/**
 * Devuelve un resumen legible de details:
 * - errores
 * - operaciones con documentos (filename, id + versión, path)
 * - búsquedas (query + resultados)
 * - filtros aplicados
 * - exportaciones (formato + cantidad)
 * - info de acceso (admin, ruta, ip / user-agent corto)
 */
export function getDetailsPreview(log) {
  const d = log?.details || {};

  // Errores
  if (d.error || d.error_message) {
    return `Error: ${d.error || d.error_message}`;
  }

  // Operaciones con documentos
  if (d.original_filename) return `Archivo: ${d.original_filename}`;
  if (d.filename) return `Archivo: ${d.filename}`;
  if (d.file_id && (d.version || d.total_versions))
    return `ID: ${d.file_id}${d.version ? ` (v${d.version})` : ""}`;
  if (d.path) return `Ruta: ${d.path}`;

  // Búsquedas/consultas
  if (d.query && (d.results_count !== undefined)) {
    const src = d.source ? ` — fuente: ${d.source}` : "";
    return `Búsqueda: “${d.query}” — ${d.results_count} resultado(s)${src}`;
  }
  if (d.filters_applied) {
    const text = Object.entries(d.filters_applied)
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("|") : v}`)
      .join(", ");
    return text ? `Filtros: ${text}` : "";
  }

  // Exportación
  if (d.format && d.logs_count !== undefined)
    return `Exportación ${String(d.format).toUpperCase()} — ${d.logs_count} registro(s)`;

  // Accesos / contexto
  if (d.user_is_admin !== undefined) {
    const ua = d.user_agent ? ` • ${shortUA(d.user_agent)}` : "";
    return `Admin: ${d.user_is_admin ? "Sí" : "No"}${ua}`;
  }

  if (d.route || d.client_ip || d.user_agent) {
    const parts = [];
    if (d.client_ip) parts.push(`IP: ${d.client_ip}`);
    if (d.route) parts.push(`Ruta: ${d.route}`);
    if (d.user_agent) parts.push(shortUA(d.user_agent));
    return parts.join(" • ");
  }

  // Fallback vacío para no llenar de JSON
  return "";
}
