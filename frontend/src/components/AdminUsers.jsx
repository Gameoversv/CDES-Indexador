import React, { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Pencil, Trash2, UserCog } from "lucide-react";

export default function AdminUsers() {
  const initialUsers = [
    { id: 1, name: "Juan Pérez", email: "juan@example.com", role: "admin", active: true },
    { id: 2, name: "Ana García", email: "ana@example.com", role: "usuario", active: true },
    { id: 3, name: "Carlos Díaz", email: "carlos@example.com", role: "lector", active: false },
  ];

  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({ name: "", email: "", role: "usuario", active: true });
  const [mode, setMode] = useState("edit");

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({ ...user });
    setMode("edit");
  };

  const openCreateModal = () => {
    setSelectedUser(null);
    setFormData({ name: "", email: "", role: "usuario", active: true });
    setMode("create");
  };

  const handleSave = () => {
    if (mode === "edit") {
      setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? { ...u, ...formData } : u)));
    } else {
      const newUser = {
        ...formData,
        id: users.length ? Math.max(...users.map(u => u.id)) + 1 : 1,
      };
      setUsers((prev) => [...prev, newUser]);
    }
    setSelectedUser(null);
  };

  const handleDelete = (userId) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setSelectedUser(null);
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <UserCog className="h-8 w-8" />
              Gestión de Usuarios
            </h1>
            <p className="text-muted-foreground">Crear, editar y eliminar usuarios del sistema</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={openCreateModal}>
                <UserPlus className="h-4 w-4" />
                Crear nuevo usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear nuevo usuario</DialogTitle>
              </DialogHeader>
              <form className="space-y-4 mt-4" onSubmit={(e) => e.preventDefault()}>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Nombre</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Correo</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Rol</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="border rounded px-3 py-2 text-sm"
                  >
                    <option value="admin">Administrador</option>
                    <option value="usuario">Usuario</option>
                    <option value="lector">Lector</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Estado</label>
                  <select
                    value={formData.active ? "activo" : "inactivo"}
                    onChange={(e) =>
                      setFormData({ ...formData, active: e.target.value === "activo" })
                    }
                    className="border rounded px-3 py-2 text-sm"
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setSelectedUser(null)}>Cancelar</Button>
                  <Button type="button" onClick={handleSave}>Guardar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <Input
              placeholder="Buscar usuario por nombre o correo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.active ? "success" : "destructive"}>
                        {user.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Editar Usuario</DialogTitle>
                          </DialogHeader>
                          <form className="space-y-4 mt-4" onSubmit={(e) => e.preventDefault()}>
                            <div className="grid gap-2">
                              <label className="text-sm font-medium">Nombre</label>
                              <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              />
                            </div>
                            <div className="grid gap-2">
                              <label className="text-sm font-medium">Correo</label>
                              <Input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              />
                            </div>
                            <div className="grid gap-2">
                              <label className="text-sm font-medium">Rol</label>
                              <select
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                className="border rounded px-3 py-2 text-sm"
                              >
                                <option value="admin">Administrador</option>
                                <option value="usuario">Usuario</option>
                                <option value="lector">Lector</option>
                              </select>
                            </div>
                            <div className="grid gap-2">
                              <label className="text-sm font-medium">Estado</label>
                              <select
                                value={formData.active ? "activo" : "inactivo"}
                                onChange={(e) =>
                                  setFormData({ ...formData, active: e.target.value === "activo" })
                                }
                                className="border rounded px-3 py-2 text-sm"
                              >
                                <option value="activo">Activo</option>
                                <option value="inactivo">Inactivo</option>
                              </select>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                              <Button variant="outline" onClick={() => setSelectedUser(null)}>Cancelar</Button>
                              <Button type="button" onClick={handleSave}>Guardar cambios</Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedUser(user)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Confirmar Eliminación</DialogTitle>
                          </DialogHeader>
                          <p className="text-sm py-2">
                            ¿Estás seguro que deseas eliminar a <strong>{selectedUser?.name}</strong>?
                            Esta acción no se puede deshacer.
                          </p>
                          <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setSelectedUser(null)}>Cancelar</Button>
                            <Button variant="destructive" onClick={() => handleDelete(selectedUser.id)}>Eliminar</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
