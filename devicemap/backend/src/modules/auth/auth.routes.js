const router = require("express").Router();
const controller = require("./auth.controller");
const authMiddleware = require("../../middlewares/auth.middleware");

router.use((req, res, next) => {
	res.set("Cache-Control", "no-store");
	next();
});

router.post("/login", controller.login);
router.get("/session", authMiddleware, controller.session);
router.put("/change-password", authMiddleware, controller.changePassword);
router.post("/logout", authMiddleware, controller.logout);

module.exports = router;
