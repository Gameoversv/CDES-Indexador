import React, { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/Admin/Layout/AdminLayout";
import { auditAPI } from "@/services/api";
import { Loader2, RefreshCw, Download, Shield } from "lucide-react";
import AuditStatsCards from "./AuditStatsCards";
import AuditFilters from "./AuditFilters";
import AuditLogsTable from "./AuditLogsTable";
import AuditLogMobileCards from "./AuditLogMobileCards";
import AuditLogDetailDialog from "./AuditLogDetailDialog";

export default function AdminAudit() {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    eventType: "all",
    severity: "all",
    dateRange: "all",
  });
  const [selectedLog, setSelectedLog] = useState(null);

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

    if (searchTerm) {
      filtered = filtered.filter((log) =>
        log.event_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filters.eventType !== "all") {
      filtered = filtered.filter((log) => log.event_type === filters.eventType);
    }

    if (filters.severity !== "all") {
      filtered = filtered.filter((log) => log.severity === filters.severity);
    }

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
        default:
          break;
      }
      filtered = filtered.filter((log) => new Date(log.timestamp) >= cutoff);
    }

    setFilteredLogs(filtered);
  };

  const exportLogs = () => {
    const csv = [
      ["Fecha", "Usuario", "Evento", "Severidad", "Detalles"].join(","),
      ...filteredLogs.map((log) =>
        [
          new Date(log.timestamp).toISOString(),
          log.user_id || "",
          log.event_type || "",
          log.severity || "",
          JSON.stringify(log.details).replace(/"/g, '""'),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const byType = {};
    const bySeverity = {};
    filteredLogs.forEach((log) => {
      byType[log.event_type] = (byType[log.event_type] || 0) + 1;
      bySeverity[log.severity || "INFO"] = (bySeverity[log.severity || "INFO"] || 0) + 1;
    });
    return { total, byType, bySeverity };
  }, [filteredLogs]);

  const formatDate = (ts) => new Date(ts).toLocaleString("es-DO");

  return (
    <AdminLayout>
      <div className="container mx-auto py-6 space-y-6">
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
            <button
              onClick={loadLogs}
              className="btn-outline flex gap-2 items-center px-3 py-2"
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </button>
            <button
              onClick={exportLogs}
              className="btn flex gap-2 items-center px-3 py-2"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Cargando registros...</span>
          </div>
        ) : (
          <>
            <AuditStatsCards stats={stats} />
            <AuditFilters
              filters={filters}
              setFilters={setFilters}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
            />
            <AuditLogsTable
              logs={filteredLogs}
              formatDate={formatDate}
              setSelectedLog={setSelectedLog}
            />
            <AuditLogMobileCards
              filteredLogs={filteredLogs}
              setSelectedLog={setSelectedLog}
            />
            <AuditLogDetailDialog
              selectedLog={selectedLog}
              setSelectedLog={setSelectedLog}
            />
          </>
        )}
      </div>
    </AdminLayout>
  );
}
