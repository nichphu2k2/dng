const service = require("./dashboard.service");

const getDashboard = async (req, res) => {
  try {
    const data = await service.getDashboardData(req.query || {});
    res.json({
      success: true,
      data
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
};

const exportDashboardPdf = async (req, res) => {
  try {
    const result = await service.exportDashboardPdf(req.query || {});
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${result.fileName}`);
    res.send(result.buffer);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
};

module.exports = {
  getDashboard,
  exportDashboardPdf
};
