const router = require("express").Router();
const controller = require("./monitor.controller");

router.get("/plane/:planeId", controller.getByPlane);
router.put("/plane/:planeId", controller.saveByPlane);

module.exports = router;
