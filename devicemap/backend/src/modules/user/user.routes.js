const fs = require("fs");
const path = require("path");
const multer = require("multer");
const router = require("express").Router();
const controller = require("./user.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const roleMiddleware = require("../../middlewares/role.middleware");

const uploadDir = process.env.USER_AVATAR_DIR || "/app/image/user";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext || ".png"}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/svg+xml"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Invalid file type"));
  }
});

router.use(authMiddleware);
router.use(roleMiddleware(["ADMIN"]));

router.get("/", controller.getAll);
router.get("/:id", controller.getById);
router.post("/", upload.single("avatar"), controller.create);
router.put("/:id", upload.single("avatar"), controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
