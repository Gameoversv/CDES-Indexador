import {
  User,
  FileText,
  Eye,
  Search,
  Shield,
  XCircle,
  AlertTriangle,
  Info,
  AlertCircle,
  Activity,
} from "lucide-react";

// Tipos de eventos con íconos y colores asociados
export const EVENT_TYPES = {
  AUTHENTICATION: { label: "Autenticación", color: "bg-blue-500", icon: User },
  DOCUMENT_UPLOAD: { label: "Subida de Documento", color: "bg-green-500", icon: FileText },
  DOCUMENT_ACCESS: { label: "Acceso a Documento", color: "bg-yellow-500", icon: Eye },
  SEARCH: { label: "Búsqueda", color: "bg-purple-500", icon: Search },
  ADMIN_ACTION: { label: "Acción Administrativa", color: "bg-orange-500", icon: Shield },
  SYSTEM_ERROR: { label: "Error del Sistema", color: "bg-red-500", icon: XCircle },
  SECURITY_EVENT: { label: "Evento de Seguridad", color: "bg-red-600", icon: AlertTriangle }
};

// Niveles de severidad con íconos y colores asociados
export const SEVERITY_LEVELS = {
  INFO: { label: "Información", color: "bg-blue-500", icon: Info },
  WARNING: { label: "Advertencia", color: "bg-yellow-500", icon: AlertTriangle },
  ERROR: { label: "Error", color: "bg-red-500", icon: XCircle },
  CRITICAL: { label: "Crítico", color: "bg-red-600", icon: AlertCircle }
};

// Función para obtener la info de un tipo de evento
export const getEventTypeInfo = (eventType) => {
  return EVENT_TYPES[eventType] || {
    label: eventType,
    color: "bg-gray-500",
    icon: Activity
  };
};

// Función para obtener la info de un nivel de severidad
export const getSeverityInfo = (severity) => {
  return SEVERITY_LEVELS[severity] || {
    label: severity || "Info",
    color: "bg-gray-500",
    icon: Info
  };
};
