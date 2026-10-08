const { QueryTypes } = require("sequelize");

const sequelize = require("../config/database");
const Device = require("../modules/device/device.model");

const MEDIA_MTX_API_URL = String(process.env.MEDIA_MTX_API_URL || "http://mediamtx:9997").replace(/\/+$/, "");

const buildApiUrl = (path) => `${MEDIA_MTX_API_URL}${path}`;

const getCameraById = async (deviceId) => {
  const normalizedId = String(deviceId || "").trim();
  if (!normalizedId) {
    return null;
  }

  const rows = await sequelize.query(
    `
      SELECT d.*
      FROM devices d
      JOIN device_types dt ON d.device_type_id = dt.id
      WHERE d.id = :deviceId
        AND dt.type = 'Camera'
      LIMIT 1
    `,
    {
      replacements: { deviceId: normalizedId },
      type: QueryTypes.SELECT
    }
  );

  return rows[0] || null;
};

const updateRtspStatus = async (deviceId, statusPatch = {}) => {
  const payload = {};

  if (statusPatch.rtsp1_status !== undefined) {
    payload.rtsp1_status = Number(statusPatch.rtsp1_status) === 1 ? 1 : 0;
  }

  if (statusPatch.rtsp2_status !== undefined) {
    payload.rtsp2_status = Number(statusPatch.rtsp2_status) === 1 ? 1 : 0;
  }

  if (Object.keys(payload).length === 0) {
    return;
  }

  await Device.update(payload, {
    where: { id: String(deviceId) }
  });
};

const checkMediaMTXHealth = async () => {
  try {
    const response = await fetch(buildApiUrl("/v3/paths/list"), {
      method: "GET"
    });

    return response.status === 200;
  } catch (error) {
    return false;
  }
};

const clearAllMediaMTXPath = async () => {
  const response = await fetch(buildApiUrl("/v3/paths/list"), {
    method: "GET"
  });

  if (!response.ok) {
    throw new Error(`MediaMTX list paths failed with status ${response.status}`);
  }

  const payload = await response.json().catch(() => ({}));
  const names = Array.isArray(payload?.items)
    ? payload.items
      .map((item) => String(item?.name || "").trim())
      .filter(Boolean)
    : [];

  for (const name of names) {
    try {
      const deleteRes = await fetch(buildApiUrl(`/v3/config/paths/delete/${encodeURIComponent(name)}`), {
        method: "DELETE"
      });

      if (!deleteRes.ok) {
        console.warn(`[MediaMTX] Skip delete path ${name}: status ${deleteRes.status}`);
      }
    } catch (error) {
      console.warn(`[MediaMTX] Skip delete path ${name}: ${error.message}`);
    }
  }

  return {
    total: names.length
  };
};

const addCameraStream = async (device) => {
  const deviceId = String(device?.id || "").trim();
  if (!deviceId) {
    throw new Error("device.id is required");
  }

  const camera = await getCameraById(deviceId);
  if (!camera) {
    console.warn(`[MediaMTX] Skip device ${deviceId}: not Camera`);
    return {
      deviceId,
      skipped: true
    };
  }

  const streamResults = {
    rtsp1_status: 0,
    rtsp2_status: 0
  };

  const rtsp1 = String(camera.rtsp1 || "").trim();
  if (!rtsp1) {
    console.warn(`[MediaMTX] Camera ${camera.id} stream1 missing rtsp1`);
  } else {
    try {
      const response = await fetch(buildApiUrl(`/v3/config/paths/add/${encodeURIComponent(`${camera.id}_1`)}`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ source: rtsp1 })
      });

      if (response.ok) {
        streamResults.rtsp1_status = 1;
        console.log(`[MediaMTX] Camera ${camera.id} stream1 added`);
      } else {
        console.warn(`[MediaMTX] Camera ${camera.id} stream1 failed: status ${response.status}`);
      }
    } catch (error) {
      console.warn(`[MediaMTX] Camera ${camera.id} stream1 failed: ${error.message}`);
    }
  }

  await updateRtspStatus(camera.id, { rtsp1_status: streamResults.rtsp1_status });

  const rtsp2 = String(camera.rtsp2 || "").trim();
  if (!rtsp2) {
    console.warn(`[MediaMTX] Camera ${camera.id} stream2 missing rtsp2`);
  } else {
    try {
      const response = await fetch(buildApiUrl(`/v3/config/paths/add/${encodeURIComponent(`${camera.id}_2`)}`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ source: rtsp2 })
      });

      if (response.ok) {
        streamResults.rtsp2_status = 1;
        console.log(`[MediaMTX] Camera ${camera.id} stream2 added`);
      } else {
        console.warn(`[MediaMTX] Camera ${camera.id} stream2 failed: status ${response.status}`);
      }
    } catch (error) {
      console.warn(`[MediaMTX] Camera ${camera.id} stream2 failed: ${error.message}`);
    }
  }

  await updateRtspStatus(camera.id, { rtsp2_status: streamResults.rtsp2_status });

  return {
    deviceId: camera.id,
    ...streamResults
  };
};

const removeCameraStreams = async (deviceId) => {
  const normalizedId = String(deviceId || "").trim();
  if (!normalizedId) {
    return;
  }

  const camera = await getCameraById(normalizedId);
  if (!camera) {
    return;
  }

  for (const suffix of ["1", "2"]) {
    const pathName = `${camera.id}_${suffix}`;
    try {
      const response = await fetch(buildApiUrl(`/v3/config/paths/delete/${encodeURIComponent(pathName)}`), {
        method: "DELETE"
      });

      if (!response.ok) {
        console.warn(`[MediaMTX] Delete ${pathName} failed: status ${response.status}`);
      }
    } catch (error) {
      console.warn(`[MediaMTX] Delete ${pathName} failed: ${error.message}`);
    }
  }
};

const refreshAllCameraStreams = async () => {
  const health = await checkMediaMTXHealth();
  if (!health) {
    throw new Error("MediaMTX is not healthy");
  }

  await clearAllMediaMTXPath();

  const cameras = await sequelize.query(
    `
      SELECT d.*
      FROM devices d
      JOIN device_types dt ON d.device_type_id = dt.id
      WHERE dt.type = 'Camera'
      ORDER BY d.id ASC
    `,
    {
      type: QueryTypes.SELECT
    }
  );

  for (const camera of cameras) {
    try {
      await addCameraStream(camera);
    } catch (error) {
      console.warn(`[MediaMTX] Camera ${camera.id} refresh failed: ${error.message}`);
    }
  }

  return {
    total: cameras.length
  };
};

module.exports = {
  checkMediaMTXHealth,
  clearAllMediaMTXPath,
  addCameraStream,
  removeCameraStreams,
  refreshAllCameraStreams
};