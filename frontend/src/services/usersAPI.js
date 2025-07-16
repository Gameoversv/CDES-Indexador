import axios from "@/lib/axios";
import { getAuth } from "firebase/auth";

// 🔐 Función para obtener token actual
const getAuthHeader = async () => {
  const currentUser = getAuth().currentUser;
  if (!currentUser) throw new Error("No autenticado");
  const token = await currentUser.getIdToken();
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

// 📥 Obtener lista de usuarios
export const getUsers = async () => {
  const config = await getAuthHeader();
  const res = await axios.get("/admin/users", config);
  return res.data;
};

// ➕ Crear nuevo usuario
export const createUser = async (userData) => {
  const config = await getAuthHeader();
  const res = await axios.post("/admin/users", userData, config);
  return res.data;
};

// ✏️ Actualizar usuario existente
export const updateUser = async (id, userData) => {
  const config = await getAuthHeader();
  const res = await axios.put(`/admin/users/${id}`, userData, config);
  return res.data;
};

// ❌ Eliminar usuario
export const deleteUser = async (id) => {
  const config = await getAuthHeader();
  const res = await axios.delete(`/admin/users/${id}`, config);
  return res.data;
};

// 🔒 Cambiar contraseña de usuario
export const changeUserPassword = async (email, new_password) => {
  const config = await getAuthHeader();
  const res = await axios.post(
    "/admin/users/change-password",
    { email, new_password },
    config
  );
  return res.data;
};
