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

// 🧠 Funciones base
const list = async () => {
  const config = await getAuthHeader();
  const res = await axios.get(endpoint, config);
  return res.data;
};

const create = async (userData) => {
  const config = await getAuthHeader();
  const res = await axios.post(endpoint, userData, config);
  return res.data;
};

const update = async (id, userData) => {
  const config = await getAuthHeader();
  const res = await axios.put(`${endpoint}/${id}`, userData, config);
  return res.data;
};

const deleteUser = async (id) => {
  const config = await getAuthHeader();
  const res = await axios.delete(`${endpoint}/${id}`, config);
  return res.data;
};

const changePassword = async (email, newPassword) => {
  const config = await getAuthHeader();
  const res = await axios.post(
    `${endpoint}/change-password`,
    { email, new_password: newPassword },
    config
  );
  return res.data;
};

// ✅ Exportación agrupada
export const usersAPI = {
  list,
  create,
  update,
  delete: deleteUser,
  changePassword,
};

// ✅ Exportaciones individuales
export {
  list as getUsers,
  create as createUser,
  update as updateUser,
  deleteUser,
  changePassword as changeUserPassword,
};
