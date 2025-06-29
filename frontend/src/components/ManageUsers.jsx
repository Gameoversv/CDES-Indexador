import React, { useEffect, useState } from "react";
import { authAPI } from "../services/api";

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "", display_name: "", is_admin: false });

  const loadUsers = async () => {
    try {
      const { data } = await authAPI.listUsers();
      setUsers(data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await authAPI.adminCreateUser(form);
      setForm({ email: "", password: "", display_name: "", is_admin: false });
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.detail || err.message);
    }
  };

  const toggleAdmin = async (uid, isAdmin) => {
    try {
      await authAPI.updateUser(uid, { role: isAdmin ? "user" : "admin" });
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.detail || err.message);
    }
  };

  const handleDelete = async (uid) => {
    if (!confirm("¿Eliminar usuario?")) return;
    try {
      await authAPI.deleteUser(uid);
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.detail || err.message);
    }
  };

  if (loading) return <p>Cargando…</p>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="page admin-users">
      <h2>Gestión de usuarios</h2>

      <form onSubmit={handleCreate} className="user-form">
        <input name="email" value={form.email} onChange={handleChange} placeholder="Correo" required />
        <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Contraseña" required />
        <input name="display_name" value={form.display_name} onChange={handleChange} placeholder="Nombre" />
        <label>
          <input type="checkbox" name="is_admin" checked={form.is_admin} onChange={handleChange} /> Admin
        </label>
        <button type="submit">Crear usuario</button>
      </form>

      <table className="users-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Nombre</th>
            <th>Rol</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.uid}>
              <td>{u.email}</td>
              <td>{u.display_name || ""}</td>
              <td>{u.custom_claims?.admin ? "Admin" : "Usuario"}</td>
              <td>
                <button onClick={() => toggleAdmin(u.uid, u.custom_claims?.admin)}>
                  {u.custom_claims?.admin ? "Quitar admin" : "Hacer admin"}
                </button>
                <button onClick={() => handleDelete(u.uid)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
