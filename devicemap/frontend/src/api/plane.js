import axios from "./axios";

export const getPlanes = () => axios.get("/api/planes");

export const getNextPlaneId = () => axios.get("/api/planes/next-id");

export const createPlane = ({ name, description, image, type, parentId }) => {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("description", description || "");
  formData.append("type", type);

  if (parentId) {
    formData.append("parent_id", parentId);
  }

  if (image) {
    formData.append("image", image);
  }

  return axios.post("/api/planes", formData);
};

export const updatePlane = (id, { name, description, image, parentId, removeImage }) => {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("description", description || "");

  if (parentId) {
    formData.append("parent_id", parentId);
  }

  if (removeImage) {
    formData.append("remove_image", "true");
  }

  if (image) {
    formData.append("image", image);
  }

  return axios.put(`/api/planes/${id}`, formData);
};

export const deletePlane = (id) => axios.delete(`/api/planes/${id}`);
