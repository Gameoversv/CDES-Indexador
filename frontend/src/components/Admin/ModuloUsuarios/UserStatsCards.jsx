import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

// Mapeo de roles técnicos a nombres legibles
const roleMap = {
  admin: "Dirección Ejecutiva",
  asistenciaGeneral: "Asistencia General",
  CoordinadorPlanificacion: "Coordinador de Planificación",
  UnidadAdministrativa: "Unidad Administrativa",
  UnidadComunicacion: "Unidad de Comunicación y Difusión",
  UnidadPlanificacion: "Unidad de Planificación",
  UnidadProyectos: "Unidad de Gestión de Proyectos",
};

export default function UserStatsCards({ stats }) {
  const [selectedRole, setSelectedRole] = useState("admin");

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {/* Total usuarios */}
      <Card>
        <CardContent className="p-6">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-sm text-muted-foreground">Usuarios totales</p>
        </CardContent>
      </Card>

      {/* Activos */}
      <Card>
        <CardContent className="p-6">
          <p className="text-2xl font-bold">{stats.active}</p>
          <p className="text-sm text-muted-foreground">Usuarios activos</p>
        </CardContent>
      </Card>

      {/* Por rol con dropdown */}
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-1">
            <p className="text-2xl font-bold">
              {stats[selectedRole] ?? 0}
            </p>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-[220px] h-8 text-sm">
                <SelectValue placeholder="Seleccione rol" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(roleMap).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">Usuarios por rol</p>
        </CardContent>
      </Card>
    </div>
  );
}
