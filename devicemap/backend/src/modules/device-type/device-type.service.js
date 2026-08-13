const { Op } = require("sequelize");
const DeviceType = require("./device-type.model");
const Device = require("../device/device.model");

const VALID_TYPES = ["Camera", "Sensor"];

const createServiceError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeType = (type) => {
  if (String(type || "").toLowerCase() === "sensor") {
    return "Sensor";
  }

  return "Camera";
};

const normalizeId = (value) => {
  const number = Number(String(value || "").trim());
  if (!Number.isInteger(number) || number < 1 || number > 99999) {
    return null;
  }

  return String(number).padStart(5, "0");
};

const getNextDeviceTypeId = async () => {
  const existing = await DeviceType.findAll({ attributes: ["id"] });
  const used = new Set(
    existing
      .map((row) => normalizeId(row.id))
      .filter(Boolean)
      .map((id) => Number(id))
  );

  for (let number = 1; number <= 99999; number += 1) {
    if (!used.has(number)) {
      return String(number).padStart(5, "0");
    }
  }

  throw createServiceError(409, "No available device type id in range 00001-99999");
};

const serialize = (item) => {
  if (!item) return null;
  const plain = item.toJSON ? item.toJSON() : item;

  return {
    id: plain.id,
    name: plain.name,
    type: plain.type,
    description: plain.description || ""
  };
};

const getAll = async (query) => {
  const where = {};

  if (query?.search) {
    where[Op.or] = [
      { id: { [Op.like]: `%${query.search}%` } },
      { name: { [Op.like]: `%${query.search}%` } },
      { type: { [Op.like]: `%${query.search}%` } }
    ];
  }

  const rows = await DeviceType.findAll({
    where,
    order: [["id", "ASC"]]
  });

  return rows.map(serialize);
};

const create = async (payload) => {
  const name = String(payload?.name || "").trim();
  if (!name) {
    throw createServiceError(400, "name is required");
  }

  const typeRaw = payload?.type;
  if (!typeRaw) {
    throw createServiceError(400, "type is required");
  }

  const type = normalizeType(typeRaw);
  if (!VALID_TYPES.includes(type)) {
    throw createServiceError(400, "type must be Camera or Sensor");
  }

  const duplicate = await DeviceType.findOne({
    where: {
      name,
      type
    }
  });

  if (duplicate) {
    throw createServiceError(409, "Device type already exists");
  }

  const nextId = await getNextDeviceTypeId();

  const created = await DeviceType.create({
    id: nextId,
    name,
    type,
    description: payload?.description || ""
  });

  return serialize(created);
};

const update = async (id, payload) => {
  const normalizedId = normalizeId(id);
  if (!normalizedId) {
    throw createServiceError(400, "Invalid id");
  }

  const row = await DeviceType.findByPk(normalizedId);
  if (!row) {
    throw createServiceError(404, "Device type not found");
  }

  if (payload?.id && String(payload.id) !== normalizedId) {
    throw createServiceError(400, "id cannot be changed");
  }

  if (payload?.type && normalizeType(payload.type) !== row.type) {
    throw createServiceError(400, "type cannot be changed");
  }

  const nextName = payload?.name === undefined ? row.name : String(payload.name || "").trim();
  if (!nextName) {
    throw createServiceError(400, "name is required");
  }

  const duplicate = await DeviceType.findOne({
    where: {
      id: { [Op.ne]: normalizedId },
      name: nextName,
      type: row.type
    }
  });

  if (duplicate) {
    throw createServiceError(409, "Device type already exists");
  }

  await DeviceType.update({
    name: nextName,
    description: payload?.description ?? row.description
  }, {
    where: { id: normalizedId }
  });

  const updated = await DeviceType.findByPk(normalizedId);
  return serialize(updated);
};

const remove = async (id) => {
  const normalizedId = normalizeId(id);
  if (!normalizedId) {
    throw createServiceError(400, "Invalid id");
  }

  const row = await DeviceType.findByPk(normalizedId);
  if (!row) {
    throw createServiceError(404, "Device type not found");
  }

  const devicesUsingType = await Device.count({
    where: {
      device_type_id: normalizedId
    }
  });

  if (devicesUsingType > 0) {
    throw createServiceError(409, "Cannot delete device type because devices are using it.");
  }

  await DeviceType.destroy({ where: { id: normalizedId } });
  return { id: normalizedId };
};

module.exports = {
  getAll,
  getNextId: getNextDeviceTypeId,
  create,
  update,
  remove
};
