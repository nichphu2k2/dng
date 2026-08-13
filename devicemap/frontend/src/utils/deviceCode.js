export const generateNextDeviceCode = (devices = []) => {
  const used = new Set();

  for (const item of devices) {
    const rawCode = typeof item === "string" ? item : item?.code || item?.device_code;
    const normalized = normalizeDeviceCode(rawCode);
    if (normalized) {
      used.add(Number(normalized));
    }
  }

  for (let value = 1; value <= 99999; value += 1) {
    if (!used.has(value)) {
      return String(value).padStart(5, "0");
    }
  }

  throw new Error("All device codes are already in use");
};

export const normalizeDeviceCode = (code) => {
  if (code === undefined || code === null) {
    return null;
  }

  const codeString = String(code).trim();
  const numeric = Number(codeString);

  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 99999) {
    return null;
  }

  return String(numeric).padStart(5, "0");
};
