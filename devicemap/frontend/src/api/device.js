import axios from "./axios";

const toFormData = (data = {}) => {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    if (key === "icons" && Array.isArray(value)) {
      value.forEach((file) => {
        if (file instanceof File) {
          formData.append("icons", file);
        }
      });
      return;
    }

    if (Array.isArray(value) || typeof value === "object") {
      formData.append(key, JSON.stringify(value));
      return;
    }

    formData.append(key, String(value));
  });

  return formData;
};

// GET DEVICES (support filter/query)
export const getDevices = (params) =>
  axios.get("/api/devices", { params });

// GET NEXT DEVICE ID
export const getNextDeviceId = () =>
  axios.get("/api/devices/next-id");

// GET DEVICE BY ID
export const getDevice = (id) =>
  axios.get(`/api/devices/${id}`);

// CREATE DEVICE
export const createDevice = (data) =>
  axios.post("/api/devices", toFormData(data));

// UPDATE DEVICE INFO
export const updateDevice = (id, data) =>
  axios.put(`/api/devices/${id}`, toFormData(data));

// DELETE DEVICE
export const deleteDevice = (id) =>
  axios.delete(`/api/devices/${id}`);

// TURN OFF SENSOR DEVICE VIA MODBUS COMMAND ON BACKEND
export const turnOffDevice = (id) =>
  axios.post(`/api/devices/${id}/off`);
