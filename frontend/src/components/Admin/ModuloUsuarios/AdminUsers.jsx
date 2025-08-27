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
import ConfirmDeleteUserDialog from "@/components/Admin/ModuloUsuarios/ConfirmDeleteUserDialog";

import Pagination from "@/components/ui/Pagination";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [processingUser, setProcessingUser] = useState(false);
  const [formData, setFormData] = useState({
    display_name: "",
    email: "",
    password: "",
    role: "AsistenciaGeneral",
    status: "active",
  });

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState({
    open: false,
    user: null,
  });
  const itemsPerPage = 10;

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
    "DireccionEjecutiva",
    "CoordinadorAdministrativa",
    "CoordinacionProyectosPlanificacion",
    "CoordinacionComunicaciones",
    "AsistenciaGeneral",
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

    setProcessingUser(true);

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
      await fetchUsers();
    } catch {
      toast.error("Error al guardar usuario");
    } finally {
      setProcessingUser(false);
    }
  };

  const resetForm = () => {
    setFormData({
      display_name: "",
      email: "",
      password: "",
      role: "AsistenciaGeneral",
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

  const showDeleteConfirm = (user) => {
    setConfirmDelete({ open: true, user });
  };

  const handleDelete = async () => {
    if (!confirmDelete.user) return;
    
    setProcessingUser(true);
    
    try {
      await deleteUser(confirmDelete.user.id);
      toast.success("Usuario eliminado");
      await fetchUsers();
    } catch {
      toast.error("Error al eliminar usuario");
    } finally {
      setProcessingUser(false);
      setConfirmDelete({ open: false, user: null });
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
    
    setProcessingUser(true);
    
    try {
      await changeUserPassword(selectedUser.email, newPassword);
      toast.success("Contraseña actualizada");
      setPasswordModalOpen(false);
      setSelectedUser(null);
    } catch {
      toast.error("Error actualizando contraseña");
    } finally {
      setProcessingUser(false);
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

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedUsers = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const stats = {
    total: users.length,
    active: users.filter((u) => u.status === "active").length,
    DireccionEjecutiva: users.filter((u) => u.role === "DireccionEjecutiva").length,
    AsistenciaGeneral: users.filter((u) => u.role === "AsistenciaGeneral").length,
    CoordinacionProyectosPlanificacion: users.filter((u) => u.role === "CoordinacionProyectosPlanificacion").length,
    CoordinacionComunicaciones: users.filter((u) => u.role === "CoordinacionComunicaciones").length,
    CoordinadorAdministrativa: users.filter((u) => u.role === "CoordinadorAdministrativa").length,
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
            processing={processingUser}
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
          processing={processingUser}
        />

        <ConfirmDeleteUserDialog
          open={confirmDelete.open}
          onClose={() => setConfirmDelete({ open: false, user: null })}
          onConfirm={handleDelete}
          username={confirmDelete.user?.display_name}
          processing={processingUser}
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
        <div className="border rounded-lg overflow-hidden">
          <UserTable
            users={paginatedUsers}
            onEdit={handleEdit}
            onDelete={showDeleteConfirm}
            onChangePassword={openPasswordModal}
          />
           <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={filtered.length}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
