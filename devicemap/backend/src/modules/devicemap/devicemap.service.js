const Device = require("../device/device.model");
const DeviceType = require("../device-type/device-type.model");
const Plane = require("../plane/plane.model");
const Report = require("../report/report.model");
const socket = require("../../config/socket");
const { buildAlarmTargets } = require("./alarm-targets.util");

const createServiceError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeFiveDigitId = (value, min = 1) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const number = Number(raw);
  if (!Number.isInteger(number) || number < min || number > 99999) {
    return null;
  }

  return String(number).padStart(5, "0");
};

const formatTimestamp = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}_${hour}${minute}${second}`;
};

const parseRequestPayload = (input = {}) => {
  const rawDeviceId = input.device_id;
  const rawPlaneId = input.plane_id;

  if (rawDeviceId === undefined || rawDeviceId === null || String(rawDeviceId).trim() === "") {
    throw createServiceError(400, "device_id is required");
  }

  if (rawPlaneId === undefined || rawPlaneId === null || String(rawPlaneId).trim() === "") {
    throw createServiceError(400, "plane_id is required");
  }

  const normalizedDeviceId = normalizeFiveDigitId(rawDeviceId, 1);
  if (!normalizedDeviceId) {
    throw createServiceError(400, "device_id is invalid");
  }

  const normalizedPlaneId = normalizeFiveDigitId(rawPlaneId, 0);
  if (!normalizedPlaneId) {
    throw createServiceError(400, "plane_id is invalid");
  }

  return {
    device_id: normalizedDeviceId,
    plane_id: normalizedPlaneId
  };
};

const findDeviceAndPlane = async ({ device_id, plane_id }) => {
  const device = await Device.findByPk(device_id, {
    include: [
      {
        model: DeviceType,
        attributes: ["id", "name", "type"]
      }
    ]
  });

  if (!device) {
    throw createServiceError(404, "Device not found");
  }

  const plane = await Plane.findByPk(plane_id);
  if (!plane) {
    throw createServiceError(404, "Plane not found");
  }

  return { device, plane };
};

const serializeDevice = (device) => {
  const plain = device.toJSON ? device.toJSON() : device;
  return {
    id: plain.id,
    name: plain.name,
    device_type_id: plain.device_type_id,
    device_type_name: plain.device_type_name,
    type: plain.DeviceType?.type || null,
    status: plain.status,
    pair: plain.pair,
    pair_id: plain.pair_id,
    link: plain.link,
    description: plain.description || ""
  };
};

const serializePlane = (plane) => {
  const plain = plane.toJSON ? plane.toJSON() : plane;
  return {
    id: plain.id,
    name: plain.name,
    type: plain.type,
    parent_id: plain.parent_id,
    image: plain.image,
    description: plain.description || ""
  };
};

const getInfo = async (input) => {
  const payload = parseRequestPayload(input);
  const { device, plane } = await findDeviceAndPlane(payload);

  return {
    success: true,
    device: serializeDevice(device),
    plane: serializePlane(plane)
  };
};

const postAlarm = async (input) => {
  const payload = parseRequestPayload(input);
  const { device, plane } = await findDeviceAndPlane(payload);
  const timeStart = formatTimestamp();

  const report = await Report.create({
    time_start: timeStart,
    time_end: timeStart,
    device_id: payload.device_id,
    device_name: device.name || "",
    plane_id: payload.plane_id,
    plane_name: plane.name || "",
    state: 0,
    user_id: null,
    user_full_name: null,
    username: null,
    description: ""
  });

  const realtime = await buildAlarmTargets(device, payload.plane_id);

  const eventPayload = {
    id: report.id,
    report_id: report.id,
    type: "external_alarm",
    created_at: new Date().toISOString(),
    status: "PENDING",
    device_id: payload.device_id,
    device_name: device.name,
    plane_id: payload.plane_id,
    plane_name: plane.name,
    incoming_device_type: realtime.incoming_device_type,
    flash_device_ids: realtime.flash_device_ids,
    pair_sensor_ids: realtime.pair_sensor_ids,
    message: `${payload.device_id} | ${device.name}\n${payload.plane_id} | ${plane.name}`
  };

  const io = socket.getIO();
  if (io) {
    io.emit("device_alert", eventPayload);
  }

  return {
    success: true,
    report_id: report.id,
    device: serializeDevice(device),
    plane: serializePlane(plane)
  };
};

module.exports = {
  getInfo,
  postAlarm
};
