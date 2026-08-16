import axios from "./axios";

export const getLineParameters = () =>
  axios.get("/api/settings/line-parameters");

export const updateLineParameters = (payload) =>
  axios.put("/api/settings/line-parameters", payload);

export const getNetworkOptixSettings = () =>
  axios.get("/api/settings/nx");

export const updateNetworkOptixSettings = (payload) =>
  axios.put("/api/settings/nx", payload);

export const getAlertSetup = () =>
  axios.get("/api/settings/alert-setup");

export const updateAlertSetup = (payload) =>
  axios.put("/api/settings/alert-setup", payload);

export const refreshRtsp = () =>
  axios.post("/api/settings/refresh-rtsp");
