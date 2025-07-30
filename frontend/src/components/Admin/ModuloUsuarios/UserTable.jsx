import React from "react";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Lock } from "lucide-react";

// Mapeo de roles técnicos a nombres legibles
const roleLabels = {
  admin: "Dirección Ejecutiva",
  asistenciaGeneral: "Asistencia General",
  CoordinadorPlanificacion: "Coordinador de Planificación",
  UnidadAdministrativa: "Unidad Administrativa",
  UnidadComunicacion: "Unidad de Comunicación",
  UnidadPlanificacion: "Unidad de Planificación",
  UnidadProyectos: "Unidad de Gestión de Proyectos",
};

export default function UserTable({ users, onEdit, onDelete, onChangePassword }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Rol</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u) => (
          <TableRow key={u.id}>
            <TableCell>{u.display_name}</TableCell>
            <TableCell>{u.email}</TableCell>
            <TableCell>
              <Badge>
                {roleLabels[u.role] || u.role}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge
                style={{
                  backgroundColor: u.status === "active" ? "#22c55e" : "#ef4444",
                  color: "white",
                }}
              >
                {u.status === "active" ? "Activo" : "Inactivo"}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onEdit(u)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-500 text-red-500"
                  onClick={() => onDelete(u.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onChangePassword(u)}
                >
                  <Lock className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
