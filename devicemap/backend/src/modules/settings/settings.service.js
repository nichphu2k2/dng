const Setting = require("./setting.model");
const mediaMtxService = require("../../services/mediaMtx.service");

const LINE_PARAMETERS_KEY = "line_parameters";
const ALERT_SETUP_KEY = "alert_setup";
const NX_SETTINGS_KEY = "nx_settings";
const NX_SESSION_KEY = "nx_session";

const LINE_THICKNESS_VALUES = ["thin", "medium", "thick"];
const TRANSITION_SPEED_VALUES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const PROCESSING_UNITS = ["minute", "hour", "day"];

const DEFAULT_LINE_PARAMETERS = {
  line_thickness: "medium",
  color_1: "#3dbbff",
  color_2: "#ff4d4f",
  transition_speed: 60
};

const DEFAULT_ALERT_SETUP = {
  username: "",
  password: "",
  port: 3000,
  processing_time_value: 15,
  processing_time_unit: "minute"
};

const DEFAULT_NX_SETTINGS = {
  ip: "",
  port: 7001,
  username: "",
  password: "",
  sync_enabled: 0
};

const createServiceError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const isHexColor = (value) => /^#[0-9a-fA-F]{6}$/.test(String(value || ""));

const toSafeObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
};

const getSettingValue = async (settingKey, fallback) => {
  const row = await Setting.findOne({ where: { setting_key: settingKey } });
  if (!row) {
    return { ...fallback };
  }

  return {
    ...fallback,
    ...toSafeObject(row.setting_value)
  };
};

const upsertSettingValue = async (settingKey, settingValue) => {
  const row = await Setting.findOne({ where: { setting_key: settingKey } });

  if (!row) {
    await Setting.create({
      setting_key: settingKey,
      setting_value: settingValue
    });
    return;
  }

  row.setting_value = settingValue;
  await row.save();
};

const validateLineParameters = (payload) => {
  const lineThickness = String(payload.line_thickness || "").trim().toLowerCase();
  if (!LINE_THICKNESS_VALUES.includes(lineThickness)) {
    throw createServiceError(400, "line_thickness must be thin, medium or thick");
  }

  const color1 = String(payload.color_1 || "").trim();
  if (!isHexColor(color1)) {
    throw createServiceError(400, "color_1 must be a valid RGB hex color");
  }

  const color2 = String(payload.color_2 || "").trim();
  if (!isHexColor(color2)) {
    throw createServiceError(400, "color_2 must be a valid RGB hex color");
  }

  const transitionSpeed = Number(payload.transition_speed);
  if (!Number.isInteger(transitionSpeed) || !TRANSITION_SPEED_VALUES.includes(transitionSpeed)) {
    throw createServiceError(400, "transition_speed must be one of 10,20,30,40,50,60,70,80,90,100");
  }

  return {
    line_thickness: lineThickness,
    color_1: color1,
    color_2: color2,
    transition_speed: transitionSpeed
  };
};

const validateAlertSetup = (payload) => {
  const username = String(payload.username || "").trim();
  const password = String(payload.password || "").trim();

  if (!/^[a-zA-Z0-9]*$/.test(username)) {
    throw createServiceError(400, "username can only contain letters and numbers");
  }

  if (!/^[a-zA-Z0-9]*$/.test(password)) {
    throw createServiceError(400, "password can only contain letters and numbers");
  }

  const processingTimeValue = Number(payload.processing_time_value);
  if (!Number.isInteger(processingTimeValue) || processingTimeValue < 1) {
    throw createServiceError(400, "processing_time_value must be an integer greater than 0");
  }

  const processingTimeUnit = String(payload.processing_time_unit || "").trim().toLowerCase();
  if (!PROCESSING_UNITS.includes(processingTimeUnit)) {
    throw createServiceError(400, "processing_time_unit must be minute, hour or day");
  }

  return {
    username,
    password,
    port: 3000,
    processing_time_value: processingTimeValue,
    processing_time_unit: processingTimeUnit
  };
};

const getLineParameters = async () => {
  return getSettingValue(LINE_PARAMETERS_KEY, DEFAULT_LINE_PARAMETERS);
};

const updateLineParameters = async (payload) => {
  const current = await getLineParameters();
  const merged = {
    ...current,
    ...toSafeObject(payload)
  };

  const normalized = validateLineParameters(merged);
  await upsertSettingValue(LINE_PARAMETERS_KEY, normalized);
  return normalized;
};

const getAlertSetup = async () => {
  const value = await getSettingValue(ALERT_SETUP_KEY, DEFAULT_ALERT_SETUP);
  return {
    ...value,
    port: 3000
  };
};

const updateAlertSetup = async (payload) => {
  const current = await getAlertSetup();
  const merged = {
    ...current,
    ...toSafeObject(payload)
  };

  const normalized = validateAlertSetup(merged);
  await upsertSettingValue(ALERT_SETUP_KEY, normalized);
  return normalized;
};

const refreshRtsp = async () => {
  await mediaMtxService.refreshAllCameraStreams();
  return {
    success: true,
    message: "RTSP refreshed"
  };
};

const validateNxSettings = (payload) => {
  const ip = String(payload.ip || "").trim();
  if (ip && !/^[a-zA-Z0-9.\-:]+$/.test(ip)) {
    throw createServiceError(400, "ip must be a valid host/IP");
  }

  const port = Number(payload.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw createServiceError(400, "port must be an integer between 1 and 65535");
  }

  const username = String(payload.username || "").trim();
  const password = String(payload.password ?? "");
  const syncEnabled = [true, "true", 1, "1"].includes(payload.sync_enabled) ? 1 : 0;

  return {
    ip,
    port,
    username,
    password,
    sync_enabled: syncEnabled
  };
};

// Internal only: includes password, must never be returned to the frontend.
const getNxSettingsInternal = async () => {
  return getSettingValue(NX_SETTINGS_KEY, DEFAULT_NX_SETTINGS);
};

const sanitizeNxSettings = (value) => ({
  ip: value.ip,
  port: value.port,
  username: value.username,
  sync_enabled: value.sync_enabled ? 1 : 0,
  has_password: Boolean(value.password)
});

const getNxSettings = async () => {
  const value = await getNxSettingsInternal();
  return sanitizeNxSettings(value);
};

const updateNxSettings = async (payload) => {
  const current = await getNxSettingsInternal();
  const rawPassword = payload?.password;
  const nextPassword = rawPassword === undefined || rawPassword === null || rawPassword === ""
    ? current.password
    : rawPassword;

  const merged = {
    ...current,
    ...toSafeObject(payload),
    password: nextPassword
  };

  const normalized = validateNxSettings(merged);
  await upsertSettingValue(NX_SETTINGS_KEY, normalized);
  return sanitizeNxSettings(normalized);
};

// Backend-only session cache; never exposed via controller/routes.
const getNxSessionToken = async () => {
  const row = await Setting.findOne({ where: { setting_key: NX_SESSION_KEY } });
  const value = toSafeObject(row?.setting_value);
  if (!value.token || !value.expires_at) {
    return null;
  }

  if (new Date(value.expires_at).getTime() <= Date.now()) {
    return null;
  }

  return value.token;
};

const setNxSessionToken = async (token, expiresInS) => {
  const safeExpiresInS = Number.isFinite(Number(expiresInS)) ? Math.max(Number(expiresInS), 0) : 0;
  const expiresAt = new Date(Date.now() + safeExpiresInS * 1000).toISOString();
  await upsertSettingValue(NX_SESSION_KEY, { token, expires_at: expiresAt });
};

module.exports = {
  getLineParameters,
  updateLineParameters,
  getAlertSetup,
  updateAlertSetup,
  refreshRtsp,
  getNxSettings,
  updateNxSettings,
  getNxSettingsInternal,
  getNxSessionToken,
  setNxSessionToken
};
