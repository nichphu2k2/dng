require("dotenv").config();

const http = require("http");
const { DataTypes } = require("sequelize");
const app = require("./app");
const sequelize = require("./config/database");
const socket = require("./config/socket");
const reportService = require("./modules/report/report.service");
const mediaMtxService = require("./services/mediaMtx.service");
const nxService = require("./services/nx.service");
const authService = require("./modules/auth/auth.service");

// Load all models and associations
require("./models/index");

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be configured in production");
}

const PORT = 3000;

const server = http.createServer(app);

let alarmTimeoutWorker = null;

const ensureReportsSchema = async () => {
  const queryInterface = sequelize.getQueryInterface();

  try {
    const tableDefinition = await queryInterface.describeTable("reports");
    if (!tableDefinition?.user_id) {
      return;
    }

    if (tableDefinition.user_id.allowNull) {
      return;
    }

    await queryInterface.changeColumn("reports", "user_id", {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: "users",
        key: "id"
      }
    });

    console.log("✓ Reports schema updated: user_id now allows NULL");
  } catch (err) {
    console.warn("⚠ Could not align reports schema:", err.message);
  }
};

const ensureReportsConfirmationSchema = async () => {
  const queryInterface = sequelize.getQueryInterface();

  try {
    const tableDefinition = await queryInterface.describeTable("reports");

    if (!tableDefinition?.confirmed_by_id) {
      await queryInterface.addColumn("reports", "confirmed_by_id", {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: "users",
          key: "id"
        },
        onDelete: "SET NULL"
      });
      console.log("✓ Reports schema updated: added confirmed_by_id");
    }

    if (!tableDefinition?.confirmed_by_name) {
      await queryInterface.addColumn("reports", "confirmed_by_name", {
        type: DataTypes.STRING(255),
        allowNull: true
      });
      console.log("✓ Reports schema updated: added confirmed_by_name");
    }

    if (!tableDefinition?.confirmed_at) {
      await queryInterface.addColumn("reports", "confirmed_at", {
        type: DataTypes.DATE,
        allowNull: true
      });
      console.log("✓ Reports schema updated: added confirmed_at");
    }

    const indexes = await queryInterface.showIndex("reports");
    const hasConfirmedByIndex = indexes.some((index) => index.name === "idx_reports_confirmed_by");
    if (!hasConfirmedByIndex) {
      await queryInterface.addIndex("reports", ["confirmed_by_id"], {
        name: "idx_reports_confirmed_by"
      });
      console.log("✓ Reports schema updated: added idx_reports_confirmed_by");
    }
  } catch (err) {
    console.warn("⚠ Could not align reports confirmation schema:", err.message);
  }
};

const startAlarmTimeoutWorker = () => {
  if (alarmTimeoutWorker) {
    clearInterval(alarmTimeoutWorker);
  }

  alarmTimeoutWorker = setInterval(async () => {
    try {
      await reportService.resolveExpiredAlarms();
    } catch (err) {
      console.warn("⚠ Alarm timeout worker error:", err.message);
    }
  }, 5000);
};

console.log("🚀 Starting server...");
sequelize.authenticate()
  .then(async () => {
    console.log("✓ Database Connected");

    // Sync models (creates tables if they don't exist)
    try {
      await sequelize.sync({ alter: false });
      console.log("✓ Database Models Synced");
      await ensureReportsSchema();
      await ensureReportsConfirmationSchema();
      await authService.ensureDefaultAdmin();
      console.log("✓ Default admin ensured");
    } catch (syncErr) {
      console.warn("⚠ Database sync warning (tables may already exist):", syncErr.message);
    }

    try {
      await mediaMtxService.refreshAllCameraStreams();
      console.log("✓ MediaMTX RTSP streams refreshed");
    } catch (rtspErr) {
      console.warn("⚠ RTSP refresh skipped:", rtspErr.message);
    }

    socket.init(server);
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`✓ Server running at http://0.0.0.0:${PORT}`);
    });

    startAlarmTimeoutWorker();
    nxService.startWorkers();
    console.log("✓ NX Server sync workers started");
  })
  .catch((err) => {
    console.log("❌ Database connection failed");
    console.error(err);
    process.exit(1);
  });