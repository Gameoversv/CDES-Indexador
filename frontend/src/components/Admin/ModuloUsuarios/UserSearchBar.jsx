import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

// Nuevos roles oficiales
const roleMap = {
  admin: "Dirección Ejecutiva",
  asistenciaGeneral: "Asistencia General",
  CoordinadorPlanificacion: "Coordinador de Planificación",
  UnidadAdministrativa: "Unidad Administrativa",
  UnidadComunicacion: "Unidad de Comunicación y Difusión",
  UnidadPlanificacion: "Unidad de Planificación",
  UnidadProyectos: "Unidad de Gestión de Proyectos",
};

export default function UserSearchBar({ search, setSearch, roleFilter, setRoleFilter }) {
  return (
    <Card>
      <CardContent className="p-6 flex flex-col md:flex-row gap-4 items-end">
        {/* Buscador */}
        <div className="relative w-full md:w-1/2">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted" />
          <Input
            placeholder="Buscar por nombre, correo o rol..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filtro de rol */}
        <div className="w-full md:w-64">
          <label className="text-sm font-medium text-gray-700 block mb-1">Rol</label>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(roleMap).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
