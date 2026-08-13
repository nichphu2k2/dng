const service = require("./report.service");

const toBuffer = (value) => {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }

  return Buffer.from(value || "");
};

const ensureExtension = (fileName, extension) => {
  const safeName = String(fileName || "export").trim().replace(/^"|"$/g, "");
  return safeName.toLowerCase().endsWith(`.${extension}`)
    ? safeName
    : `${safeName}.${extension}`;
};

const sendExcel = (res, fileName, buffer) => {
  const payload = toBuffer(buffer);
  const safeFileName = ensureExtension(fileName, "xlsx");

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);
  res.send(payload);
};

const sendPdf = (res, fileName, buffer) => {
  const payload = toBuffer(buffer);
  const safeFileName = ensureExtension(fileName, "pdf");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);
  res.send(payload);
};

const listReports = async (req, res) => {
  try {
    const data = await service.listHistoryReports(req.query || {});
    res.json({
      success: true,
      ...data
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
};

const exportHistoryExcel = async (req, res) => {
  try {
    const result = await service.exportHistoryExcel(req.query || {});
    sendExcel(res, result.fileName, result.buffer);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
};

const exportDeviceExcel = async (req, res) => {
  try {
    const result = await service.exportDeviceExcel();
    sendExcel(res, result.fileName, result.buffer);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
};

const exportPlaneExcel = async (req, res) => {
  try {
    const result = await service.exportPlaneExcel();
    sendExcel(res, result.fileName, result.buffer);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
};

const exportHistoryPdf = async (req, res) => {
  try {
    const result = await service.exportHistoryPDF(req.query || {});
    sendPdf(res, result.fileName, result.buffer);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
};

const exportDevicePdf = async (req, res) => {
  try {
    const result = await service.exportDevicePDF();
    sendPdf(res, result.fileName, result.buffer);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
};

const exportPlanePdf = async (req, res) => {
  try {
    const result = await service.exportPlanePDF();
    sendPdf(res, result.fileName, result.buffer);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
};

const getAlerts = async (req, res) => {
  try {
    const data = await service.fetchData(req.query);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const exportExcel = async (req, res) => {
  try {
    const buffer = await service.exportExcel(req.query);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader("Content-Disposition", "attachment; filename=\"report.xlsx\"");

    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const exportPDF = async (req, res) => {
  try {
    const buffer = await service.exportPDF(req.query);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=\"report.pdf\"");

    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateProcessState = async (req, res) => {
  try {
    const data = await service.updateProcessState(req.params.id, req.body || {}, req.auth || null);
    res.json({
      success: true,
      report: data
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
};

const getActiveAlarms = async (req, res) => {
  try {
    const data = await service.getActiveAlarms(req.query || {});
    res.json({
      success: true,
      alarms: data
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
};

const updateAllActiveProcessState = async (req, res) => {
  try {
    const data = await service.updateAllActiveProcessState(req.body || {}, req.auth || null);
    res.json({
      success: true,
      reports: data
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
};

module.exports = {
  listReports,
  exportHistoryExcel,
  exportDeviceExcel,
  exportPlaneExcel,
  exportHistoryPdf,
  exportDevicePdf,
  exportPlanePdf,
  getAlerts,
  exportExcel,
  exportPDF,
  updateProcessState,
  getActiveAlarms,
  updateAllActiveProcessState
};