const Setting = require("./setting.model");
const mediaMtxService = require("../../services/mediaMtx.service");

const LINE_PARAMETERS_KEY = "line_parameters";
const ALERT_SETUP_KEY = "alert_setup";

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

module.exports = {
  getLineParameters,
  updateLineParameters,
  getAlertSetup,
  updateAlertSetup,
  refreshRtsp
};
