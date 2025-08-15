import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/Admin/Layout/AdminLayout";
import { auditAPI } from "@/services/api";
import { Loader2, RefreshCw, Download, Shield } from "lucide-react";
import AuditStatsCards from "./AuditStatsCards";
import AuditFilters from "./AuditFilters";
import AuditLogsTable from "./AuditLogsTable";
import AuditLogMobileCards from "./AuditLogMobileCards";
import AuditLogDetailDialog from "./AuditLogDetailDialog";
import Pagination from "@/components/ui/Pagination";

export default function AdminAudit() {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [filters, setFilters] = useState({
    eventType: "all",
    severity: "all",
    dateRange: "all",
    source: "all",
  });

  const [stats, setStats] = useState({ total: 0, bySeverity: {} });
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadLogs();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.eventType, filters.severity, filters.dateRange, filters.source]);

  useEffect(() => {
    applySearch();
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, searchTerm]);

  const mapDaysFromRange = (range) => {
    switch (range) {
      case "1h": return 1;
      case "24h": return 1;
      case "7d": return 7;
      case "30d": return 30;
      default: return 30;
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadLogs(), loadStats()]);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Error cargando auditoría");
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const params = {
        limit: 500,
        dateRange: filters.dateRange !== "all" ? filters.dateRange : undefined,
        eventType: filters.eventType !== "all" ? filters.eventType : undefined,
        severity: filters.severity !== "all" ? filters.severity : undefined,
        source:   filters.source   !== "all" ? filters.source   : undefined,
      };

      const { data } = await auditAPI.getLogs(params);
      const list = Array.isArray(data?.logs)
        ? data.logs
        : Array.isArray(data?.data?.logs)
          ? data.data.logs
          : [];

      setLogs(list);
      if (!searchTerm) setFilteredLogs(list);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Error cargando logs");
      setLogs([]);
      setFilteredLogs([]);
    }
  };

  const loadStats = async () => {
    try {
      const days = filters.dateRange === "all" ? 30 : mapDaysFromRange(filters.dateRange);
      const { data } = await auditAPI.getStats(days);
      setStats({
        total: data?.total_events ?? 0,
        bySeverity: data?.events_by_severity ?? {},
      });
    } catch (err) {
      console.debug("[Audit] error stats:", err);
    }
  };

  const applySearch = () => {
    if (!searchTerm) {
      setFilteredLogs(logs);
      return;
    }
    const st = searchTerm.toLowerCase();
    const filtered = logs.filter((log) =>
      (log.event_type || "").toLowerCase().includes(st) ||
      (log.user_id || "").toLowerCase().includes(st) ||
      JSON.stringify(log.details || {}).toLowerCase().includes(st)
    );
    setFilteredLogs(filtered);
  };

  const exportLogs = async () => {
    try {
      const days = filters.dateRange === "all" ? 30 : mapDaysFromRange(filters.dateRange);
      const resp = await auditAPI.exportLogs("csv", days);
      const blob = new Blob([resp.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Error exportando CSV");
    }
  };

  const formatDate = (ts) => new Date(ts).toLocaleString("es-DO");

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <AdminLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-8 w-8" />
              Registros de Auditoría
            </h1>
            <p className="text-muted-foreground">Monitoreo y análisis de actividades del sistema</p>
          </div>
          <div className="flex gap-2">
            <button onClick={refreshAll} className="btn-outline flex gap-2 items-center px-3 py-2">
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </button>
            <button onClick={exportLogs} className="btn flex gap-2 items-center px-3 py-2">
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
        ) : error ? (
          <div className="p-4 border rounded text-red-600 bg-red-50">{error}</div>
        ) : (
          <>
            <AuditStatsCards stats={stats} />
            <AuditFilters
              filters={filters}
              setFilters={setFilters}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
            />
            <div className="border rounded-lg overflow-x-auto">
              <AuditLogsTable
                logs={paginatedLogs}
                formatDate={formatDate}
                setSelectedLog={setSelectedLog}
              />
              <AuditLogMobileCards
                logs={paginatedLogs}
                formatDate={formatDate}
              />
               <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage}
                totalItems={filteredLogs.length}
              />
            </div>
            <AuditLogDetailDialog
              log={selectedLog}
              open={!!selectedLog}
              onClose={() => setSelectedLog(null)}
              formatDate={formatDate}
            />
          </>
        )}
      </div>
    </AdminLayout>
  );
}
