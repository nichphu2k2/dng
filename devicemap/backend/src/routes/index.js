const router = require("express").Router();

const authRoutes = require("../modules/auth/auth.routes");
const planeRoutes = require("../modules/plane/plane.routes");
const deviceRoutes = require("../modules/device/device.routes");
const deviceTypeRoutes = require("../modules/device-type/device-type.routes");
const reportRoutes = require("../modules/report/report.routes");
const dashboardRoutes = require("../modules/dashboard/dashboard.routes");
const monitorRoutes = require("../modules/monitor/monitor.routes");
const settingsRoutes = require("../modules/settings/settings.routes");
const devicemapRoutes = require("../modules/devicemap/devicemap.routes");
const userRoutes = require("../modules/user/user.routes");

const authMiddleware = require("../middlewares/auth.middleware");

router.use("/api/auth", authRoutes);
router.use("/api/devicemap", devicemapRoutes);
router.use("/api", authMiddleware);

router.use("/api/planes", planeRoutes);
router.use("/api/devices", deviceRoutes);
router.use("/api/device-types", deviceTypeRoutes);
router.use("/api/reports", reportRoutes);
router.use("/api/dashboard", dashboardRoutes);
router.use("/api/monitors", monitorRoutes);
router.use("/api/settings", settingsRoutes);
router.use("/api/users", userRoutes);

module.exports = router;