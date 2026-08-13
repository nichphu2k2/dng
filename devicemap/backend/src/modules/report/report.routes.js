const router = require("express").Router();
const controller = require("./report.controller");

router.get("/", controller.listReports);
router.get("/export/excel/history", controller.exportHistoryExcel);
router.get("/export/excel/devices", controller.exportDeviceExcel);
router.get("/export/excel/planes", controller.exportPlaneExcel);
router.get("/export/pdf/history", controller.exportHistoryPdf);
router.get("/export/pdf/devices", controller.exportDevicePdf);
router.get("/export/pdf/planes", controller.exportPlanePdf);

router.get("/alerts/export/excel", controller.exportExcel);
router.get("/alerts/export/pdf", controller.exportPDF);
router.get("/alerts", controller.getAlerts);
router.get("/active-alarms", controller.getActiveAlarms);
router.put("/process-all", controller.updateAllActiveProcessState);
router.put("/:id/process", controller.updateProcessState);

module.exports = router;