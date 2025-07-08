/**
 * Componente de Registros de Auditoría - Visualización de Actividad del Sistema
 * 
 * Este componente proporciona una interfaz completa para visualizar y analizar
 * los registros de auditoría del sistema. Permite a los administradores
 * monitorear todas las actividades, filtrar eventos y detectar anomalías.
 */

import React, { useEffect, useState, useMemo } from "react";
import { auditAPI } from "../services/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import AdminLayout from "@/components/AdminLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Shield, 
  Search, 
  Download, 
  Calendar, 
  Filter,
  Loader2,
  AlertCircle,
  User,
  Clock,
  Eye,
  FileText,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Activity,
  RefreshCw
} from "lucide-react";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    eventType: "all",
    severity: "all",
    dateRange: "all"
  });
  const [selectedLog, setSelectedLog] = useState(null);

  const EVENT_TYPES = {
    AUTHENTICATION: { label: "Autenticación", color: "bg-blue-500", icon: User },
    DOCUMENT_UPLOAD: { label: "Subida de Documento", color: "bg-green-500", icon: FileText },
    DOCUMENT_ACCESS: { label: "Acceso a Documento", color: "bg-yellow-500", icon: Eye },
    SEARCH: { label: "Búsqueda", color: "bg-purple-500", icon: Search },
    ADMIN_ACTION: { label: "Acción Administrativa", color: "bg-orange-500", icon: Shield },
    SYSTEM_ERROR: { label: "Error del Sistema", color: "bg-red-500", icon: XCircle },
    SECURITY_EVENT: { label: "Evento de Seguridad", color: "bg-red-600", icon: AlertTriangle }
  };

  const SEVERITY_LEVELS = {
    INFO: { label: "Información", color: "bg-blue-500", icon: Info },
    WARNING: { label: "Advertencia", color: "bg-yellow-500", icon: AlertTriangle },
    ERROR: { label: "Error", color: "bg-red-500", icon: XCircle },
    CRITICAL: { label: "Crítico", color: "bg-red-600", icon: AlertCircle }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, searchTerm, filters]);

  const loadLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await auditAPI.getLogs(200);
      setLogs(data.logs || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...logs];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.event_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by event type
    if (filters.eventType !== "all") {
      filtered = filtered.filter(log => log.event_type === filters.eventType);
    }

    // Filter by severity
    if (filters.severity !== "all") {
      filtered = filtered.filter(log => log.severity === filters.severity);
    }

    // Filter by date range
    if (filters.dateRange !== "all") {
      const now = new Date();
      const cutoff = new Date();
      
      switch (filters.dateRange) {
        case "1h":
          cutoff.setHours(now.getHours() - 1);
          break;
        case "24h":
          cutoff.setDate(now.getDate() - 1);
          break;
        case "7d":
          cutoff.setDate(now.getDate() - 7);
          break;
        case "30d":
          cutoff.setDate(now.getDate() - 30);
          break;
      }
      
      filtered = filtered.filter(log => new Date(log.timestamp) >= cutoff);
    }

    setFilteredLogs(filtered);
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getEventTypeInfo = (eventType) => {
    return EVENT_TYPES[eventType] || { 
      label: eventType, 
      color: "bg-gray-500", 
      icon: Activity 
    };
  };

  const getSeverityInfo = (severity) => {
    return SEVERITY_LEVELS[severity] || { 
      label: severity || "Info", 
      color: "bg-gray-500", 
      icon: Info 
    };
  };

  const exportLogs = () => {
    const csv = [
      ["Fecha", "Usuario", "Evento", "Severidad", "Detalles"].join(","),
      ...filteredLogs.map(log => [
        new Date(log.timestamp).toISOString(),
        log.user_id || "",
        log.event_type || "",
        log.severity || "",
        JSON.stringify(log.details).replace(/"/g, '""')
      ].join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const byType = {};
    const bySeverity = {};
    
    filteredLogs.forEach(log => {
      byType[log.event_type] = (byType[log.event_type] || 0) + 1;
      bySeverity[log.severity || 'INFO'] = (bySeverity[log.severity || 'INFO'] || 0) + 1;
    });

    return { total, byType, bySeverity };
  }, [filteredLogs]);

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Cargando registros...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <AdminLayout>
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Registros de Auditoría
          </h1>
          <p className="text-muted-foreground">
            Monitoreo y análisis de actividades del sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadLogs} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button onClick={exportLogs} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total eventos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{stats.bySeverity.WARNING || 0}</p>
                <p className="text-sm text-muted-foreground">Advertencias</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{stats.bySeverity.ERROR || 0}</p>
                <p className="text-sm text-muted-foreground">Errores</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{stats.bySeverity.CRITICAL || 0}</p>
                <p className="text-sm text-muted-foreground">Críticos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en registros..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={filters.eventType}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, eventType: value }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Tipo de evento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los eventos</SelectItem>
                    {Object.entries(EVENT_TYPES).map(([key, value]) => (
                      <SelectItem key={key} value={key}>{value.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Select
                value={filters.severity}
                onValueChange={(value) => setFilters(prev => ({ ...prev, severity: value }))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Severidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.entries(SEVERITY_LEVELS).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.dateRange}
                onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo el tiempo</SelectItem>
                  <SelectItem value="1h">Última hora</SelectItem>
                  <SelectItem value="24h">Últimas 24h</SelectItem>
                  <SelectItem value="7d">Últimos 7 días</SelectItem>
                  <SelectItem value="30d">Últimos 30 días</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Registros de Actividad
            <Badge variant="secondary">{filteredLogs.length} registros</Badge>
          </CardTitle>
          <CardDescription>
            Eventos del sistema ordenados por fecha (más recientes primero)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLogs.length > 0 ? (
            <div className="space-y-4">
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Severidad</TableHead>
                      <TableHead>Detalles</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => {
                      const eventInfo = getEventTypeInfo(log.event_type);
                      const severityInfo = getSeverityInfo(log.severity);
                      const EventIcon = eventInfo.icon;
                      
                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {formatDate(log.timestamp)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={cn("w-2 h-2 rounded-full", eventInfo.color)} />
                              <EventIcon className="h-4 w-4" />
                              <span className="font-medium">{eventInfo.label}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 text-muted-foreground" />
                              {log.user_id || "Sistema"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <div className={cn("w-2 h-2 rounded-full", severityInfo.color)} />
                              {severityInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-64 truncate text-sm text-muted-foreground">
                              {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <EventIcon className="h-5 w-5" />
                                    Detalles del Evento
                                  </DialogTitle>
                                  <DialogDescription>
                                    {eventInfo.label} - {formatDate(log.timestamp)}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="text-sm font-medium">Usuario</label>
                                      <p className="text-sm text-muted-foreground">{log.user_id || "Sistema"}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">Severidad</label>
                                      <div className="flex items-center gap-1">
                                        <div className={cn("w-2 h-2 rounded-full", severityInfo.color)} />
                                        <span className="text-sm">{severityInfo.label}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium">Detalles</label>
                                    <pre className="mt-1 p-3 bg-muted rounded-md text-sm overflow-auto">
                                      {JSON.stringify(log.details, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {filteredLogs.map((log) => {
                  const eventInfo = getEventTypeInfo(log.event_type);
                  const severityInfo = getSeverityInfo(log.severity);
                  const EventIcon = eventInfo.icon;
                  
                  return (
                    <Card key={log.id}>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-2 h-2 rounded-full", eventInfo.color)} />
                              <EventIcon className="h-4 w-4" />
                              <span className="font-medium">{eventInfo.label}</span>
                            </div>
                            <Badge variant="outline" className="gap-1">
                              <div className={cn("w-2 h-2 rounded-full", severityInfo.color)} />
                              {severityInfo.label}
                            </Badge>
                          </div>
                          
                          <div className="text-sm text-muted-foreground">
                            <div className="flex items-center gap-1 mb-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(log.timestamp)}
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {log.user_id || "Sistema"}
                            </div>
                          </div>
                          
                          <div className="text-sm">
                            {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">No se encontraron registros</p>
              <p className="text-muted-foreground">
                Ajusta los filtros para ver diferentes eventos
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </AdminLayout>
  );
}