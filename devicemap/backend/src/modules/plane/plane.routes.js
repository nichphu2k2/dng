const router = require("express").Router();
const multer = require("multer");
const controller = require("./plane.controller");

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

router.get("/", controller.getAll);
router.get("/next-id", controller.getNextId);
router.post("/", upload.single("image"), controller.create);
router.put("/:id", upload.single("image"), controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
