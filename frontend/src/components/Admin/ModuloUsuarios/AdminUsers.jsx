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

// Componentes separados
import UserFormDialog from "@/components/Admin/ModuloUsuarios/UserFormDialog";
import ChangePasswordDialog from "@/components/Admin/ModuloUsuarios/ChangePasswordDialog";
import UserTable from "@/components/Admin/ModuloUsuarios/UserTable";
import UserStatsCards from "@/components/Admin/ModuloUsuarios/UserStatsCards";
import UserSearchBar from "@/components/Admin/ModuloUsuarios/UserSearchBar";

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
      role: "secretaria",
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
        <ChangePasswordDialog
          open={passwordModalOpen}
          setOpen={setPasswordModalOpen}
          selectedUser={selectedUser}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          onSubmit={handlePasswordSubmit}
        />

        {/* Botón de nuevo usuario y modal */}
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

        {/* Estadísticas */}
        <UserStatsCards stats={stats} />

        {/* Filtro de búsqueda */}
        <UserSearchBar search={search} setSearch={setSearch} />

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
