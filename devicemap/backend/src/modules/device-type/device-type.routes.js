const router = require("express").Router();
const controller = require("./device-type.controller");

router.get("/", controller.getAll);
router.get("/next-id", controller.getNextId);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
