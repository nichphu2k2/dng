const https = require("https");
const fs = require("fs");
const path = require("path");

const Device = require("../modules/device/device.model");
const DeviceType = require("../modules/device-type/device-type.model");
const deviceService = require("../modules/device/device.service");
const settingsService = require("../modules/settings/settings.service");

const SESSION_CHECK_INTERVAL_MS = 86400 * 1000; // 24h
const DEVICE_SYNC_INTERVAL_MS = 30 * 1000; // 30s
const NX_REQUEST_TIMEOUT_MS = 10000;

// Camera device type is seeded at startup (mysql/01_device_types.sql) and always available.
const DEFAULT_CAMERA_DEVICE_TYPE_ID = "00001";
// Source/template image (Dockerfile: COPY default_camera.jpg ./default_camera.jpg, WORKDIR /app).
// This is never referenced directly by devices.icon1 - it is copied into the existing
// device icon directory using the same convention as manual icon uploads (device.service.js).
const DEFAULT_CAMERA_SOURCE_PATH = path.join(__dirname, "../../default_camera.jpg");

const createServiceError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

/**
 * Minimal HTTPS JSON request helper. NX Servers commonly use self-signed
 * certificates, so certificate validation is relaxed for this integration only.
 */
const requestJson = ({ hostname, port, path, method, headers, body }) => {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;

    const req = https.request(
      {
        hostname,
        port,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          ...headers
        },
        rejectUnauthorized: false,
        timeout: NX_REQUEST_TIMEOUT_MS
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          let parsedBody = null;
          try {
            parsedBody = raw ? JSON.parse(raw) : null;
          } catch {
            parsedBody = null;
          }

          resolve({ status: res.statusCode, body: parsedBody, raw });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("NX request timed out"));
    });
    req.on("error", (err) => reject(err));

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
};

const buildNxConnection = (config) => ({
  hostname: String(config.ip || "").trim(),
  port: Number(config.port) || 7001
});

const isNxConfigured = (config) => {
  return Boolean(config.ip) && Boolean(config.username);
};

/**
 * Logs into NX Server and stores the resulting session token.
 * Never logs username/password/token.
 */
const login = async () => {
  const config = await settingsService.getNxSettingsInternal();
  if (!isNxConfigured(config)) {
    throw createServiceError(400, "NX Server chưa được cấu hình");
  }

  const { hostname, port } = buildNxConnection(config);

  let response;
  try {
    response = await requestJson({
      hostname,
      port,
      path: "/rest/v3/login/sessions",
      method: "POST",
      body: {
        username: config.username,
        password: config.password
      }
    });
  } catch (err) {
    throw createServiceError(502, `NX login request failed: ${err.message}`);
  }

  if (response.status < 200 || response.status >= 300 || !response.body || !response.body.token) {
    throw createServiceError(response.status || 502, "NX login failed");
  }

  await settingsService.setNxSessionToken(response.body.token, response.body.expiresInS);
  console.log("[NX] Login successful, session token stored");

  return response.body.token;
};

/**
 * Periodic (every 24h) session validity check. Re-logs in when the remaining
 * session lifetime is at or below 24h, or when the check itself fails.
 */
const checkSession = async () => {
  const config = await settingsService.getNxSettingsInternal();
  if (!isNxConfigured(config)) {
    return;
  }

  const token = await settingsService.getNxSessionToken();
  if (!token) {
    await login().catch((err) => console.warn("[NX] Session login failed:", err.message));
    return;
  }

  const { hostname, port } = buildNxConnection(config);

  try {
    const response = await requestJson({
      hostname,
      port,
      path: `/rest/v3/login/sessions/${encodeURIComponent(token)}`,
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    });

    const expiresInS = Number(response.body?.expiresInS);

    if (response.status >= 200 && response.status < 300 && Number.isFinite(expiresInS) && expiresInS > 86400) {
      // Session still has more than 24h left, keep current token.
      return;
    }

    console.log("[NX] Session near expiry or check failed, re-authenticating");
    await login();
  } catch (err) {
    console.warn("[NX] Session check failed, attempting re-login:", err.message);
    await login().catch((loginErr) => console.warn("[NX] Re-login failed:", loginErr.message));
  }
};

const fetchNxDevices = async (config, token) => {
  const { hostname, port } = buildNxConnection(config);

  let response;
  try {
    response = await requestJson({
      hostname,
      port,
      path: "/rest/v3/devices?_with=id,deviceType,name,status",
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (err) {
    throw createServiceError(502, `NX devices request failed: ${err.message}`);
  }

  if (response.status === 401 || response.status === 403) {
    const err = createServiceError(response.status, "NX session unauthorized");
    err.isAuthError = true;
    throw err;
  }

  if (response.status < 200 || response.status >= 300) {
    throw createServiceError(response.status || 502, `NX devices request failed with status ${response.status}`);
  }

  if (!Array.isArray(response.body)) {
    throw createServiceError(502, "NX devices response is not a valid array");
  }

  return response.body;
};

const filterRecordingCameras = (list) => {
  return list.filter((item) => {
    return (
      item &&
      typeof item === "object" &&
      String(item.deviceType) === "Camera" &&
      String(item.status) === "Recording" &&
      item.id !== undefined &&
      item.id !== null &&
      String(item.id).trim() !== "" &&
      item.name !== undefined &&
      item.name !== null &&
      String(item.name).trim() !== ""
    );
  });
};

const encodeRtspCredential = (value) => encodeURIComponent(String(value || ""));

const buildRtspUrl = (config, nxDeviceId, streamIndex) => {
  const user = encodeRtspCredential(config.username);
  const pass = encodeRtspCredential(config.password);
  return `rtsp://${user}:${pass}@${config.ip}:${config.port}/${nxDeviceId}?stream=${streamIndex}`;
};

const getLocalCameras = async () => {
  return Device.findAll({
    include: [
      {
        model: DeviceType,
        where: { type: "Camera" },
        attributes: []
      }
    ]
  });
};

/**
 * Copies the default_camera.jpg template into the existing device icon directory,
 * reusing device.service.saveDeviceIconFile so NX-created cameras get an icon
 * (/image/icon/<id>_1.jpg) exactly like a manually created device would.
 * Returns null (without throwing) if the source is missing or the copy fails,
 * matching the existing behavior where icon1 is optional.
 */
const copyDefaultCameraIcon = (deviceId) => {
  if (!fs.existsSync(DEFAULT_CAMERA_SOURCE_PATH)) {
    console.warn(`[NX] Default camera icon source not found at ${DEFAULT_CAMERA_SOURCE_PATH}`);
    return null;
  }

  try {
    const buffer = fs.readFileSync(DEFAULT_CAMERA_SOURCE_PATH);
    return deviceService.saveDeviceIconFile(deviceId, 1, {
      buffer,
      mimetype: "image/jpeg",
      originalname: "default_camera.jpg"
    });
  } catch (err) {
    console.warn(`[NX] Failed to copy default camera icon for device ${deviceId}:`, err.message);
    return null;
  }
};

let isSyncing = false;

/**
 * Fetch Camera+Recording devices from NX and reconcile with local `devices`.
 * - Always adds cameras missing locally.
 * - Only deletes local cameras missing from NX when sync_enabled = 1.
 * - Never mutates the database if the NX response could not be validated.
 */
const syncCameras = async () => {
  if (isSyncing) {
    return;
  }

  isSyncing = true;
  try {
    const config = await settingsService.getNxSettingsInternal();
    if (!isNxConfigured(config)) {
      return;
    }

    let token = await settingsService.getNxSessionToken();
    if (!token) {
      try {
        token = await login();
      } catch (err) {
        console.warn("[NX] Skip device sync, login failed:", err.message);
        return;
      }
    }

    let nxDevices;
    try {
      nxDevices = await fetchNxDevices(config, token);
    } catch (err) {
      if (err.isAuthError) {
        try {
          token = await login();
          nxDevices = await fetchNxDevices(config, token);
        } catch (retryErr) {
          console.warn("[NX] Device sync aborted after re-login failure:", retryErr.message);
          return;
        }
      } else {
        console.warn("[NX] Device sync aborted, NX devices request failed:", err.message);
        return;
      }
    }

    const cameras = filterRecordingCameras(nxDevices);
    const nxNames = new Set(cameras.map((item) => String(item.name).trim()));

    const localCameraRows = await getLocalCameras();
    const localNameMap = new Map(localCameraRows.map((row) => [String(row.name).trim(), row]));

    for (const cam of cameras) {
      const name = String(cam.name).trim();
      if (localNameMap.has(name)) {
        continue;
      }

      try {
        const created = await deviceService.create({
          data: {
            name,
            device_type_id: DEFAULT_CAMERA_DEVICE_TYPE_ID,
            rtsp1: buildRtspUrl(config, cam.id, 0),
            rtsp2: buildRtspUrl(config, cam.id, 1)
          },
          files: []
        });

        const iconPath = copyDefaultCameraIcon(created.id);
        if (iconPath) {
          await Device.update(
            { icon1: iconPath },
            { where: { id: created.id } }
          );
        }

        localNameMap.set(name, { id: created.id, name });
        console.log(`[NX] Camera "${name}" added as device ${created.id}`);
      } catch (err) {
        console.warn(`[NX] Failed to create camera "${name}":`, err.message);
      }
    }

    if (Number(config.sync_enabled) === 1) {
      for (const [name, row] of localNameMap.entries()) {
        if (nxNames.has(name)) {
          continue;
        }

        try {
          await deviceService.remove(row.id);
          console.log(`[NX] Camera "${name}" (device ${row.id}) removed, no longer on NX`);
        } catch (err) {
          console.warn(`[NX] Failed to delete camera "${name}" (${row.id}):`, err.message);
        }
      }
    }
  } catch (err) {
    console.error("[NX] syncCameras() unexpected error:", err.message);
  } finally {
    isSyncing = false;
  }
};

let deviceSyncTimer = null;
let sessionCheckTimer = null;

/**
 * Starts the NX background workers. Safe to call multiple times: existing
 * timers are cleared first so no duplicate schedulers are created.
 */
const startWorkers = () => {
  if (deviceSyncTimer) {
    clearInterval(deviceSyncTimer);
  }
  if (sessionCheckTimer) {
    clearInterval(sessionCheckTimer);
  }

  sessionCheckTimer = setInterval(() => {
    checkSession().catch((err) => console.warn("[NX] Session check worker error:", err.message));
  }, SESSION_CHECK_INTERVAL_MS);

  deviceSyncTimer = setInterval(() => {
    syncCameras().catch((err) => console.warn("[NX] Device sync worker error:", err.message));
  }, DEVICE_SYNC_INTERVAL_MS);

  checkSession().catch((err) => console.warn("[NX] Initial session check error:", err.message));
  syncCameras().catch((err) => console.warn("[NX] Initial device sync error:", err.message));
};

module.exports = {
  startWorkers,
  syncCameras,
  checkSession,
  login
};
