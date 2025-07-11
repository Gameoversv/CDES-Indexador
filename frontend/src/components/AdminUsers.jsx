// frontend/pages/Users.jsx
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  User,
  Shield,
  CheckCircle,
  XCircle,
  Plus
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

const API_BASE = "http://localhost:8000";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [createData, setCreateData] = useState({
    display_name: "",
    email: "",
    password: "",
    role: "usuario"
  });

  // Carga usuarios desde GET /users
  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      });
      if (!res.ok) throw new Error("Error al cargar usuarios");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filtered = users.filter(
    (u) =>
      u.display_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: users.length,
    active: users.filter((u) => !u.disabled).length,
    admins: users.filter((u) => u.role === "admin").length
  };

  // Crea usuario usando POST /users
  const handleCreate = async () => {
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          email: createData.email,
          password: createData.password,
          display_name: createData.display_name,
          role: createData.role,
          disabled: false
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Error al crear usuario");
      }
      // refresca lista y limpia formulario
      fetchUsers();
      setCreateData({ display_name: "", email: "", password: "", role: "usuario" });
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6 bg-white text-black">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <User className="h-8 w-8" />
            Gestión de Usuarios
          </h1>
          <p className="text-sm text-[#6b7280]">
            Administra los usuarios y permisos del sistema
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2 bg-red-500 text-white">
              <Plus className="h-4 w-4" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear nuevo usuario</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Nombre</label>
                <Input
                  value={createData.display_name}
                  onChange={(e) =>
                    setCreateData({ ...createData, display_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Correo</label>
                <Input
                  type="email"
                  value={createData.email}
                  onChange={(e) =>
                    setCreateData({ ...createData, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Contraseña</label>
                <Input
                  type="password"
                  value={createData.password}
                  onChange={(e) =>
                    setCreateData({ ...createData, password: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Rol</label>
                <select
                  value={createData.role}
                  onChange={(e) =>
                    setCreateData({ ...createData, role: e.target.value })
                  }
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="admin">Administrador</option>
                  <option value="usuario">Usuario</option>
                  <option value="lector">Lector</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline">Cancelar</Button>
                <Button onClick={handleCreate}>Crear</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-[#6b7280]" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-[#6b7280]">Usuarios totales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-[#6b7280]" />
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-sm text-[#6b7280]">Usuarios activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#6b7280]" />
              <div>
                <p className="text-2xl font-bold">{stats.admins}</p>
                <p className="text-sm text-[#6b7280]">Administradores</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtro */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-[#6b7280]" />
            <Input
              placeholder="Buscar usuarios por nombre o email..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabla de usuarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Lista de Usuarios
          </CardTitle>
          <CardDescription className="text-[#6b7280]">
            {filtered.length} usuarios encontrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold text-black">Usuario</TableHead>
                <TableHead className="font-semibold text-black">Email</TableHead>
                <TableHead className="font-semibold text-black">Rol</TableHead>
                <TableHead className="font-semibold text-black">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => (
                <TableRow key={user.uid}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-200 border-2 border-dashed rounded-xl w-10 h-10" />
                      <div>
                        <div className="font-medium">{user.display_name}</div>
                        <div className="text-sm text-[#6b7280]">ID: {user.uid}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      style={{
                        backgroundColor:
                          user.role === "admin" ? "#fee2e2" : "#e5e7eb",
                        color: "#111827"
                      }}
                    >
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {!user.disabled ? (
                      <Badge
                        variant="secondary"
                        style={{ backgroundColor: "#22c55e", color: "white" }}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" /> Activo
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        style={{ backgroundColor: "#ef4444", color: "white" }}
                      >
                        <XCircle className="h-3 w-3 mr-1" /> Inactivo
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
