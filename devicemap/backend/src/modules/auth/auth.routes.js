const router = require("express").Router();
const controller = require("./auth.controller");
const authMiddleware = require("../../middlewares/auth.middleware");

router.post("/login", controller.login);
router.put("/change-password", authMiddleware, controller.changePassword);
router.post("/logout", authMiddleware, controller.logout);

module.exports = router;
