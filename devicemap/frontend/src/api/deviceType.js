import axios from "./axios";

export const getDeviceTypes = async () => {
  return axios.get("/api/device-types");
};

export const getNextDeviceTypeId = async () => {
  return axios.get("/api/device-types/next-id");
};

export const createDeviceType = async (payload) => {
  return axios.post("/api/device-types", payload);
};

export const updateDeviceType = async (id, payload) => {
  return axios.put(`/api/device-types/${id}`, payload);
};

export const deleteDeviceType = async (id) => {
  return axios.delete(`/api/device-types/${id}`);
};
