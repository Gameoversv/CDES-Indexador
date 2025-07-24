import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LayoutGrid, LayoutList, RefreshCw } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";

export default function LibraryToolbar({
  viewMode,
  setViewMode,
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  typeContent,
  setTypeContent,
  dateRange,
  setDateRange,
  onRefresh,
  onUpload,
  hideUpload = false,
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      {/* Filtros de búsqueda y selectores */}
      <div className="flex flex-wrap gap-3 items-end">
        <Input
          placeholder="Buscar documentos públicos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[200px]"
        />

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Formato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los formatos</SelectItem>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="docx">Word</SelectItem>
            <SelectItem value="xlsx">Excel</SelectItem>
            <SelectItem value="pptx">PowerPoint</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeContent} onValueChange={setTypeContent}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo de documento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="reporte">Reporte</SelectItem>
            <SelectItem value="carta">Carta</SelectItem>
            <SelectItem value="comunicado">Comunicado</SelectItem>
            <SelectItem value="informe">Informe</SelectItem>
          </SelectContent>
        </Select>

        <div className="w-[250px]">
          <DateRangePicker date={dateRange} setDate={setDateRange} />
        </div>
      </div>

      {/* Controles de vista y subida */}
      <div className="flex gap-2">
        <Button variant="outline" size="icon" onClick={onRefresh}>
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Button
          variant={viewMode === "grid" ? "default" : "outline"}
          size="icon"
          onClick={() => setViewMode("grid")}
        >
          <LayoutGrid className="w-4 h-4" />
        </Button>
        <Button
          variant={viewMode === "list" ? "default" : "outline"}
          size="icon"
          onClick={() => setViewMode("list")}
        >
          <LayoutList className="w-4 h-4" />
        </Button>

        {!hideUpload && onUpload && (
          <Button onClick={onUpload}>Subir documento</Button>
        )}
      </div>
    </div>
  );
}
