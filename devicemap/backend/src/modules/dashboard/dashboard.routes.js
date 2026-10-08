const router = require("express").Router();
const controller = require("./dashboard.controller");

router.get("/", controller.getDashboard);
router.get("/export/pdf", controller.exportDashboardPdf);

module.exports = router;
