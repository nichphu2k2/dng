const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const { Op } = require("sequelize");
const Device = require("../device/device.model");
const DeviceType = require("../device-type/device-type.model");
const Plane = require("../plane/plane.model");
const User = require("../user/user.model");
const Report = require("./report.model");
const socket = require("../../config/socket");
const settingsService = require("../settings/settings.service");
const { buildAlarmTargets } = require("../devicemap/alarm-targets.util");

const buildWhere = (query) => {
  const where = {};

  if (query?.deviceTypeId) where.device_type_id = query.deviceTypeId;
  
  if (query?.status !== undefined) where.status = query.status;

  if (query?.deviceId) {
    where.id = query.deviceId;
  }

  return where;
};

const toVietnamDateTime = (value) => {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const vietnamTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);

  const year = vietnamTime.getUTCFullYear();
  const month = String(vietnamTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(vietnamTime.getUTCDate()).padStart(2, "0");
  const hour = String(vietnamTime.getUTCHours()).padStart(2, "0");
  const minute = String(vietnamTime.getUTCMinutes()).padStart(2, "0");
  const second = String(vietnamTime.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
};

const fetchData = async (query) => {
  try {
    return await Device.findAll({
      where: buildWhere(query),
      include: [
        { model: DeviceType, attributes: ["id", "name"] }
      ],
      order: [["id", "ASC"]]
    });
  } catch (err) {
    console.error("Report.fetchData() Error:", err.message);
    throw new Error(`Failed to fetch report data: ${err.message}`);
  }
};

/* ===================== EXCEL ===================== */
const exportExcel = async (query) => {
  try {
    const data = await fetchData(query);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Device Report");

    sheet.columns = [
      { header: "Device ID", key: "id", width: 15 },
      { header: "Device Name", key: "name", width: 25 },
      { header: "Device Type", key: "device_type", width: 20 },
      { header: "Status", key: "status", width: 12 },
      { header: "Description", key: "description", width: 30 }
    ];

    data.forEach((device) => {
      sheet.addRow({
        id: device.id,
        name: device.name,
        device_type: device.DeviceType?.name || "N/A",
        status: device.status === 1 ? "Active" : "Inactive",
        description: device.description || ""
      });
    });

    return await workbook.xlsx.writeBuffer();
  } catch (err) {
    console.error("Report.exportExcel() Error:", err.message);
    throw new Error(`Failed to export Excel: ${err.message}`);
  }
};

/* ===================== PDF ===================== */
const exportPDF = async (query) => {
  try {
    const data = await fetchData(query);

    const doc = new PDFDocument();
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));

    doc.fontSize(16).text("DEVICE REPORT", { align: "center" });
    doc.moveDown();

    data.forEach((device) => {
      doc
        .fontSize(10)
        .text(
          `ID: ${device.id} | Name: ${device.name} | Type: ${device.DeviceType?.name || "N/A"} | Status: ${device.status === 1 ? "Active" : "Inactive"}`
        );
    });

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
  } catch (err) {
    console.error("Report.exportPDF() Error:", err.message);
    throw new Error(`Failed to export PDF: ${err.message}`);
  }
};

const formatTimestamp = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}_${hour}${minute}${second}`;
};

const parseTimestamp = (value) => {
  const raw = String(value || "");
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const getTimeoutMs = async () => {
  const setup = await settingsService.getAlertSetup();
  const value = Number(setup.processing_time_value || 0);
  const unit = String(setup.processing_time_unit || "minute").toLowerCase();

  if (!Number.isInteger(value) || value <= 0) {
    return 0;
  }

  if (unit === "day") {
    return value * 24 * 60 * 60 * 1000;
  }

  if (unit === "hour") {
    return value * 60 * 60 * 1000;
  }

  return value * 60 * 1000;
};

const isPendingAlarm = (row) => {
  return Number(row?.state) === 0 && String(row?.time_start || "") === String(row?.time_end || "");
};

const serializeAlarm = async (row) => {
  const device = row.Device || (row.device_id ? await Device.findByPk(row.device_id, {
    include: [
      {
        model: DeviceType,
        attributes: ["id", "name", "type"]
      }
    ]
  }) : null);

  const targets = device ? await buildAlarmTargets(device, row.plane_id) : {
    incoming_device_type: "",
    flash_device_ids: row.device_id ? [String(row.device_id)] : [],
    pair_sensor_ids: []
  };

  const deviceName = row.device_name || "";
  const planeName = row.plane_name || "";
  const safeDeviceId = row.device_id || "";
  const safePlaneId = row.plane_id || "";

  return {
    id: row.id,
    report_id: row.id,
    type: "external_alarm",
    created_at: row.created_at,
    status: "PENDING",
    device_id: row.device_id,
    device_name: deviceName,
    plane_id: row.plane_id,
    plane_name: planeName,
    incoming_device_type: targets.incoming_device_type,
    flash_device_ids: targets.flash_device_ids,
    pair_sensor_ids: targets.pair_sensor_ids,
    message: `${safeDeviceId} | ${deviceName}\n${safePlaneId} | ${planeName}`,
    timeout_at: row.timeout_at || null
  };
};

const resolveExpiredAlarms = async () => {
  const timeoutMs = await getTimeoutMs();
  if (timeoutMs <= 0) {
    return [];
  }

  const now = Date.now();
  const rows = await Report.findAll({
    where: { state: 0 },
    order: [["id", "ASC"]]
  });

  const expiredRows = rows.filter((row) => {
    if (!isPendingAlarm(row)) {
      return false;
    }

    const startedAt = parseTimestamp(row.time_start);
    if (!startedAt) {
      return false;
    }

    return now >= (startedAt.getTime() + timeoutMs);
  });

  if (expiredRows.length === 0) {
    return [];
  }

  const resolvedAt = formatTimestamp();
  const io = socket.getIO();

  for (const row of expiredRows) {
    row.state = 0;
    row.time_end = resolvedAt;
    await row.save();

    if (io) {
      io.emit("device_alert", {
        type: "external_alarm_resolved",
        report_id: row.id,
        plane_id: row.plane_id,
        device_id: row.device_id,
        state: row.state,
        reason: "timeout"
      });
    }
  }

  return expiredRows.map((row) => row.id);
};

const getActiveAlarms = async (query = {}) => {
  await resolveExpiredAlarms();

  const timeoutMs = await getTimeoutMs();
  const now = Date.now();
  const normalizedPlaneId = query?.plane_id ? String(query.plane_id).trim() : "";

  const rows = await Report.findAll({
    where: {
      state: 0,
      ...(normalizedPlaneId ? { plane_id: normalizedPlaneId } : {})
    },
    include: [
      {
        model: Device,
        required: false,
        include: [
          {
            model: DeviceType,
            attributes: ["id", "name", "type"]
          }
        ]
      }
    ],
    order: [["created_at", "DESC"]]
  });

  const pendingRows = rows.filter((row) => isPendingAlarm(row));

  const mapped = [];
  for (const row of pendingRows) {
    const alarm = await serializeAlarm(row);
    const startedAt = parseTimestamp(row.time_start);
    alarm.timeout_at = startedAt && timeoutMs > 0
      ? new Date(startedAt.getTime() + timeoutMs).toISOString()
      : null;
    alarm.remaining_ms = startedAt && timeoutMs > 0
      ? Math.max(0, (startedAt.getTime() + timeoutMs) - now)
      : 0;
    mapped.push(alarm);
  }

  return mapped;
};

const updateProcessState = async (reportId, payload = {}, authUser = null) => {
  const normalizedId = Number(reportId);
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    const invalidError = new Error("Invalid report id");
    invalidError.status = 400;
    throw invalidError;
  }

  const nextState = Number(payload.state);
  if (![1, 2].includes(nextState)) {
    const stateError = new Error("state must be 1 or 2");
    stateError.status = 400;
    throw stateError;
  }

  const row = await Report.findByPk(normalizedId);
  if (!row) {
    const notFoundError = new Error("Report not found");
    notFoundError.status = 404;
    throw notFoundError;
  }

  let actor = null;
  if (authUser?.id) {
    actor = await User.findByPk(authUser.id);
  }

  row.state = nextState;
  row.time_end = formatTimestamp();
  row.description = String(payload.description || "").trim();

  if (nextState === 1 && actor) {
    const confirmedByName = String(actor.full_name || actor.username || "").trim() || String(actor.username || "").trim();
    row.confirmed_by_id = actor.id;
    row.confirmed_by_name = confirmedByName;
    row.confirmed_at = new Date();
    row.user_id = actor.id;
    row.user_full_name = confirmedByName;
    row.username = actor.username;
  }

  await row.save();

  const io = socket.getIO();
  if (io) {
    io.emit("device_alert", {
      type: "external_alarm_resolved",
      report_id: row.id,
      plane_id: row.plane_id,
      device_id: row.device_id,
      state: row.state
    });
  }

  return {
    id: row.id,
    state: row.state,
    time_start: row.time_start,
    time_end: row.time_end,
    created_at: row.created_at || "",
    updated_at: row.updated_at || "",
    device_id: row.device_id,
    plane_id: row.plane_id,
    user_id: row.user_id,
    confirmed_by_id: row.confirmed_by_id || null,
    confirmed_by_name: row.confirmed_by_name || "N/A",
    confirmed_at: row.confirmed_at || null,
    description: row.description || ""
  };
};

const updateAllActiveProcessState = async (payload = {}, authUser = null) => {
  const nextState = Number(payload.state);
  if (![1, 2].includes(nextState)) {
    const stateError = new Error("state must be 1 or 2");
    stateError.status = 400;
    throw stateError;
  }

  await resolveExpiredAlarms();

  const rows = await Report.findAll({
    where: {
      state: 0,
      time_start: {
        [Op.col]: "time_end"
      }
    },
    order: [["id", "ASC"]]
  });

  const result = [];
  for (const row of rows) {
    const updated = await updateProcessState(row.id, {
      state: nextState,
      description: payload.description
    }, authUser);
    result.push(updated);
  }

  return result;
};

const formatDateToken = (dateValue, endOfDay = false) => {
  if (!dateValue) {
    return null;
  }

  let year = "";
  let month = "";
  let day = "";

  const raw = String(dateValue).trim();
  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    [, year, month, day] = ymdMatch;
  } else {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    year = String(parsed.getFullYear());
    month = String(parsed.getMonth() + 1).padStart(2, "0");
    day = String(parsed.getDate()).padStart(2, "0");
  }

  const timePart = endOfDay ? "235959" : "000000";
  return `${year}${month}${day}_${timePart}`;
};

const buildHistoryWhere = (query = {}) => {
  const where = {};
  const fromToken = formatDateToken(query.fromDate, false);
  const toToken = formatDateToken(query.toDate, true);

  if (fromToken && toToken) {
    where.time_start = {
      [Op.between]: [fromToken, toToken]
    };
    return where;
  }

  if (fromToken) {
    where.time_start = {
      [Op.gte]: fromToken
    };
  }

  if (toToken) {
    where.time_start = {
      [Op.lte]: toToken
    };
  }

  return where;
};

const resolvePagination = (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize, 10) || 20));
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset };
};

const mapStateLabel = (state) => {
  if (Number(state) === 1) return "Đã xử lý";
  if (Number(state) === 2) return "Bỏ qua";
  return "Chưa xử lý";
};

const mapConfirmedByName = (row) => {
  return String(row?.confirmed_by_name || "").trim() || "N/A";
};

const mapConfirmedAt = (row) => {
  if (!row?.confirmed_at) {
    return "N/A";
  }

  return toDisplayDate(row.confirmed_at);
};

const listHistoryReports = async (query = {}) => {
  const where = buildHistoryWhere(query);
  const { page, pageSize, offset } = resolvePagination(query);

  const result = await Report.findAndCountAll({
    where,
    order: [["created_at", "DESC"]],
    limit: pageSize,
    offset
  });

  const items = result.rows.map((row, index) => ({
    stt: offset + index + 1,
    id: row.id,
    camera_name: row.device_name || "",
    camera_id: row.device_id || "",
    plane_name: row.plane_name || "",
    plane_id: row.plane_id || "",
    state: Number(row.state),
    state_label: mapStateLabel(row.state),

    time_start: row.time_start || "",
    time_end: row.time_end || "",

    created_at: toVietnamDateTime(row.created_at),
    updated_at: toVietnamDateTime(row.updated_at),

    confirmed_by_id: row.confirmed_by_id || null,
    confirmed_by_name: mapConfirmedByName(row),
    confirmed_at: mapConfirmedAt(row),

    description: row.description || "",
    user_id: row.user_full_name || row.username || row.user_id || ""
  }));

  return {
    items,
    pagination: {
      page,
      pageSize,
      total: result.count,
      totalPages: Math.max(1, Math.ceil(result.count / pageSize))
    }
  };
};

const getHistoryRowsForExport = async (query = {}) => {
  const where = buildHistoryWhere(query);
  const rows = await Report.findAll({
    where,
    order: [["created_at", "DESC"]]
  });

  return rows.map((row, index) => ({
    stt: index + 1,
    camera_name: row.device_name || "",
    camera_id: row.device_id || "",
    plane_name: row.plane_name || "",
    plane_id: row.plane_id || "",
    state_label: mapStateLabel(row.state),
    time_start: row.time_start || "",
    time_end: row.time_end || "",
    created_at: toVietnamDateTime(row.created_at),
    updated_at: toVietnamDateTime(row.updated_at),
    confirmed_by_name: mapConfirmedByName(row),
    confirmed_at: mapConfirmedAt(row),
    description: row.description || "",
    user_id: row.user_full_name || row.username || row.user_id || ""
  }));
};

const getDeviceRowsForExport = async () => {
  const rows = await Device.findAll({
    include: [
      {
        model: DeviceType,
        attributes: ["name", "type"],
        required: false
      }
    ],
    order: [["id", "ASC"]]
  });

  return rows.map((row, index) => ({
    stt: index + 1,
    id: row.id,
    name: row.name || "",
    model: row.DeviceType?.name || "",
    device_type: row.DeviceType?.type || "",
    status_label: Number(row.status) === 1 ? "Đã đính kèm mặt phẳng" : "Chưa đính kèm mặt phẳng",
    rtsp1_label: Number(row.rtsp1_status) === 1 ? "Có" : "Không",
    rtsp2_label: Number(row.rtsp2_status) === 1 ? "Có" : "Không",
    pair: Number(row.pair || 0),
    link: Number(row.link || 0),
    modbus_label: String(row.modbus || "").trim() ? "Có" : "Không",
    description: row.description || "",
    created_at: toVietnamDateTime(row.created_at),
    updated_at: toVietnamDateTime(row.updated_at)
  }));
};

const getPlaneRowsForExport = async () => {
  const rows = await Plane.findAll({
    order: [["id", "ASC"]]
  });

  const planeNameById = new Map(rows.map((row) => [String(row.id), row.name || ""]));

  return rows.map((row, index) => ({
    stt: index + 1,
    id: row.id,
    name: row.name || "",
    type: row.type || "",
    parent_name: row.parent_id ? (planeNameById.get(String(row.parent_id)) || "") : "",
    description: row.description || "",
    created_at: toVietnamDateTime(row.created_at),
    updated_at: toVietnamDateTime(row.updated_at)
  }));
};

const styleWorksheetAsTable = (sheet, totalColumns) => {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E78" }
  };

  for (let rowIndex = 1; rowIndex <= sheet.rowCount; rowIndex += 1) {
    for (let colIndex = 1; colIndex <= totalColumns; colIndex += 1) {
      const cell = sheet.getCell(rowIndex, colIndex);
      cell.border = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } }
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: colIndex === 1 ? "center" : "left",
        wrapText: true
      };
    }
  }
};

const buildExcelBuffer = async ({ sheetName, columns, rows }) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns;
  rows.forEach((row) => sheet.addRow(row));
  styleWorksheetAsTable(sheet, columns.length);
  return workbook.xlsx.writeBuffer();
};

const toDisplayDate = (value) => {
  return toVietnamDateTime(value);
};

const buildPdfBuffer = async ({ title, rows }) => {
  const doc = new PDFDocument({
    size: "A4",
    margin: 28,
    layout: "landscape"
  });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  doc.fontSize(16).fillColor("#0F172A").text(title, { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor("#475569").text(`Exported at: ${new Date().toISOString()}`, { align: "center" });
  doc.moveDown(0.8);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columns = Object.keys(rows[0] || {
    stt: "",
    col1: "",
    col2: ""
  });
  const columnLabelMap = {
    stt: "STT",
    camera_name: "Tên Camera",
    camera_id: "ID Camera",
    plane_name: "Tên mặt phẳng",
    plane_id: "ID mặt phẳng",
    state_label: "Trạng thái",
    time_start: "Bắt đầu cảnh báo",
    time_end: "Kết thúc cảnh báo",
    confirmed_by_name: "Người xác nhận",
    // confirmed_at: "Thời gian xác nhận",
    description: "Nội dung cảnh báo",
    // user_id: "Người phụ trách",
    id: "ID",
    name: "Tên",
    model: "Model",
    device_type: "Loại thiết bị",
    status_label: "Trạng thái",
    rtsp1_label: "Luồng Mainstream",
    rtsp2_label: "Luồng Substream",
    pair: "Ghép đôi Sensor",
    link: "Liên kết thiết bị",
    modbus_label: "Modbus",
    created_at: "Ngày tạo",
    updated_at: "Ngày cập nhật",
    type: "Loại mặt phẳng",
    parent_name: "Mặt phẳng cha"
  };
  const colWidth = pageWidth / columns.length;
  let y = doc.y;

  const renderHeader = () => {
    doc.save();
    doc.rect(doc.page.margins.left, y, pageWidth, 20).fill("#1F4E78");
    doc.fillColor("#FFFFFF").fontSize(8);

    columns.forEach((column, index) => {
      const x = doc.page.margins.left + index * colWidth + 2;
      const label = String(columnLabelMap[column] || column);
      doc.text(label, x, y + 5, {
        width: colWidth - 4,
        height: 10,
        ellipsis: true
      });
    });
    doc.restore();
    y += 20;
  };

  renderHeader();

  rows.forEach((row, rowIndex) => {
    if (y > doc.page.height - doc.page.margins.bottom - 18) {
      doc.addPage();
      y = doc.page.margins.top;
      renderHeader();
    }

    if (rowIndex % 2 === 0) {
      doc.save();
      doc.rect(doc.page.margins.left, y, pageWidth, 18).fill("#F8FAFC");
      doc.restore();
    }

    doc.fillColor("#0F172A").fontSize(8);
    columns.forEach((column, index) => {
      const x = doc.page.margins.left + index * colWidth + 2;
      doc.text(String(toDisplayDate(row[column]) || ""), x, y + 4, {
        width: colWidth - 4,
        height: 10,
        ellipsis: true
      });
    });

    y += 18;
  });

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
};

const buildHistoryFileName = (extension) => `Lich_su_canh_bao_${formatTimestamp()}.${extension}`;
const buildDeviceFileName = (extension) => `Danh_sach_thiet_bi_${formatTimestamp()}.${extension}`;
const buildPlaneFileName = (extension) => `Danh_sach_mat_phang_${formatTimestamp()}.${extension}`;

const exportHistoryExcel = async (query = {}) => {
  const rows = await getHistoryRowsForExport(query);
  const buffer = await buildExcelBuffer({
    sheetName: "Lịch sử cảnh báo",
    columns: [
      { header: "STT", key: "stt", width: 8 },
      { header: "Tên Camera", key: "camera_name", width: 24 },
      { header: "ID Camera", key: "camera_id", width: 14 },
      { header: "Tên mặt phẳng", key: "plane_name", width: 24 },
      { header: "ID mặt phẳng", key: "plane_id", width: 14 },
      { header: "Trạng thái", key: "state_label", width: 16 },
      { header: "Bắt đầu cảnh báo", key: "created_at", width: 18 },
      { header: "Kết thúc cảnh báo", key: "updated_at", width: 18 },
      { header: "Người xác nhận", key: "confirmed_by_name", width: 20 },
      // { header: "Thời gian xác nhận", key: "confirmed_at", width: 20 },
      { header: "Nội dung cảnh báo", key: "description", width: 36 }
      // { header: "Người phụ trách", key: "user_id", width: 16 }
    ],
    rows
  });

  return {
    fileName: buildHistoryFileName("xlsx"),
    buffer
  };
};

const exportHistoryPDF = async (query = {}) => {
  const rows = await getHistoryRowsForExport(query);
  const buffer = await buildPdfBuffer({
    title: "Lịch sử cảnh báo",
    rows
  });

  return {
    fileName: buildHistoryFileName("pdf"),
    buffer
  };
};

const exportDeviceExcel = async () => {
  const rows = await getDeviceRowsForExport();
  const buffer = await buildExcelBuffer({
    sheetName: "Danh sách thiết bị",
    columns: [
      { header: "STT", key: "stt", width: 8 },
      { header: "ID Thiết bị", key: "id", width: 12 },
      { header: "Tên thiết bị", key: "name", width: 24 },
      { header: "Loại thiết bị", key: "device_type", width: 14 },
      { header: "Trạng thái", key: "status_label", width: 24 },
      { header: "Luồng Mainstream", key: "rtsp1_label", width: 14 },
      { header: "Luồng Substream", key: "rtsp2_label", width: 14 },
      { header: "Ghép đôi Sensor", key: "pair", width: 14 },
      { header: "Liên kết thiết bị", key: "link", width: 14 },
      { header: "Modbus", key: "modbus_label", width: 12 },
      { header: "Mô tả", key: "description", width: 28 },
      { header: "Ngày tạo", key: "created_at", width: 20 },
      { header: "Ngày cập nhật", key: "updated_at", width: 20 }
    ],
    rows
  });

  return {
    fileName: buildDeviceFileName("xlsx"),
    buffer
  };
};

const exportDevicePDF = async () => {
  const rows = await getDeviceRowsForExport();
  const buffer = await buildPdfBuffer({
    title: "Danh sách thiết bị",
    rows
  });

  return {
    fileName: buildDeviceFileName("pdf"),
    buffer
  };
};

const exportPlaneExcel = async () => {
  const rows = await getPlaneRowsForExport();
  const buffer = await buildExcelBuffer({
    sheetName: "Danh sách mặt phẳng",
    columns: [
      { header: "STT", key: "stt", width: 8 },
      { header: "ID mặt phẳng", key: "id", width: 14 },
      { header: "Tên mặt phẳng", key: "name", width: 24 },
      { header: "Loại mặt phẳng", key: "type", width: 14 },
      { header: "Mặt phẳng cha", key: "parent_name", width: 24 },
      { header: "Mô tả", key: "description", width: 30 },
      { header: "Ngày tạo", key: "created_at", width: 20 },
      { header: "Ngày cập nhật", key: "updated_at", width: 20 }
    ],
    rows
  });

  return {
    fileName: buildPlaneFileName("xlsx"),
    buffer
  };
};

const exportPlanePDF = async () => {
  const rows = await getPlaneRowsForExport();
  const buffer = await buildPdfBuffer({
    title: "Danh sách mặt phẳng",
    rows
  });

  return {
    fileName: buildPlaneFileName("pdf"),
    buffer
  };
};

module.exports = {
  fetchData,
  exportExcel,
  exportPDF,
  listHistoryReports,
  exportHistoryExcel,
  exportHistoryPDF,
  exportDeviceExcel,
  exportDevicePDF,
  exportPlaneExcel,
  exportPlanePDF,
  mapStateLabel,
  buildHistoryWhere,
  formatTimestamp,
  updateProcessState,
  getActiveAlarms,
  updateAllActiveProcessState,
  resolveExpiredAlarms
};