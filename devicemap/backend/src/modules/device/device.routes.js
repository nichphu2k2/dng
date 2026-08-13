const router = require("express").Router();
const multer = require("multer");
const controller = require("./device.controller");

const upload = multer({
	storage: multer.memoryStorage(),
	fileFilter: (req, file, cb) => {
		const allowed = ["image/jpeg", "image/png", "image/svg+xml"];
		if (allowed.includes(file.mimetype)) {
			cb(null, true);
			return;
		}

		cb(new Error("Invalid file type"));
	}
});

// Specific routes first (before parameterized routes)
router.get("/code/:deviceCode", controller.getByCode);

// General routes
router.get("/", controller.getAll);
router.get("/next-id", controller.getNextId);
router.post("/", upload.array("icons", 2), controller.create);

// Parameterized routes last.
router.post("/:id/off", controller.turnOff);
router.get("/:id", controller.getById);
router.put("/:id", upload.array("icons", 2), controller.update);
router.delete("/:id", controller.remove);

module.exports = router;