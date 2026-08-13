import { useEffect, useMemo, useState } from "react";
import { Segmented, Spin } from "antd";

import { getDashboard } from "../api/dashboard";

const buildPolyline = (points, width, height) => {
  if (!Array.isArray(points) || points.length === 0) {
    return "";
  }

  const max = Math.max(...points.map((point) => Number(point.count || 0)), 1);
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;

  return points
    .map((point, index) => {
      const x = index * stepX;
      const y = height - ((Number(point.count || 0) / max) * (height - 20)) - 10;
      return `${x},${y}`;
    })
    .join(" ");
};

export default function Dashboard() {
  const [interval, setInterval] = useState("day");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    camera: { active: 0, total: 0 },
    device: { active: 0, total: 0 },
    sensor: { active: 0, total: 0 },
    planes: { total: 0 },
    reports: { processed: 0, pending: 0, ignored: 0, total: 0 },
    alert_chart: []
  });

  const loadDashboard = async (nextInterval = interval) => {
    setLoading(true);
    try {
      const res = await getDashboard({ interval: nextInterval });
      setData(res?.data?.data || {
        camera: { active: 0, total: 0 },
        device: { active: 0, total: 0 },
        sensor: { active: 0, total: 0 },
        planes: { total: 0 },
        reports: { processed: 0, pending: 0, ignored: 0, total: 0 },
        alert_chart: []
      });
    } catch (err) {
      setData({
        camera: { active: 0, total: 0 },
        device: { active: 0, total: 0 },
        sensor: { active: 0, total: 0 },
        planes: { total: 0 },
        reports: { processed: 0, pending: 0, ignored: 0, total: 0 },
        alert_chart: []
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval]);

  const polylinePoints = useMemo(() => buildPolyline(data.alert_chart || [], 760, 220), [data.alert_chart]);

  const processBars = useMemo(() => {
    const total = Math.max(1, Number(data.reports.total || 0));
    return [
      {
        key: "processed",
        label: "Đã xử lý",
        value: Number(data.reports.processed || 0),
        color: "#16a34a",
        ratio: (Number(data.reports.processed || 0) / total) * 100
      },
      {
        key: "pending",
        label: "Chưa xử lý",
        value: Number(data.reports.pending || 0),
        color: "#f59e0b",
        ratio: (Number(data.reports.pending || 0) / total) * 100
      },
      {
        key: "ignored",
        label: "Bỏ qua",
        value: Number(data.reports.ignored || 0),
        color: "#ef4444",
        ratio: (Number(data.reports.ignored || 0) / total) * 100
      }
    ];
  }, [data.reports]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 120 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <section className="page-hero">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Tổng quan hệ thống</h1>
          <p>Thống kê dữ liệu thiết bị, cảnh báo và mặt phẳng từ cơ sở dữ liệu hiện tại.</p>
        </div>
        <div className="hero-badge">
          <span className="hero-badge-title">Alerts Timeline</span>
          <Segmented
            value={interval}
            options={[
              { label: "Theo ngày", value: "day" },
              { label: "Theo tháng", value: "month" }
            ]}
            onChange={(value) => setInterval(value)}
          />
        </div>
      </section>

      <div className="widget-grid">
        <div className="stat-card green">
          <span className="stat-label">Tổng thiết bị hoạt động / Tổng thiết bị</span>
          <strong className="stat-value">{`${data.device.active}/${data.device.total}`}</strong>
        </div>
        <div className="stat-card blue">
          <span className="stat-label">Camera hoạt động / Tổng số Camera</span>
          <strong className="stat-value">{`${data.camera.active}/${data.camera.total}`}</strong>
        </div>
        <div className="stat-card red">
          <span className="stat-label">Sensor hoạt động / Tổng Sensor</span>
          <strong className="stat-value">{`${data.sensor.active}/${data.sensor.total}`}</strong>
        </div>
        <div className="stat-card purple">
          <span className="stat-label">Tổng số mặt phẳng</span>
          <strong className="stat-value">{data.planes.total}</strong>
        </div>
      </div>

      <div className="content-grid">
        <div className="info-card">
          <h3>Biểu đồ cảnh báo</h3>
          <svg width="100%" viewBox="0 0 760 260" role="img" aria-label="Alert chart">
            <rect x="0" y="0" width="760" height="260" rx="14" fill="#F8FAFC" />
            <line x1="40" y1="220" x2="740" y2="220" stroke="#CBD5E1" strokeWidth="1" />
            <line x1="40" y1="24" x2="40" y2="220" stroke="#CBD5E1" strokeWidth="1" />

            {polylinePoints && (
              <polyline
                points={polylinePoints
                  .split(" ")
                  .map((segment) => {
                    const [x, y] = segment.split(",");
                    return `${Number(x) + 40},${Number(y)}`;
                  })
                  .join(" ")}
                fill="none"
                stroke="#2563EB"
                strokeWidth="3"
              />
            )}

            {(data.alert_chart || []).map((point, index, arr) => {
              const max = Math.max(...arr.map((item) => Number(item.count || 0)), 1);
              const x = 40 + (arr.length > 1 ? (700 / (arr.length - 1)) * index : 350);
              const y = 220 - ((Number(point.count || 0) / max) * 180);

              return (
                <g key={`${point.label}-${index}`}>
                  <circle cx={x} cy={y} r="3.5" fill="#2563EB" />
                  <text x={x} y={238} textAnchor="middle" fontSize="9" fill="#475569">{point.label}</text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="info-card">
          <h3>Tỷ lệ xử lý cảnh báo</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 18, height: 220, padding: "16px 8px 0" }}>
            {processBars.map((bar) => (
              <div key={bar.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: "100%",
                    maxWidth: 90,
                    height: `${Math.max(14, bar.ratio * 1.6)}px`,
                    background: bar.color,
                    borderRadius: "10px 10px 0 0",
                    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.12)"
                  }}
                />
                <strong style={{ fontSize: 13 }}>{`${bar.value}/${data.reports.total}`}</strong>
                <span style={{ fontSize: 12, color: "#64748b", textAlign: "center" }}>{bar.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}