const { Op } = require("sequelize");
const sequelize = require("../../config/database");
const Monitor = require("./monitor.model");
const Device = require("../device/device.model");
const Plane = require("../plane/plane.model");

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

const clamp01 = (value) => {
  if (!Number.isFinite(value)) {
    return null;
  }

  if (value < 0 || value > 1) {
    return null;
  }

  return value;
};

const serializeMonitor = (monitor) => {
  const plain = monitor.toJSON ? monitor.toJSON() : monitor;

  return {
    id: plain.id,
    plane_id: plain.plane_id,
    device_id: plain.device_id,
    x: Number(plain.x),
    y: Number(plain.y),
    created_at: plain.created_at,
    updated_at: plain.updated_at
  };
};

const syncDeviceStatusesForAffected = async (deviceIds = [], transaction = undefined) => {
  const normalizedIds = [...new Set(deviceIds.map(normalizeId).filter(Boolean))];
  if (normalizedIds.length === 0) {
    return;
  }

  const rows = await Monitor.findAll({
    attributes: [
      "device_id",
      [sequelize.fn("COUNT", sequelize.col("id")), "placement_count"]
    ],
    where: {
      device_id: {
        [Op.in]: normalizedIds
      }
    },
    group: ["device_id"],
    transaction
  });

  const activeIds = new Set(rows.map((row) => String(row.device_id)));
  const activate = normalizedIds.filter((id) => activeIds.has(id));
  const deactivate = normalizedIds.filter((id) => !activeIds.has(id));

  if (activate.length > 0) {
    await Device.update({ status: 1 }, {
      where: { id: { [Op.in]: activate } },
      transaction
    });
  }

  if (deactivate.length > 0) {
    await Device.update({ status: 0 }, {
      where: { id: { [Op.in]: deactivate } },
      transaction
    });
  }
};

const getByPlane = async (planeId) => {
  const normalizedPlaneId = normalizeId(planeId);
  if (!normalizedPlaneId) {
    throw createServiceError(400, "Invalid plane id");
  }

  const plane = await Plane.findByPk(normalizedPlaneId);
  if (!plane) {
    throw createServiceError(404, "Plane not found");
  }

  const rows = await Monitor.findAll({
    where: { plane_id: normalizedPlaneId },
    order: [["id", "ASC"]]
  });

  return rows.map(serializeMonitor);
};

const saveByPlane = async (planeId, placements = []) => {
  const normalizedPlaneId = normalizeId(planeId);
  if (!normalizedPlaneId) {
    throw createServiceError(400, "Invalid plane id");
  }

  const plane = await Plane.findByPk(normalizedPlaneId);
  if (!plane) {
    throw createServiceError(404, "Plane not found");
  }

  if (!Array.isArray(placements)) {
    throw createServiceError(400, "placements must be an array");
  }

  const normalizedPlacements = [];
  const seen = new Set();

  for (const item of placements) {
    const deviceId = normalizeId(item?.device_id || item?.deviceId);
    const x = clamp01(Number(item?.x));
    const y = clamp01(Number(item?.y));

    if (!deviceId) {
      throw createServiceError(400, "Invalid device id in placements");
    }

    if (x === null || y === null) {
      throw createServiceError(400, "Placement coordinates must be between 0 and 1");
    }

    const uniqueKey = `${normalizedPlaneId}:${deviceId}`;
    if (seen.has(uniqueKey)) {
      throw createServiceError(409, `Duplicate device ${deviceId} for this plane`);
    }

    seen.add(uniqueKey);
    normalizedPlacements.push({
      plane_id: normalizedPlaneId,
      device_id: deviceId,
      x,
      y
    });
  }

  const placementDeviceIds = [...new Set(normalizedPlacements.map((item) => item.device_id))];
  if (placementDeviceIds.length > 0) {
    const existingDevices = await Device.findAll({
      where: {
        id: {
          [Op.in]: placementDeviceIds
        }
      },
      attributes: ["id"]
    });

    const existingSet = new Set(existingDevices.map((row) => String(row.id)));
    const invalidDevice = placementDeviceIds.find((item) => !existingSet.has(item));
    if (invalidDevice) {
      throw createServiceError(404, `Device ${invalidDevice} not found`);
    }
  }

  const transaction = await sequelize.transaction();

  try {
    const existingRows = await Monitor.findAll({
      where: { plane_id: normalizedPlaneId },
      attributes: ["device_id"],
      transaction
    });

    const previousDeviceIds = existingRows.map((row) => String(row.device_id));

    await Monitor.destroy({
      where: { plane_id: normalizedPlaneId },
      transaction
    });

    if (normalizedPlacements.length > 0) {
      await Monitor.bulkCreate(normalizedPlacements, { transaction });
    }

    const affectedIds = [...new Set([...previousDeviceIds, ...placementDeviceIds])];
    await syncDeviceStatusesForAffected(affectedIds, transaction);

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    if (err.status) {
      throw err;
    }

    if (err?.name === "SequelizeUniqueConstraintError") {
      throw createServiceError(409, "Each device can appear only once per monitor image");
    }

    throw createServiceError(500, err.message || "Failed to save monitor placements");
  }

  return getByPlane(normalizedPlaneId);
};

const clearByPlane = async (planeId, transaction = undefined) => {
  const normalizedPlaneId = normalizeId(planeId);
  if (!normalizedPlaneId) {
    throw createServiceError(400, "Invalid plane id");
  }

  const rows = await Monitor.findAll({
    where: { plane_id: normalizedPlaneId },
    attributes: ["device_id"],
    transaction
  });

  const affectedDeviceIds = [...new Set(rows.map((row) => String(row.device_id)))];

  await Monitor.destroy({
    where: { plane_id: normalizedPlaneId },
    transaction
  });

  await syncDeviceStatusesForAffected(affectedDeviceIds, transaction);
};

module.exports = {
  getByPlane,
  saveByPlane,
  clearByPlane,
  syncDeviceStatusesForAffected
};
