const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { QueryTypes } = require("sequelize");

const sequelize = require("../../config/database");
const { formatTimestamp } = require("../report/report.service");

const mapBuckets = (rows, interval) => {
  return rows.map((row) => {
    const rawBucket = String(row.bucket || "");
    if (interval === "month") {
      return {
        label: `${rawBucket.slice(0, 4)}-${rawBucket.slice(4, 6)}`,
        count: Number(row.total || 0)
      };
    }

    return {
      label: `${rawBucket.slice(0, 4)}-${rawBucket.slice(4, 6)}-${rawBucket.slice(6, 8)}`,
      count: Number(row.total || 0)
    };
  });
};

const getDashboardData = async (query = {}) => {
  const interval = String(query.interval || "day").toLowerCase() === "month" ? "month" : "day";
  const bucketExpr = interval === "month" ? "SUBSTRING(time_start, 1, 6)" : "SUBSTRING(time_start, 1, 8)";
  const bucketLimit = interval === "month" ? 12 : 30;

  const statsRows = await sequelize.query(
    `
      SELECT
        SUM(CASE WHEN dt.type = 'Camera' AND d.status = 1 THEN 1 ELSE 0 END) AS active_cameras,
        SUM(CASE WHEN dt.type = 'Camera' THEN 1 ELSE 0 END) AS total_cameras,
        SUM(CASE WHEN d.status = 1 THEN 1 ELSE 0 END) AS active_devices,
        COUNT(*) AS total_devices,
        SUM(CASE WHEN dt.type = 'Sensor' AND d.status = 1 THEN 1 ELSE 0 END) AS active_sensors,
        SUM(CASE WHEN dt.type = 'Sensor' THEN 1 ELSE 0 END) AS total_sensors
      FROM devices d
      LEFT JOIN device_types dt ON d.device_type_id = dt.id
    `,
    { type: QueryTypes.SELECT }
  );

  const planeRows = await sequelize.query(
    `SELECT COUNT(*) AS total_planes FROM planes`,
    { type: QueryTypes.SELECT }
  );

  const reportRows = await sequelize.query(
    `
      SELECT
        COUNT(*) AS total_reports,
        SUM(CASE WHEN state = 1 THEN 1 ELSE 0 END) AS processed_reports,
        SUM(CASE WHEN state = 0 THEN 1 ELSE 0 END) AS pending_reports,
        SUM(CASE WHEN state = 2 THEN 1 ELSE 0 END) AS ignored_reports
      FROM reports
    `,
    { type: QueryTypes.SELECT }
  );

  const chartRows = await sequelize.query(
    `
      SELECT bucket, total
      FROM (
        SELECT ${bucketExpr} AS bucket, COUNT(*) AS total
        FROM reports
        GROUP BY ${bucketExpr}
        ORDER BY ${bucketExpr} DESC
        LIMIT :limitValue
      ) src
      ORDER BY bucket ASC
    `,
    {
      type: QueryTypes.SELECT,
      replacements: {
        limitValue: bucketLimit
      }
    }
  );

  const stats = statsRows[0] || {};
  const planes = planeRows[0] || {};
  const reports = reportRows[0] || {};

  return {
    interval,
    camera: {
      active: Number(stats.active_cameras || 0),
      total: Number(stats.total_cameras || 0)
    },
    device: {
      active: Number(stats.active_devices || 0),
      total: Number(stats.total_devices || 0)
    },
    sensor: {
      active: Number(stats.active_sensors || 0),
      total: Number(stats.total_sensors || 0)
    },
    planes: {
      total: Number(planes.total_planes || 0)
    },
    reports: {
      processed: Number(reports.processed_reports || 0),
      pending: Number(reports.pending_reports || 0),
      ignored: Number(reports.ignored_reports || 0),
      total: Number(reports.total_reports || 0)
    },
    alert_chart: mapBuckets(chartRows, interval)
  };
};

const tryEmbedLogo = (doc) => {
  const candidateFiles = [
    path.join(__dirname, "../../../../frontend/src/assets/company-logo.jpg"),
    path.join(__dirname, "../../../../frontend/src/assets/company-logo.png")
  ];

  const found = candidateFiles.find((filePath) => fs.existsSync(filePath));
  if (!found) {
    return;
  }

  try {
    doc.image(found, doc.page.margins.left, 18, {
      fit: [48, 48]
    });
  } catch {
    // Skip invalid logo formats.
  }
};

const exportDashboardPdf = async (query = {}) => {
  const dashboard = await getDashboardData(query);
  const doc = new PDFDocument({ size: "A4", margin: 24 });
  const chunks = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  tryEmbedLogo(doc);

  doc.fontSize(18).fillColor("#0F172A").text("Dashboard Report", 0, 24, {
    align: "center"
  });
  doc.fontSize(10).fillColor("#64748B").text(`Exported at: ${new Date().toISOString()}`, {
    align: "center"
  });

  const cardY = 88;
  const cardWidth = 170;
  const cardHeight = 70;
  const gap = 10;
  const cardColors = ["#DBEAFE", "#DCFCE7", "#FEE2E2", "#EDE9FE"];
  const cards = [
    {
      title: "Camera",
      value: `${dashboard.camera.active}/${dashboard.camera.total}`
    },
    {
      title: "Device",
      value: `${dashboard.device.active}/${dashboard.device.total}`
    },
    {
      title: "Sensor",
      value: `${dashboard.sensor.active}/${dashboard.sensor.total}`
    },
    {
      title: "Total Planes",
      value: String(dashboard.planes.total)
    }
  ];

  cards.forEach((card, index) => {
    const x = doc.page.margins.left + index * (cardWidth + gap);
    doc.save();
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 8).fill(cardColors[index]);
    doc.restore();
    doc.fillColor("#0F172A").fontSize(10).text(card.title, x + 10, cardY + 12);
    doc.fontSize(20).text(card.value, x + 10, cardY + 32);
  });

  doc.moveTo(doc.page.margins.left, 182).lineTo(doc.page.width - doc.page.margins.right, 182).strokeColor("#E2E8F0").stroke();

  doc.fontSize(13).fillColor("#0F172A").text(`Alert Trend (${dashboard.interval})`, doc.page.margins.left, 196);

  const chartX = doc.page.margins.left;
  const chartY = 224;
  const chartWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const chartHeight = 180;

  doc.save();
  doc.rect(chartX, chartY, chartWidth, chartHeight).strokeColor("#CBD5E1").stroke();
  doc.restore();

  const points = dashboard.alert_chart;
  if (points.length > 1) {
    const maxValue = Math.max(...points.map((point) => point.count), 1);
    const stepX = chartWidth / (points.length - 1);

    doc.save();
    doc.strokeColor("#2563EB").lineWidth(2);

    points.forEach((point, index) => {
      const x = chartX + index * stepX;
      const y = chartY + chartHeight - ((point.count / maxValue) * (chartHeight - 24)) - 12;

      if (index === 0) {
        doc.moveTo(x, y);
      } else {
        doc.lineTo(x, y);
      }

      doc.circle(x, y, 2).fillAndStroke("#2563EB", "#2563EB");
      doc.fillColor("#334155").fontSize(7).text(point.label, x - 18, chartY + chartHeight + 4, {
        width: 36,
        align: "center"
      });
    });

    doc.stroke();
    doc.restore();
  }

  doc.fontSize(13).fillColor("#0F172A").text("Report Processing", doc.page.margins.left, 430);
  doc.fontSize(10).fillColor("#334155").text(`Processed: ${dashboard.reports.processed}/${dashboard.reports.total}`, doc.page.margins.left, 452);
  doc.fontSize(10).fillColor("#334155").text(`Pending: ${dashboard.reports.pending}/${dashboard.reports.total}`, doc.page.margins.left + 220, 452);
  doc.fontSize(10).fillColor("#334155").text(`Ignored: ${dashboard.reports.ignored}/${dashboard.reports.total}`, doc.page.margins.left + 420, 452);

  doc.end();

  const buffer = await new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  return {
    fileName: `Dashboard_${formatTimestamp()}.pdf`,
    buffer
  };
};

module.exports = {
  getDashboardData,
  exportDashboardPdf
};
