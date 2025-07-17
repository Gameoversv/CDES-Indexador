import { api } from "./api";

export const authAPI = {
  register: (email, password) => api.post("/auth/register", { email, password }),
  getCurrentUser: () => api.get("/auth/me"),
  testAdminRoute: () => api.get("/auth/admin-only-test"),
};
