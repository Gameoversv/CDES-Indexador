import React, { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { 
  UserPlus, Pencil, Trash2, UserCog, Search, User, Shield, Eye, Book 
} from "lucide-react";

export default function AdminUsers() {
  const initialUsers = [
    { id: 1, name: "Juan Pérez", email: "juan@example.com", role: "admin", active: true },
    { id: 2, name: "Ana García", email: "ana@example.com", role: "usuario", active: true },
    { id: 3, name: "Carlos Díaz", email: "carlos@example.com", role: "lector", active: false },
    { id: 4, name: "María López", email: "maria@example.com", role: "usuario", active: true },
    { id: 5, name: "Roberto Jiménez", email: "roberto@example.com", role: "lector", active: true },
  ];

  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({ name: "", email: "", role: "usuario", active: true });
  const [mode, setMode] = useState("edit");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const ROLE_ICONS = {
    admin: <Shield className="h-4 w-4 mr-2" />,
    usuario: <User className="h-4 w-4 mr-2" />,
    lector: <Book className="h-4 w-4 mr-2" />
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({ ...user });
    setMode("edit");
    setIsDialogOpen(true);
  };

  const openCreateModal = () => {
    setSelectedUser(null);
    setFormData({ name: "", email: "", role: "usuario", active: true });
    setMode("create");
    setIsDialogOpen(true);
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
    setIsDialogOpen(false);
  };

  const handleDelete = (userId) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setIsDeleteDialogOpen(false);
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
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <UserCog className="h-7 w-7 text-primary" />
              <span>Gestión de Usuarios</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Administra los usuarios y sus permisos en el sistema
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-sm hover:shadow-md transition-shadow" onClick={openCreateModal}>
                <UserPlus className="h-4 w-4" />
                Nuevo usuario
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {mode === "create" ? (
                    <>
                      <UserPlus className="h-5 w-5 text-primary" />
                      Crear nuevo usuario
                    </>
                  ) : (
                    <>
                      <Pencil className="h-5 w-5 text-primary" />
                      Editar usuario
                    </>
                  )}
                </DialogTitle>
                <DialogDescription>
                  Completa la información del usuario
                </DialogDescription>
              </DialogHeader>
              
              <form className="space-y-4 mt-2" onSubmit={(e) => e.preventDefault()}>
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre completo</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nombre y apellidos"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="ejemplo@dominio.com"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rol</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => setFormData({ ...formData, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un rol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">
                          <div className="flex items-center">
                            <Shield className="h-4 w-4 mr-2" />
                            Administrador
                          </div>
                        </SelectItem>
                        <SelectItem value="usuario">
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-2" />
                            Usuario
                          </div>
                        </SelectItem>
                        <SelectItem value="lector">
                          <div className="flex items-center">
                            <Book className="h-4 w-4 mr-2" />
                            Lector
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select
                      value={formData.active ? "activo" : "inactivo"}
                      onValueChange={(value) => setFormData({ ...formData, active: value === "activo" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="activo">Activo</SelectItem>
                        <SelectItem value="inactivo">Inactivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleSave}>
                    {mode === "create" ? "Crear usuario" : "Guardar cambios"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border rounded-xl shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>Lista de usuarios</CardTitle>
                <CardDescription className="mt-1">
                  {filteredUsers.length} de {users.length} usuarios encontrados
                </CardDescription>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuario..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="w-[35%]">Usuario</TableHead>
                  <TableHead className="w-[30%]">Correo</TableHead>
                  <TableHead className="w-[15%]">Rol</TableHead>
                  <TableHead className="w-[15%]">Estado</TableHead>
                  <TableHead className="text-right w-[5%]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium flex items-center">
                      <div className="bg-gray-100 rounded-full p-2 mr-3">
                        <User className="h-4 w-4 text-gray-600" />
                      </div>
                      {user.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {ROLE_ICONS[user.role]}
                        <Badge 
                          variant={user.role === "admin" ? "default" : "secondary"}
                          className="capitalize"
                        >
                          {user.role}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={user.active ? "success" : "destructive"}
                        className="flex items-center gap-1"
                      >
                        <div className={`h-2 w-2 rounded-full ${user.active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        {user.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(user)}
                        className="text-primary hover:bg-primary/10"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Dialog open={isDeleteDialogOpen && selectedUser?.id === user.id} onOpenChange={(open) => {
                        if (!open) setIsDeleteDialogOpen(false);
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedUser(user);
                              setIsDeleteDialogOpen(true);
                            }}
                            className="text-red-500 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-lg max-w-sm">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <Trash2 className="h-5 w-5 text-red-500" />
                              Eliminar usuario
                            </DialogTitle>
                          </DialogHeader>
                          
                          <div className="py-4">
                            <p className="text-sm text-gray-700">
                              ¿Estás seguro que deseas eliminar al usuario <strong>{selectedUser?.name}</strong>?
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              Esta acción eliminará permanentemente la cuenta y no se podrá deshacer.
                            </p>
                          </div>
                          
                          <div className="flex justify-end gap-2 pt-2">
                            <Button 
                              variant="outline" 
                              onClick={() => setIsDeleteDialogOpen(false)}
                            >
                              Cancelar
                            </Button>
                            <Button 
                              variant="destructive" 
                              onClick={() => handleDelete(selectedUser.id)}
                              className="gap-1"
                            >
                              <Trash2 className="h-4 w-4" />
                              Eliminar
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <Search className="h-12 w-12 mx-auto text-gray-300" />
                <h3 className="mt-4 font-medium text-gray-600">No se encontraron usuarios</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {search ? 'Intenta con otro término de búsqueda' : 'No hay usuarios registrados'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}