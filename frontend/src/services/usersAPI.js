import axios from "@/components/utils/axios";
import { getAuth } from "firebase/auth";

// 🔐 Función para obtener token actual y añadirlo como header
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

const endpoint = "/admin/users";

export const usersAPI = {
  // 📥 Obtener lista de usuarios
  list: async () => {
    const config = await getAuthHeader();
    const res = await axios.get(endpoint, config);
    return res.data;
  },

  // ➕ Crear nuevo usuario
  create: async (userData) => {
    const config = await getAuthHeader();
    const res = await axios.post(endpoint, userData, config);
    return res.data;
  },

  // ✏️ Actualizar usuario existente
  update: async (id, userData) => {
    const config = await getAuthHeader();
    const res = await axios.put(`${endpoint}/${id}`, userData, config);
    return res.data;
  },

  // ❌ Eliminar usuario
  delete: async (id) => {
    const config = await getAuthHeader();
    const res = await axios.delete(`${endpoint}/${id}`, config);
    return res.data;
  },

  // 🔒 Cambiar contraseña de usuario
  changePassword: async (email, newPassword) => {
    const config = await getAuthHeader();
    const res = await axios.post(
      `${endpoint}/change-password`,
      { email, new_password: newPassword },
      config
    );
    return res.data;
  },
};
