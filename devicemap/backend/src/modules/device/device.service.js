const Device = require("./device.model");
const DeviceType = require("../device-type/device-type.model");
const socket = require("../../config/socket");
const { Op } = require("sequelize");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const mediaMtxService = require("../../services/mediaMtx.service");

const DEVICE_ICON_DIR = process.env.DEVICE_ICON_DIR || "/app/image/icon";

if (!fs.existsSync(DEVICE_ICON_DIR)) {
  fs.mkdirSync(DEVICE_ICON_DIR, { recursive: true });
}

const createServiceError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeId = (value) => {
  const number = Number(String(value || "").trim());
  if (!Number.isInteger(number) || number < 1 || number > 99999) {
    return null;
  }

  return String(number).padStart(5, "0");
};

const normalizeInteger = (value, defaultValue = 0) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const number = Number(value);
  if (!Number.isInteger(number)) {
    return defaultValue;
  }

  return number;
};

const normalizeBoolean = (value) => {
  return [true, "true", 1, "1", "on"].includes(value);
};

const parseOrderedIdList = (value) => {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
};

const tokenizeCommand = (command) => {
  return String(command || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
};

const parseMbpollArgs = (command) => {
  const normalizedCommand = String(command || "").trim();
  if (!normalizedCommand) {
    throw createServiceError(400, "modbus command is empty");
  }

  if (/\r|\n|;|\||&|`|\$|>|</.test(normalizedCommand)) {
    throw createServiceError(400, "modbus command contains invalid characters");
  }

  const tokens = tokenizeCommand(normalizedCommand);
  if (tokens.length === 0 || tokens[0] !== "mbpoll") {
    throw createServiceError(400, "only mbpoll command is allowed");
  }

  const safeTokenPattern = /^[a-zA-Z0-9._:/%+\-=]+$/;
  for (const token of tokens) {
    if (!safeTokenPattern.test(token)) {
      throw createServiceError(400, "modbus command contains unsupported token");
    }
  }

  return tokens.slice(1);
};

const executeMbpoll = (args) => {
  return new Promise((resolve, reject) => {
    execFile("mbpoll", args, {
      timeout: 30000,
      maxBuffer: 1024 * 1024
    }, (error, stdout, stderr) => {
      if (error) {
        console.error("mbpoll error:", {
          message: error.message,
          stdout,
          stderr
        });

        reject({
          status: 500,
          message: stderr || "Không thể thực thi Modbus"
        });

        return;
      }

      resolve({ stdout, stderr });
    });
  });
};

const getExtensionFromFile = (file) => {
  const mimeToExt = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/svg+xml": ".svg"
  };

  if (mimeToExt[file.mimetype]) {
    return mimeToExt[file.mimetype];
  }

  const ext = path.extname(file.originalname || "");
  return ext || ".png";
};

const removeDeviceIconFiles = (deviceId, slot) => {
  const escapedId = deviceId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const slotPattern = slot ? `_${slot}` : "_[12]";
  const matcher = new RegExp(`^${escapedId}${slotPattern}\\.(jpg|jpeg|png|svg)$`, "i");

  const files = fs.readdirSync(DEVICE_ICON_DIR);
  files.forEach((fileName) => {
    if (matcher.test(fileName)) {
      fs.unlinkSync(path.join(DEVICE_ICON_DIR, fileName));
    }
  });
};

const saveDeviceIconFile = (deviceId, slot, file) => {
  if (!file) {
    return null;
  }

  const ext = getExtensionFromFile(file).toLowerCase();
  const fileName = `${deviceId}_${slot}${ext}`;
  const filePath = path.join(DEVICE_ICON_DIR, fileName);

  removeDeviceIconFiles(deviceId, slot);
  fs.writeFileSync(filePath, file.buffer);

  return `/image/icon/${fileName}`;
};

const getNextId = async () => {
  const rows = await Device.findAll({ attributes: ["id"] });
  const used = new Set(
    rows
      .map((row) => normalizeId(row.id))
      .filter(Boolean)
      .map((id) => Number(id))
  );

  for (let number = 1; number <= 99999; number += 1) {
    if (!used.has(number)) {
      return String(number).padStart(5, "0");
    }
  }

  throw createServiceError(409, "No available device id in range 00001-99999");
};

const getSmallestAvailableGroup = async (field, excludeValues = []) => {
  const rows = await Device.findAll({
    attributes: [field],
    where: {
      [field]: { [Op.gt]: 0, [Op.notIn]: excludeValues }
    }
  });

  const used = new Set(rows.map((row) => Number(row[field])).filter((value) => Number.isInteger(value) && value > 0));

  for (let number = 1; number <= 999; number += 1) {
    if (!used.has(number)) {
      return number;
    }
  }

  throw createServiceError(409, `No available ${field} group in range 1-999`);
};

const getDeviceTypeMapByIds = async (typeIds = []) => {
  const uniqueIds = [...new Set(typeIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const rows = await DeviceType.findAll({ where: { id: uniqueIds } });
  return new Map(rows.map((row) => [String(row.id), row]));
};

const serializeDevice = (device, typeMap = new Map()) => {
  if (!device) return null;

  const plain = device.toJSON ? device.toJSON() : device;
  const deviceType = typeMap.get(String(plain.device_type_id));
  const normalizedType = String(deviceType?.type || "Camera").toLowerCase();

  return {
    id: plain.id,
    code: plain.id,
    device_code: plain.id,
    name: plain.name,
    device_type_id: plain.device_type_id,
    device_type_name: plain.device_type_name,
    device_type: normalizedType,
    type: normalizedType,
    status: plain.status,
    rtsp1: plain.rtsp1,
    rtsp1_status: plain.rtsp1_status,
    rtsp2: plain.rtsp2,
    rtsp2_status: plain.rtsp2_status,
    modbus: plain.modbus,
    pair: plain.pair,
    pair_id: plain.pair_id,
    link: plain.link,
    icon1: plain.icon1,
    icon2: plain.icon2,
    description: plain.description || "",
    metadata: { description: plain.description || "" },
    created_at: plain.created_at,
    updated_at: plain.updated_at
  };
};

const collectValidDeviceIds = async (orderedIds = []) => {
  const normalizedOrderedIds = orderedIds
    .map((item) => normalizeId(item))
    .filter(Boolean);

  const uniqueOrderedIds = [];
  for (const id of normalizedOrderedIds) {
    if (!uniqueOrderedIds.includes(id)) {
      uniqueOrderedIds.push(id);
    }
  }

  if (uniqueOrderedIds.length === 0) {
    return [];
  }

  const rows = await Device.findAll({ where: { id: uniqueOrderedIds } });
  const existing = new Set(rows.map((row) => String(row.id)));

  return uniqueOrderedIds.filter((id) => existing.has(id));
};

const applyPairGroup = async (currentDeviceId, isSensor, pairEnabled, orderedPairDeviceIds = []) => {
  const currentDevice = await Device.findByPk(currentDeviceId);
  if (!currentDevice) {
    return;
  }

  const currentPair = Number(currentDevice.pair || 0);
  const impactedPairValues = new Set();
  if (currentPair > 0) {
    impactedPairValues.add(currentPair);
  }

  if (!isSensor || !pairEnabled) {
    if (impactedPairValues.size > 0) {
      await Device.update({ pair: 0, pair_id: 0 }, {
        where: { pair: { [Op.in]: [...impactedPairValues] } }
      });
    }
    await Device.update({ pair: 0, pair_id: 0 }, { where: { id: currentDeviceId } });
    return;
  }

  const candidateIds = await collectValidDeviceIds(orderedPairDeviceIds);
  const candidateDevices = await Device.findAll({ where: { id: candidateIds } });
  const typeMap = await getDeviceTypeMapByIds(candidateDevices.map((item) => item.device_type_id));

  const validPairIds = [];
  for (const id of candidateIds) {
    const row = candidateDevices.find((item) => String(item.id) === id);
    if (!row) continue;
    const typeRow = typeMap.get(String(row.device_type_id));
    if (String(typeRow?.type || "").toLowerCase() === "sensor") {
      validPairIds.push(id);
      const pairValue = Number(row.pair || 0);
      if (pairValue > 0) {
        impactedPairValues.add(pairValue);
      }
    }
  }

  if (impactedPairValues.size > 0) {
    await Device.update({ pair: 0, pair_id: 0 }, {
      where: { pair: { [Op.in]: [...impactedPairValues] } }
    });
  }

  const pairValue = await getSmallestAvailableGroup("pair");
  const orderedGroupIds = [currentDeviceId, ...validPairIds.filter((id) => id !== currentDeviceId)];

  for (let index = 0; index < orderedGroupIds.length; index += 1) {
    await Device.update({
      pair: pairValue,
      pair_id: index + 1
    }, {
      where: { id: orderedGroupIds[index] }
    });
  }
};

const applyLinkGroup = async (currentDeviceId, linkEnabled, orderedLinkedDeviceIds = []) => {
  const currentDevice = await Device.findByPk(currentDeviceId);
  if (!currentDevice) {
    return;
  }

  const impactedLinkValues = new Set();
  const currentLink = Number(currentDevice.link || 0);
  if (currentLink > 0) {
    impactedLinkValues.add(currentLink);
  }

  const validLinkedIds = await collectValidDeviceIds(orderedLinkedDeviceIds);
  const linkedRows = await Device.findAll({ where: { id: validLinkedIds } });
  linkedRows.forEach((row) => {
    const linkValue = Number(row.link || 0);
    if (linkValue > 0) {
      impactedLinkValues.add(linkValue);
    }
  });

  if (impactedLinkValues.size > 0) {
    await Device.update({ link: 0 }, {
      where: { link: { [Op.in]: [...impactedLinkValues] } }
    });
  }

  if (!linkEnabled) {
    await Device.update({ link: 0 }, { where: { id: currentDeviceId } });
    return;
  }

  const linkValue = await getSmallestAvailableGroup("link");
  const orderedGroupIds = [currentDeviceId, ...validLinkedIds.filter((id) => id !== currentDeviceId)];
  await Device.update({ link: linkValue }, { where: { id: { [Op.in]: orderedGroupIds } } });
};

/**
 * GET ALL DEVICES
 */
const getAll = async (query) => {
  try {
    const where = {};

    if (query && query.search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${query.search}%` } },
        { id: { [Op.like]: `%${query.search}%` } },
        { device_type_name: { [Op.like]: `%${query.search}%` } },
        { description: { [Op.like]: `%${query.search}%` } }
      ];
    }

    const devices = await Device.findAll({
      where,
      order: [["id", "ASC"]],
    });
    const typeMap = await getDeviceTypeMapByIds(devices.map((item) => item.device_type_id));
    return devices.map((device) => serializeDevice(device, typeMap));
  } catch (err) {
    console.error("Device.getAll() Error:", err.message);
    throw new Error(`Failed to fetch devices: ${err.message}`);
  }
};

/**
 * GET BY ID
 */
const getById = async (id) => {
  try {
    const normalizedId = normalizeId(id);
    if (!normalizedId) {
      throw createServiceError(400, "Invalid device id");
    }

    const device = await Device.findByPk(normalizedId);
    if (!device) {
      return null;
    }

    const typeMap = await getDeviceTypeMapByIds([device.device_type_id]);
    return serializeDevice(device, typeMap);
  } catch (err) {
    console.error("Device.getById() Error:", err.message);
    throw new Error(`Failed to fetch device: ${err.message}`);
  }
};

/**
 * CREATE
 */
const create = async (data) => {
  try {
    const payload = data?.data || {};
    const files = Array.isArray(data?.files) ? data.files : [];

    const name = String(payload.name || "").trim();
    if (!name) {
      throw createServiceError(400, "name is required");
    }

    const normalizedDeviceTypeId = normalizeId(payload.device_type_id || payload.deviceTypeId);
    if (!normalizedDeviceTypeId) {
      throw createServiceError(400, "device_type_id is required");
    }

    const deviceType = await DeviceType.findByPk(normalizedDeviceTypeId);
    if (!deviceType) {
      throw createServiceError(404, "Device type not found");
    }

    const nextId = await getNextId();
    const icon1 = files[0] ? saveDeviceIconFile(nextId, 1, files[0]) : null;
    const icon2 = files[1] ? saveDeviceIconFile(nextId, 2, files[1]) : null;

    const isSensor = String(deviceType.type).toLowerCase() === "sensor";
    const isCamera = String(deviceType.type).toLowerCase() === "camera";

    const created = await Device.create({
      id: nextId,
      name,
      device_type_id: normalizedDeviceTypeId,
      device_type_name: deviceType.name,
      status: 0,
      rtsp1: isCamera ? (payload.rtsp1 || null) : null,
      rtsp2: isCamera ? (payload.rtsp2 || null) : null,
      modbus: isSensor ? (payload.modbus || null) : null,
      pair: 0,
      pair_id: 0,
      link: 0,
      icon1,
      icon2,
      description: payload.description || ""
    });

    const pairEnabled = normalizeBoolean(payload.pair_enabled);
    const linkEnabled = normalizeBoolean(payload.link_enabled);
    const orderedPairDeviceIds = parseOrderedIdList(payload.pair_device_ids);
    const orderedLinkedDeviceIds = parseOrderedIdList(payload.link_device_ids);

    await applyPairGroup(created.id, isSensor, pairEnabled, orderedPairDeviceIds);
    await applyLinkGroup(created.id, linkEnabled, orderedLinkedDeviceIds);

    const refreshed = await Device.findByPk(created.id);

    if (isCamera) {
      try {
        await mediaMtxService.addCameraStream(refreshed);
      } catch (streamErr) {
        console.warn(`Camera ${created.id} stream add failed:`, streamErr.message);
      }
    }

    const typeMap = await getDeviceTypeMapByIds([refreshed.device_type_id]);
    return serializeDevice(refreshed, typeMap);
  } catch (err) {
    console.error("Device.create() Error:", err.message);
    throw new Error(err.message || `Failed to create device: ${err.message}`);
  }
};

/**
 * UPDATE + SOCKET EMIT
 */
const update = async (id, payloadWrapper) => {
  try {
    const normalizedId = normalizeId(id);
    if (!normalizedId) {
      throw createServiceError(400, "Invalid device id");
    }

    const payload = payloadWrapper?.data || {};
    const files = Array.isArray(payloadWrapper?.files) ? payloadWrapper.files : [];

    const current = await Device.findByPk(normalizedId);
    if (!current) {
      throw createServiceError(404, "Device not found");
    }

    const nextName = payload.name === undefined ? current.name : String(payload.name || "").trim();
    if (!nextName) {
      throw createServiceError(400, "name is required");
    }

    const nextTypeId = payload.device_type_id || payload.deviceTypeId || current.device_type_id;
    const normalizedTypeId = normalizeId(nextTypeId);
    if (!normalizedTypeId) {
      throw createServiceError(400, "device_type_id is required");
    }

    const deviceType = await DeviceType.findByPk(normalizedTypeId);
    if (!deviceType) {
      throw createServiceError(404, "Device type not found");
    }

    const isSensor = String(deviceType.type).toLowerCase() === "sensor";
    const isCamera = String(deviceType.type).toLowerCase() === "camera";
    const currentType = await DeviceType.findByPk(current.device_type_id);
    const currentIsSensor = String(currentType?.type || "").toLowerCase() === "sensor";
    const currentIsCamera = String(currentType?.type || "").toLowerCase() === "camera";

    const updatePayload = {
      name: nextName,
      device_type_id: normalizedTypeId,
      device_type_name: deviceType.name,
      status: current.status,
      rtsp1: isCamera ? (payload.rtsp1 ?? current.rtsp1 ?? null) : null,
      rtsp2: isCamera ? (payload.rtsp2 ?? current.rtsp2 ?? null) : null,
      modbus: isSensor ? (payload.modbus ?? current.modbus ?? null) : null,
      description: payload.description === undefined ? current.description : (payload.description || "")
    };

    if (normalizeBoolean(payload.remove_icon1)) {
      removeDeviceIconFiles(normalizedId, 1);
      updatePayload.icon1 = null;
    }

    if (normalizeBoolean(payload.remove_icon2)) {
      removeDeviceIconFiles(normalizedId, 2);
      updatePayload.icon2 = null;
    }

    if (files[0]) {
      updatePayload.icon1 = saveDeviceIconFile(normalizedId, 1, files[0]);
    }

    if (files[1]) {
      updatePayload.icon2 = saveDeviceIconFile(normalizedId, 2, files[1]);
    }

    await Device.update(updatePayload, { where: { id: normalizedId } });

    const hasPairConfig =
      payload.pair_enabled !== undefined ||
      payload.pair_device_ids !== undefined ||
      (currentIsSensor && !isSensor);
    const hasLinkConfig = payload.link_enabled !== undefined || payload.link_device_ids !== undefined;

    if (hasPairConfig) {
      const pairEnabled = normalizeBoolean(payload.pair_enabled);
      const orderedPairDeviceIds = parseOrderedIdList(payload.pair_device_ids);
      await applyPairGroup(normalizedId, isSensor, pairEnabled, orderedPairDeviceIds);
    }

    if (hasLinkConfig) {
      const linkEnabled = normalizeBoolean(payload.link_enabled);
      const orderedLinkedDeviceIds = parseOrderedIdList(payload.link_device_ids);
      await applyLinkGroup(normalizedId, linkEnabled, orderedLinkedDeviceIds);
    }

    const updated = await Device.findByPk(normalizedId);

    if (currentIsCamera) {
      try {
        await mediaMtxService.removeCameraStreams(normalizedId);
      } catch (removeErr) {
        console.warn(`Camera ${normalizedId} stream delete failed:`, removeErr.message);
      }
    }

    if (isCamera) {
      try {
        await mediaMtxService.addCameraStream(updated);
      } catch (streamErr) {
        console.warn(`Camera ${normalizedId} stream add failed:`, streamErr.message);
      }
    }

    socket.emitSensorMove(updated);

    const typeMap = await getDeviceTypeMapByIds([updated.device_type_id]);
    return serializeDevice(updated, typeMap);
  } catch (err) {
    console.error("Device.update() Error:", err.message);
    throw new Error(err.message || `Failed to update device: ${err.message}`);
  }
};

/**
 * DELETE
 */
const remove = async (id) => {
  try {
    const normalizedId = normalizeId(id);
    if (!normalizedId) {
      throw createServiceError(400, "Invalid device id");
    }

    removeDeviceIconFiles(normalizedId);
    return await Device.destroy({ where: { id: normalizedId } });
  } catch (err) {
    console.error("Device.remove() Error:", err.message);
    throw new Error(`Failed to delete device: ${err.message}`);
  }
};

const turnOff = async (id) => {
  const normalizedId = normalizeId(id);
  if (!normalizedId) {
    throw createServiceError(400, "Invalid device id");
  }

  const device = await Device.findByPk(normalizedId, {
    attributes: ["id", "modbus"]
  });

  if (!device) {
    throw createServiceError(404, "Device not found");
  }

  const modbusCommand = String(device.modbus || "").trim();
  if (!modbusCommand) {
    throw createServiceError(400, "Device modbus command is empty");
  }

  const args = parseMbpollArgs(modbusCommand);

  try {
    const result = await executeMbpoll(args);
    const output = [result.stdout, result.stderr]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join("\n");

    return {
      output
    };
  } catch (err) {
    const errorOutput = [err.stderr, err.stdout, err.message]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join("\n");

    throw createServiceError(500, errorOutput || "Failed to execute mbpoll command");
  }
};

/**
 * GRAPH TRAVERSAL (BFS)
 */
const getAffectedDevices = async (deviceId) => {
  const visited = new Set();
  const queue = [deviceId];
  const result = [];

  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current)) continue;

    visited.add(current);
    result.push(current);

    const relations = await DeviceRelation.findAll({
      where: { parent_device_id: current },
    });

    for (const r of relations) {
      if (!visited.has(r.child_device_id)) {
        queue.push(r.child_device_id);
      }
    }
  }

  return result;
};

/**
 * GET SENSOR LINKS AFFECTED
 */
const getAffectedLines = async (deviceIds) => {
  return await SensorLink.findAll({
    where: {
      device_id: deviceIds
    },
  });
};

/**
 * MAIN ALERT ENGINE
 */
const getByCodeAndTriggerAlert = async (deviceCode) => {
  const normalizedCode = normalizeId(deviceCode) || String(deviceCode || "").trim();
  const device = await Device.findOne({
    where: { id: normalizedCode },
  });

  if (!device) {
    throw new Error("Device not found");
  }

  const serializedDevice = serializeDevice(device);
  const deviceId = serializedDevice.id;

  const affectedDevices = await getAffectedDevices(deviceId);
  const affectedLines = await getAffectedLines(affectedDevices);

  const payload = {
    deviceId: device.id,
    deviceCode: device.id,
    affectedDevices,
    affectedLines,
    description: "DEVICE ALERT TRIGGERED",
    time: new Date().toISOString(),
  };

  const io = socket.getIO();
  if (io) {
    io.emit("device_alert", payload);
  }

  return payload;
};

module.exports = {
  getAll,
  getNextId,
  getById,
  turnOff,
  create,
  update,
  remove,
  getByCodeAndTriggerAlert,
  getAffectedDevices,
  getAffectedLines,
  saveDeviceIconFile,
};