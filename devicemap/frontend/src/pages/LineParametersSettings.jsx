import { useEffect, useMemo, useState } from "react";
import { Button, Card, Select, Space, Spin, Typography, message } from "antd";

import { getLineParameters, updateLineParameters } from "../api/settings";

const THICKNESS_OPTIONS = [
  {
    label: "Mỏng",
    value: "thin",
    sampleStyle: {
      height: 2,
      width: 88,
      background: "#111"
    }
  },
  {
    label: "Trung bình",
    value: "medium",
    sampleStyle: {
      height: 4,
      width: 88,
      background: "#111"
    }
  },
  {
    label: "Dày",
    value: "thick",
    sampleStyle: {
      height: 10,
      width: 88,
      background: "#111"
    }
  }
];

const SPEED_OPTIONS = [
  { value: 10, seconds: 2.0 },
  { value: 20, seconds: 1.8 },
  { value: 30, seconds: 1.6 },
  { value: 40, seconds: 1.4 },
  { value: 50, seconds: 1.2 },
  { value: 60, seconds: 1.0 },
  { value: 70, seconds: 0.8 },
  { value: 80, seconds: 0.6 },
  { value: 90, seconds: 0.4 },
  { value: 100, seconds: 0.2 }
];

const DEFAULT_SETTINGS = {
  line_thickness: "medium",
  color_1: "#3dbbff",
  color_2: "#ff4d4f",
  transition_speed: 60
};

const isHexColor = (value) => /^#[0-9a-fA-F]{6}$/.test(String(value || ""));

export default function LineParametersSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const res = await getLineParameters();
        setValues({
          ...DEFAULT_SETTINGS,
          ...(res?.data || {})
        });
      } catch (err) {
        console.error("Failed to load line parameters:", err);
        message.error("Không thể tải cấu hình đường cảnh báo");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const saveSettings = async (nextValues, successMessage) => {
    setSaving(true);
    try {
      const payload = {
        line_thickness: nextValues.line_thickness,
        color_1: nextValues.color_1,
        color_2: nextValues.color_2,
        transition_speed: Number(nextValues.transition_speed)
      };

      const res = await updateLineParameters(payload);
      setValues({
        ...DEFAULT_SETTINGS,
        ...(res?.data || payload)
      });

      if (successMessage) {
        message.success(successMessage);
      }
    } catch (err) {
      console.error("Failed to save line parameters:", err);
      message.error(err?.response?.data?.message || "Không thể lưu cấu hình đường cảnh báo");
    } finally {
      setSaving(false);
    }
  };

  const onThicknessChange = (lineThickness) => {
    const next = {
      ...values,
      line_thickness: lineThickness
    };
    setValues(next);
    saveSettings(next);
  };

  const onColorChange = (field, value) => {
    if (!isHexColor(value)) {
      return;
    }

    const next = {
      ...values,
      [field]: value
    };
    setValues(next);
    saveSettings(next);
  };

  const onSpeedChange = (speedValue) => {
    const next = {
      ...values,
      transition_speed: Number(speedValue)
    };
    setValues(next);
    saveSettings(next);
  };

  const speedNote = useMemo(() => {
    const speed = SPEED_OPTIONS.find((item) => item.value === Number(values.transition_speed));
    return speed ? `${speed.seconds.toFixed(1)} giây` : "";
  }, [values.transition_speed]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          Độ dày line
        </Typography.Title>

        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {THICKNESS_OPTIONS.map((item) => {
            const isActive = values.line_thickness === item.value;

            return (
              <div
                key={item.value}
                onClick={() => onThicknessChange(item.value)}
                style={{
                  border: isActive ? "1px solid #1677ff" : "1px solid #d9d9d9",
                  borderRadius: 8,
                  padding: "10px 12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer"
                }}
              >
                <Typography.Text strong={isActive}>{item.label}</Typography.Text>
                <div style={item.sampleStyle} />
              </div>
            );
          })}
        </Space>
      </Card>

      <Card>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          Màu
        </Typography.Title>

        <Space size={24} wrap>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <span>Color 1</span>
            <input
              type="color"
              value={values.color_1}
              onChange={(event) => onColorChange("color_1", event.target.value)}
              aria-label="Color 1"
              style={{ width: 44, height: 32, border: "none", background: "transparent", padding: 0 }}
            />
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <span>Color 2</span>
            <input
              type="color"
              value={values.color_2}
              onChange={(event) => onColorChange("color_2", event.target.value)}
              aria-label="Color 2"
              style={{ width: 44, height: 32, border: "none", background: "transparent", padding: 0 }}
            />
          </label>
        </Space>
      </Card>

      <Card>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          Tốc độ chuyển đổi giữa 2 màu
        </Typography.Title>

        <Space direction="vertical" size={8}>
          <Select
            value={Number(values.transition_speed)}
            onChange={onSpeedChange}
            style={{ width: 280 }}
            options={SPEED_OPTIONS.map((item) => ({
              value: item.value,
              label: `${item.value} (${item.seconds.toFixed(1)} giây)`
            }))}
          />
          <Typography.Text type="secondary">Thời gian hiện tại: {speedNote}</Typography.Text>
        </Space>
      </Card>

      <div>
        <Button type="primary" loading={saving} onClick={() => saveSettings(values, "Đã lưu cấu hình đường cảnh báo")}>
          Lưu cấu hình
        </Button>
      </div>
    </div>
  );
}
