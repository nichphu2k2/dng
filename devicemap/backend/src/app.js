const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

app.set("trust proxy", 1);

app.use(cors({
  origin: "*",
  methods: [
    "GET",
    "POST",
    "PUT",
    "DELETE"
  ],
  exposedHeaders: [
    "Content-Disposition"
  ]
}));

app.use(express.json());

// Serve uploaded files (IMPORTANT: Add this BEFORE routes)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
const imageRootDir = process.env.IMAGE_ROOT_DIR || "/app/image";
if (!fs.existsSync(imageRootDir)) {
  fs.mkdirSync(imageRootDir, { recursive: true });
}
app.use("/image", express.static(imageRootDir));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

const routes = require("./routes");

app.use(routes);

app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error("[ERROR]", {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack
  });
  
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err : {}
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});

module.exports = app;