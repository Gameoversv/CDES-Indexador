import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/Admin/Layout/AdminLayout";
import { toast } from "sonner";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  changeUserPassword,
} from "@/services/usersAPI";

import UserFormDialog from "@/components/Admin/ModuloUsuarios/UserFormDialog";
import ChangePasswordDialog from "@/components/Admin/ModuloUsuarios/ChangePasswordDialog";
import UserTable from "@/components/Admin/ModuloUsuarios/UserTable";
import UserStatsCards from "@/components/Admin/ModuloUsuarios/UserStatsCards";
import UserSearchBar from "@/components/Admin/ModuloUsuarios/UserSearchBar";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    display_name: "",
    email: "",
    password: "",
    role: "asistenciaGeneral",
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

  const validRoles = [
    "admin",
    "asistenciaGeneral",
    "CoordinadorPlanificacion",
    "UnidadAdministrativa",
    "UnidadComunicacion",
    "UnidadPlanificacion",
    "UnidadProyectos",
  ];

  const handleCreateOrUpdate = async () => {
    if (!formData.display_name || !formData.email) {
      toast.error("Nombre y correo son obligatorios.");
      return;
    }

    if (!formData.role || !validRoles.includes(formData.role)) {
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
      resetForm();
      fetchUsers();
    } catch {
      toast.error("Error al guardar usuario");
    }
  };

  const resetForm = () => {
    setFormData({
      display_name: "",
      email: "",
      password: "",
      role: "asistenciaGeneral",
      status: "active",
    });
    setSelectedUser(null);
    setIsEditing(false);
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

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.display_name.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase());

    const matchesRole = roleFilter === "all" || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const stats = {
    total: users.length,
    active: users.filter((u) => u.status === "active").length,
    admin: users.filter((u) => u.role === "admin").length,
    asistenciaGeneral: users.filter((u) => u.role === "asistenciaGeneral").length,
    CoordinadorPlanificacion: users.filter((u) => u.role === "CoordinadorPlanificacion").length,
    UnidadAdministrativa: users.filter((u) => u.role === "UnidadAdministrativa").length,
    UnidadComunicacion: users.filter((u) => u.role === "UnidadComunicacion").length,
    UnidadPlanificacion: users.filter((u) => u.role === "UnidadPlanificacion").length,
    UnidadProyectos: users.filter((u) => u.role === "UnidadProyectos").length,
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Encabezado */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h2>
          <UserFormDialog
            open={modalOpen}
            setOpen={setModalOpen}
            isEditing={isEditing}
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleCreateOrUpdate}
            onOpenNew={() => {
              resetForm();
              setModalOpen(true);
            }}
          />
        </div>

        {/* Modales */}
        <ChangePasswordDialog
          open={passwordModalOpen}
          setOpen={setPasswordModalOpen}
          selectedUser={selectedUser}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          onSubmit={handlePasswordSubmit}
        />

        {/* Estadísticas */}
        <UserStatsCards stats={stats} />

        {/* Filtros */}
        <UserSearchBar
          search={search}
          setSearch={setSearch}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
        />

        {/* Tabla */}
        <UserTable
          users={filtered}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onChangePassword={openPasswordModal}
        />
      </div>
    </AdminLayout>
  );
}
