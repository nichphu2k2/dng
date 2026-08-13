import axios from "./axios";

export const login = (payload) => axios.post("/api/auth/login", payload);

export const changePassword = (payload) => axios.put("/api/auth/change-password", payload);

export const logout = () => axios.post("/api/auth/logout");
