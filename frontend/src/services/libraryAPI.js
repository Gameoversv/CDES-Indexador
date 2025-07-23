// src/services/api.js

import axios from "./axiosInstance";

export const libraryAPI = {
  list: async () => {
    const res = await axios.get("/library/public");
    return res.data;
  },
  upload: async (file, metadata) => {
    const formData = new FormData();
    formData.append("file", file);
    Object.entries(metadata).forEach(([key, value]) =>
      formData.append(key, value)
    );
    const res = await axios.post("/library/upload", formData);
    return res.data;
  },
  delete: async (path) => {
    const res = await axios.delete(`/library/delete`, { data: { path } });
    return res.data;
  },
};
