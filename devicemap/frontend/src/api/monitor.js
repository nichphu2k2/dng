import axios from "./axios";

export const getMonitorsByPlane = (planeId) =>
  axios.get(`/api/monitors/plane/${planeId}`);

export const saveMonitorsByPlane = (planeId, placements) =>
  axios.put(`/api/monitors/plane/${planeId}`, { placements });
