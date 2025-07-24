import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  LayoutList,
  LayoutGrid,
  CalendarIcon,
  XCircle,
} from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

// 📅 Selector de fecha
function DatePicker({ label, date, onChange }) {
  return (
    <div className="flex flex-col justify-end gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-[150px] justify-start text-left font-normal border border-gray-300"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(new Date(date), "dd/MM/yyyy") : "Seleccionar"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date ? new Date(date) : undefined}
            onSelect={(selected) => {
              if (selected) onChange(selected.toISOString().split("T")[0]);
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function DocumentToolbar({
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  typeContent,
  setTypeContent,
  dateRange,
  setDateRange,
  viewMode,
  setViewMode,
  onRefresh,
  clearAllFilters,
}) {
  return (
    <div className="flex flex-wrap gap-4 items-end mb-6">
      <Input
        placeholder="Buscar por nombre, contenido o palabras clave..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-[220px]"
      />

      <div className="flex flex-col justify-end">
        <label className="text-sm font-medium text-gray-700">Tipo</label>
        <Select value={typeContent} onValueChange={setTypeContent}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="reporte">Reporte</SelectItem>
            <SelectItem value="comunicado">Comunicado</SelectItem>
            <SelectItem value="carta">Carta</SelectItem>
            <SelectItem value="invitación">Invitación</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col justify-end">
        <label className="text-sm font-medium text-gray-700">Formato</label>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Formato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="docx">Word</SelectItem>
            <SelectItem value="xlsx">Excel</SelectItem>
            <SelectItem value="pptx">PowerPoint</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DatePicker
        label="Desde"
        date={dateRange.from}
        onChange={(value) => setDateRange((prev) => ({ ...prev, from: value }))}
      />
      <DatePicker
        label="Hasta"
        date={dateRange.to}
        onChange={(value) => setDateRange((prev) => ({ ...prev, to: value }))}
      />

      <div className="flex gap-2 ml-auto items-end">
        <Button
          variant="ghost"
          onClick={clearAllFilters}
          className="text-gray-700 hover:text-black border border-gray-300"
        >
          <XCircle className="h-4 w-4 mr-1" />
          Limpiar
        </Button>

        <Button
          variant="outline"
          onClick={() => {
            clearAllFilters();
            onRefresh();
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>

        {/* Botones de vista con rojo consistente */}
        <Button
          onClick={() => setViewMode("list")}
          className={`h-10 px-3 ${
            viewMode === "list"
              ? "bg-red-600 text-white hover:bg-red-700"
              : "border border-gray-300"
          }`}
        >
          <LayoutList className="h-4 w-4" />
        </Button>

        <Button
          onClick={() => setViewMode("grid")}
          className={`h-10 px-3 ${
            viewMode === "grid"
              ? "bg-red-600 text-white hover:bg-red-700"
              : "border border-gray-300"
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
