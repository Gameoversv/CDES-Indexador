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
  //admin: "Dirección Ejecutiva",
  DireccionEjecutiva: "Dirección Ejecutiva",
  CoordinadorAdministrativa: "Coordinador Administrativa",
  CoordinacionProyectosPlanificacion: "Coordinación Proyectos y Planificación",
  CoordinacionComunicaciones: "Coordinación de Comunicaciones",
  AsistenciaGeneral: "Asistencia General"
};

export default function UserTable({ users, onEdit, onDelete, onChangePassword }) {
  return (
    <Table>
      <TableHeader className="bg-gray-100">
        <TableRow>
          <TableHead className="py-3 border-b border-gray-300 text-gray-900 font-semibold">Nombre</TableHead>
          <TableHead className="py-3 border-b border-gray-300 text-gray-900 font-semibold">Email</TableHead>
          <TableHead className="py-3 border-b border-gray-300 text-gray-900 font-semibold">Rol</TableHead>
          <TableHead className="py-3 border-b border-gray-300 text-gray-900 font-semibold">Estado</TableHead>
          <TableHead className="text-right py-3 border-b border-gray-300 text-gray-900 font-semibold">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u) => (
          <TableRow key={u.id} className="hover:bg-gray-50 border-b border-gray-300">
            <TableCell className="font-medium text-gray-900">{u.display_name}</TableCell>
            <TableCell className="text-gray-900">{u.email}</TableCell>
            <TableCell>
              <Badge variant="secondary" className="border border-gray-300">
                {roleLabels[u.role] || u.role}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge
                className={`border border-gray-300 ${
                  u.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {u.status === "active" ? "Activo" : "Inactivo"}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" className="rounded-full p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300" onClick={() => onEdit(u)}>
                  <Pencil className="h-4 w-4 text-gray-900" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                  onClick={() => onDelete(u.id)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                  onClick={() => onChangePassword(u)}
                >
                  <Lock className="h-4 w-4 text-gray-900" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
