import axios from "./axios";

const toFormData = (data = {}) => {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (key === "avatar" && value instanceof File) {
      formData.append("avatar", value);
      return;
    }

    formData.append(key, String(value));
  });

  return formData;
};

export const getUsers = (params) => axios.get("/api/users", { params });
export const getUser = (id) => axios.get(`/api/users/${id}`);
export const createUser = (payload) => axios.post("/api/users", toFormData(payload));
export const updateUser = (id, payload) => axios.put(`/api/users/${id}`, toFormData(payload));
export const deleteUser = (id) => axios.delete(`/api/users/${id}`);
