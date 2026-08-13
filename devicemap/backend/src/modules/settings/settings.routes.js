const router = require("express").Router();
const controller = require("./settings.controller");

router.get("/line-parameters", controller.getLineParameters);
router.put("/line-parameters", controller.updateLineParameters);

router.get("/alert-setup", controller.getAlertSetup);
router.put("/alert-setup", controller.updateAlertSetup);
router.post("/refresh-rtsp", controller.refreshRtsp);

module.exports = router;
