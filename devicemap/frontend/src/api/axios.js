import axios from "axios";
import { clearAuthSession, getToken } from "../utils/auth";

const rawApiBase = import.meta.env.VITE_API_URL;
const apiBase = rawApiBase
  ? rawApiBase.replace(/\/api\/?$/, "")
  : `${window.location.protocol}//${window.location.hostname}:3000`;

const api = axios.create({
  baseURL: apiBase
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      clearAuthSession();
      window.dispatchEvent(new CustomEvent("devicemap:auth-invalid", { detail: { reason: "session_invalid" } }));
    }

    return Promise.reject(error);
  }
);

export default api;