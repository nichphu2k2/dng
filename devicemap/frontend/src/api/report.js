import axios from "./axios";

export const getReports = (params) =>
  axios.get("/api/reports", { params });

export const exportReportHistoryExcel = (params) =>
  axios.get("/api/reports/export/excel/history", {
    params,
    responseType: "blob"
  });

export const exportReportDevicesExcel = () =>
  axios.get("/api/reports/export/excel/devices", {
    responseType: "blob"
  });

export const exportReportPlanesExcel = () =>
  axios.get("/api/reports/export/excel/planes", {
    responseType: "blob"
  });

export const exportReportHistoryPdf = (params) =>
  axios.get("/api/reports/export/pdf/history", {
    params,
    responseType: "blob"
  });

export const exportReportDevicesPdf = () =>
  axios.get("/api/reports/export/pdf/devices", {
    responseType: "blob"
  });

export const exportReportPlanesPdf = () =>
  axios.get("/api/reports/export/pdf/planes", {
    responseType: "blob"
  });

export const getReport = (params) =>
  axios.get("/api/reports/alerts", { params });

export const exportExcel = (params) =>
  axios.get("/api/reports/alerts/export/excel", {
    params,
    responseType: "blob"
  });

export const exportPDF = (params) =>
  axios.get("/api/reports/alerts/export/pdf", {
    params,
    responseType: "blob"
  });

export const updateReportProcessState = (reportId, payload) =>
  axios.put(`/api/reports/${reportId}/process`, payload);

export const getActiveAlarms = (params) =>
  axios.get("/api/reports/active-alarms", { params });

export const updateAllActiveReportProcessState = (payload) =>
  axios.put("/api/reports/process-all", payload);