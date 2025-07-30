import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function UserFormDialog({
  open,
  setOpen,
  isEditing,
  formData,
  setFormData,
  onSubmit,
  onOpenNew,
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={onOpenNew}>
        <Plus className="h-4 w-4 mr-2" />
        Nuevo Usuario
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm">Nombre completo</label>
            <Input
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm">Correo electrónico</label>
            <Input
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={isEditing}
            />
          </div>
          {!isEditing && (
            <div>
              <label className="text-sm">Contraseña</label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          )}
          <div>
            <label className="text-sm">Rol</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="admin">Dirección Ejecutiva</option>
              <option value="asistenciaGeneral">Asistencia General</option>
              <option value="CoordinadorPlanificacion">Coordinador de Planificación</option>
              <option value="UnidadAdministrativa">Unidad Administrativa</option>
              <option value="UnidadComunicacion">Unidad de Comunicación</option>
              <option value="UnidadPlanificacion">Unidad de Planificación</option>
              <option value="UnidadProyectos">Unidad de Gestión de Proyectos</option>
            </select>
          </div>
          <div>
            <label className="text-sm">Estado</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={onSubmit}>{isEditing ? "Actualizar" : "Crear"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
