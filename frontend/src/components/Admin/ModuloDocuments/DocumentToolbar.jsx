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
import DatePicker from "@/components/ui/DatePicker";

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
  const documentTypes = [
    { value: "all", label: "Todos" },
    { value: "actas", label: "Actas" },
    { value: "mapas", label: "Mapas" },
    { value: "logos", label: "Logos" },
    { value: "graficos", label: "Gráficos" },
    { value: "plan", label: "Plan" },
    { value: "video", label: "Video" },
    { value: "foto", label: "Foto" },
    { value: "listado", label: "Listado" },
    { value: "carta", label: "Carta" },
    { value: "informe", label: "Informe" },
    { value: "convenios", label: "Convenios" },
    { value: "contrato", label: "Contrato" },
    { value: "discursos", label: "Discursos" },
    { value: "convocatorias", label: "Convocatorias" },
    { value: "invitacion", label: "Invitación" },
    { value: "cuestionario/ instrumento de recolección de datos", label: "Cuestionario" },
    { value: "tder", label: "TDER" },
    { value: "cronograma", label: "Cronograma" },
    { value: "diagnostico", label: "Diagnóstico" },
    { value: "presentaciones", label: "Presentaciones" },
    { value: "minutas_ayuda_memoria", label: "Minutas/Ayuda Memoria" },
    { value: "nota_prensa_comunicaciones", label: "Nota Prensa/Comunicaciones" },
    { value: "ficha_tecnica", label: "Ficha Técnica" },
    { value: "estudio", label: "Estudio" },
    { value: "memorias_institucionales", label: "Memorias Institucionales" },
    { value: "declaracion_ciudadana", label: "Declaración Ciudadana" }
  ];
  return (
    <div className="flex flex-wrap gap-4 items-end mb-6">
      <Input
        placeholder="Buscar en nombre, título, resumen o palabras clave..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-[280px]"
      />

      {/* Tipo - Actualizado con los nuevos tipos */}
            <div className="flex flex-col justify-end">
              <label className="text-sm font-medium text-gray-700">Tipo</label>
              <Select value={typeContent} onValueChange={setTypeContent}>
                <SelectTrigger className="w-[180px]"> {/* Aumentado el ancho para acomodar nombres más largos */}
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto"> {/*Añadido scroll para muchas opciones */}
                {documentTypes.map((type) => (
                   <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
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