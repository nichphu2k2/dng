const fs = require("fs");
const path = require("path");
const sequelize = require("../../config/database");
const Plane = require("./plane.model");
const { clearByPlane } = require("../monitor/monitor.service");

const PLANE_IMAGE_DIR = process.env.PLANE_IMAGE_DIR || "/app/image/planes";

if (!fs.existsSync(PLANE_IMAGE_DIR)) {
  fs.mkdirSync(PLANE_IMAGE_DIR, { recursive: true });
}

const createServiceError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeId = (value) => {
  const number = Number(String(value || "").trim());
  if (!Number.isInteger(number) || number < 0 || number > 99999) {
    return null;
  }

  return String(number).padStart(5, "0");
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

const removePlaneImageFiles = (planeId) => {
  const escapedId = planeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`^${escapedId}\\.(jpg|jpeg|png|svg)$`, "i");

  const files = fs.readdirSync(PLANE_IMAGE_DIR);
  files.forEach((fileName) => {
    if (matcher.test(fileName)) {
      fs.unlinkSync(path.join(PLANE_IMAGE_DIR, fileName));
    }
  });
};

const savePlaneImageFile = (planeId, file) => {
  if (!file) {
    return null;
  }

  const ext = getExtensionFromFile(file).toLowerCase();
  const imageName = `${planeId}${ext}`;
  const imagePath = path.join(PLANE_IMAGE_DIR, imageName);

  removePlaneImageFiles(planeId);
  fs.writeFileSync(imagePath, file.buffer);

  return `/image/planes/${imageName}`;
};

const serialize = (plane) => {
  if (!plane) {
    return null;
  }

  const plain = plane.toJSON ? plane.toJSON() : plane;
  return {
    id: plain.id,
    name: plain.name,
    type: plain.type,
    parentId: plain.parent_id,
    image: plain.image,
    description: plain.description || ""
  };
};

const getNextId = async () => {
  const rows = await Plane.findAll({ attributes: ["id"] });
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

  throw createServiceError(409, "No available plane id in range 00001-99999");
};

const getAll = async () => {
  const rows = await Plane.findAll({ order: [["id", "ASC"]] });
  return rows.map(serialize);
};

const create = async ({ data, file }) => {
  const name = String(data?.name || "").trim();
  const type = data?.type;
  const description = data?.description || "";
  const parentId = data?.parent_id || null;

  if (!name) {
    throw createServiceError(400, "name is required");
  }

  if (!type || !["Root", "Dependence"].includes(type)) {
    throw createServiceError(400, "type must be Root or Dependence");
  }

  if (type === "Dependence" && !file) {
    throw createServiceError(400, "image is required for Dependence plane");
  }

  const id = await getNextId();

  let normalizedParentId = null;
  if (type === "Dependence" && parentId) {
    normalizedParentId = normalizeId(parentId);
    if (!normalizedParentId) {
      throw createServiceError(400, "Invalid parent_id");
    }

    const parentPlane = await Plane.findByPk(normalizedParentId);
    if (!parentPlane) {
      throw createServiceError(404, "Parent plane not found");
    }

    if (parentPlane.type !== "Root") {
      throw createServiceError(400, "Parent plane must be Root type");
    }
  }

  const image = savePlaneImageFile(id, file);

  const created = await Plane.create({
    id,
    name,
    type,
    parent_id: normalizedParentId,
    image,
    description
  });

  return serialize(created);
};

const update = async (id, { data, file }) => {
  const normalizedId = normalizeId(id);
  if (!normalizedId) {
    throw createServiceError(400, "Invalid plane id");
  }

  const plane = await Plane.findByPk(normalizedId);
  if (!plane) {
    throw createServiceError(404, "Plane not found");
  }

  if (data?.id && normalizeId(data.id) !== normalizedId) {
    throw createServiceError(400, "id cannot be changed");
  }

  if (data?.type && data.type !== plane.type) {
    throw createServiceError(400, "type cannot be changed");
  }

  const nextName = data?.name === undefined ? plane.name : String(data.name || "").trim();
  if (!nextName) {
    throw createServiceError(400, "name is required");
  }

  const updatePayload = {
    name: nextName,
    description: data?.description ?? plane.description
  };

  if (plane.type === "Dependence") {
    let nextParentId = data?.parent_id === undefined ? plane.parent_id : data.parent_id || null;

    if (nextParentId) {
      nextParentId = normalizeId(nextParentId);
      if (!nextParentId) {
        throw createServiceError(400, "Invalid parent_id");
      }

      if (nextParentId === normalizedId) {
        throw createServiceError(400, "Plane cannot be parent of itself");
      }

      const parentPlane = await Plane.findByPk(nextParentId);
      if (!parentPlane) {
        throw createServiceError(404, "Parent plane not found");
      }

      if (parentPlane.type !== "Root") {
        throw createServiceError(400, "Parent plane must be Root type");
      }
    }

    updatePayload.parent_id = nextParentId;
  } else {
    updatePayload.parent_id = null;
  }

  const removeImage = String(data?.remove_image || "false").toLowerCase() === "true";

  if (removeImage) {
    removePlaneImageFiles(normalizedId);
    updatePayload.image = null;
  }

  if (file) {
    updatePayload.image = savePlaneImageFile(normalizedId, file);
  }

  await Plane.update(updatePayload, { where: { id: normalizedId } });
  const updated = await Plane.findByPk(normalizedId);
  return serialize(updated);
};

const remove = async (id) => {
  const normalizedId = normalizeId(id);
  if (!normalizedId) {
    throw createServiceError(400, "Invalid plane id");
  }

  const plane = await Plane.findByPk(normalizedId);
  if (!plane) {
    throw createServiceError(404, "Plane not found");
  }

  const childCount = await Plane.count({ where: { parent_id: normalizedId } });
  if (childCount > 0) {
    throw createServiceError(409, "Cannot delete plane because it has child planes.");
  }

  const transaction = await sequelize.transaction();

  try {
    await clearByPlane(normalizedId, transaction);
    await Plane.destroy({ where: { id: normalizedId }, transaction });
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  removePlaneImageFiles(normalizedId);
  return { id: normalizedId };
};

module.exports = {
  getAll,
  create,
  update,
  remove,
  getNextId
};
