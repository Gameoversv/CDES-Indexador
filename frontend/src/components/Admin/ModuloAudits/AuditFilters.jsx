import React, { useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Filter, Search } from "lucide-react";
import { SEVERITY_LEVELS, EVENT_TYPES } from "@/components/utils/auditUtils";

const SOURCE_OPTIONS = {
  all: { label: "Cualquier origen" },
  api: { label: "API" },
  system: { label: "Sistema" },
  frontend: { label: "Frontend" },
  user: { label: "Usuario" },
  scheduler: { label: "Scheduler" },
};

const DEFAULT_FILTERS = {
  eventType: "all",
  severity: "all",
  dateRange: "all",
  source: "all",
};

export default function AuditFilters({ filters, setFilters, searchTerm, setSearchTerm }) {
  // Opciones ordenadas por label (mejor UX)
  const eventOptions = useMemo(() => {
    return Object.entries(EVENT_TYPES)
      .map(([key, val]) => ({ key, label: val.label }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, []);

  const severityOptions = useMemo(() => {
    return Object.entries(SEVERITY_LEVELS)
      .map(([key, val]) => ({ key, label: val.label }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, []);

  const sourceOptions = useMemo(() => {
    return Object.entries(SOURCE_OPTIONS)
      .map(([key, val]) => ({ key, label: val.label }))
      .sort((a, b) => {
        // “all” siempre primero
        if (a.key === "all") return -1;
        if (b.key === "all") return 1;
        return a.label.localeCompare(b.label, "es");
      });
  }, []);

  const clearAll = () => {
    setSearchTerm("");
    setFilters(DEFAULT_FILTERS);
  };

  return (
    <div className="card p-6 space-y-4">
      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar en registros..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Tipo de evento */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={filters.eventType}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, eventType: value }))}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Tipo de evento" />
            </SelectTrigger>
            <SelectContent className="max-h-72 overflow-auto">
              <SelectItem value="all">Todos los eventos</SelectItem>
              {eventOptions.map(({ key, label }) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Severidad */}
        <Select
          value={filters.severity}
          onValueChange={(value) => setFilters((prev) => ({ ...prev, severity: value }))}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Severidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {severityOptions.map(({ key, label }) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Origen (source) */}
        <Select
          value={filters.source ?? "all"}
          onValueChange={(value) => setFilters((prev) => ({ ...prev, source: value }))}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Origen" />
          </SelectTrigger>
          <SelectContent>
            {sourceOptions.map(({ key, label }) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Rango de fechas */}
        <Select
          value={filters.dateRange}
          onValueChange={(value) => setFilters((prev) => ({ ...prev, dateRange: value }))}
        >
          <SelectTrigger className="w-44">
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

        {/* Limpiar filtros */}
        <button
          type="button"
          onClick={clearAll}
          className="ml-auto text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
        >
          Limpiar filtros
        </button>
      </div>
    </div>
  );
}
