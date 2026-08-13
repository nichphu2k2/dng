import axios from "./axios";

export const getDashboard = (params) =>
  axios.get("/api/dashboard", { params });

export const exportDashboardPdf = (params) =>
  axios.get("/api/dashboard/export/pdf", {
    params,
    responseType: "blob"
  });
