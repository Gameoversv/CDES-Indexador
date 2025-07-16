import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  User,
  Plus,
  Pencil,
  Trash2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  changeUserPassword,
} from "@/services/usersAPI";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    display_name: "",
    email: "",
    password: "",
    role: "secretaria",
    status: "active",
  });

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const fetchUsers = async () => {
    try {
      const res = await getUsers();
      setUsers(res);
    } catch {
      toast.error("Error al cargar usuarios");
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateOrUpdate = async () => {
    if (!formData.display_name || !formData.email) {
      toast.error("Nombre y correo son obligatorios.");
      return;
    }

    if (!formData.role || !["admin", "secretaria", "supervisor"].includes(formData.role)) {
      toast.error("Debes seleccionar un rol válido.");
      return;
    }

    if (!formData.status || !["active", "inactive"].includes(formData.status)) {
      toast.error("Debes seleccionar un estado válido.");
      return;
    }

    if (!isEditing && !formData.password) {
      toast.error("La contraseña es obligatoria al crear un usuario.");
      return;
    }

    try {
      if (isEditing && selectedUser?.id) {
        await updateUser(selectedUser.id, {
          display_name: formData.display_name,
          email: formData.email,
          role: formData.role,
          status: formData.status,
        });
        toast.success("Usuario actualizado");
      } else {
        await createUser(formData);
        toast.success("Usuario creado");
      }

      setModalOpen(false);
      setFormData({
        display_name: "",
        email: "",
        password: "",
        role: "secretaria",
        status: "active",
      });
      setSelectedUser(null);
      fetchUsers();
    } catch {
      toast.error("Error al guardar usuario");
    }
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    setFormData({
      display_name: user.display_name || "",
      email: user.email,
      role: user.role,
      status: user.status,
    });
    setIsEditing(true);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este usuario?")) return;
    try {
      await deleteUser(id);
      toast.success("Usuario eliminado");
      fetchUsers();
    } catch {
      toast.error("Error al eliminar usuario");
    }
  };

  const openPasswordModal = (user) => {
    setSelectedUser(user);
    setNewPassword("");
    setPasswordModalOpen(true);
  };

  const handlePasswordSubmit = async () => {
    if (!newPassword) {
      toast.error("Debes ingresar una nueva contraseña.");
      return;
    }
    try {
      await changeUserPassword(selectedUser.email, newPassword);
      toast.success("Contraseña actualizada");
      setPasswordModalOpen(false);
      setSelectedUser(null);
    } catch {
      toast.error("Error actualizando contraseña");
    }
  };

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: users.length,
    active: users.filter((u) => u.status === "active").length,
    admins: users.filter((u) => u.role === "admin").length,
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Modal cambio de contraseña */}
        <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Cambiar contraseña para {selectedUser?.email}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <label className="text-sm">Nueva contraseña</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setPasswordModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handlePasswordSubmit}>Actualizar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Resto del componente */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold flex gap-2 items-center">
            <User className="h-6 w-6" /> Gestión de Usuarios
          </h1>
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setIsEditing(false);
                  setSelectedUser(null);
                  setFormData({
                    display_name: "",
                    email: "",
                    password: "",
                    role: "secretaria",
                    status: "active",
                  });
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{isEditing ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm">Nombre completo</label>
                  <Input
                    value={formData.display_name}
                    onChange={(e) =>
                      setFormData({ ...formData, display_name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm">Correo electrónico</label>
                  <Input
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    disabled={isEditing}
                  />
                </div>
                {!isEditing && (
                  <div>
                    <label className="text-sm">Contraseña</label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                    />
                  </div>
                )}
                <div>
                  <label className="text-sm">Rol</label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                  >
                    <option value="admin">Administrador</option>
                    <option value="secretaria">Secretaria</option>
                    <option value="supervisor">Supervisor</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm">Estado</label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateOrUpdate}>
                    {isEditing ? "Actualizar" : "Crear"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Estadísticas */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card><CardContent className="p-6"><p className="text-2xl font-bold">{stats.total}</p><p className="text-sm text-muted-foreground">Usuarios totales</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-2xl font-bold">{stats.active}</p><p className="text-sm text-muted-foreground">Usuarios activos</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-2xl font-bold">{stats.admins}</p><p className="text-sm text-muted-foreground">Administradores</p></CardContent></Card>
        </div>

        {/* Filtro */}
        <Card>
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted" />
              <Input
                placeholder="Buscar por email..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabla */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Lista de Usuarios
            </CardTitle>
            <CardDescription>{filtered.length} usuarios encontrados</CardDescription>
          </CardHeader>
          <CardContent>
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
                {filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.display_name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell><Badge>{u.role}</Badge></TableCell>
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
                        <Button size="sm" variant="outline" onClick={() => handleEdit(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500 text-red-500"
                          onClick={() => handleDelete(u.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPasswordModal(u)}
                        >
                          <Lock className="h-4 w-4" />
                        </Button>
                      </div>
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
