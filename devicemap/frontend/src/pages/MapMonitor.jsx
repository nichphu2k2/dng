import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Select, Spin, message } from "antd";
import { CloseOutlined, CompressOutlined, ExpandOutlined } from "@ant-design/icons";

import { getPlanes } from "../api/plane";
import { getDevices } from "../api/device";
import { getDeviceTypes } from "../api/deviceType";
import getFileUrl from "../utils/fileUrl";

export default function MapMonitor() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [map, setMap] = useState(null);
  const [devices, setDevices] = useState([]);
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [selectedSensor, setSelectedSensor] = useState(null);

  const handleExit = () => {
    navigate("/monitor");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      if (fullscreen) {
        setFullscreen(false);
      } else {
        handleExit();
      }
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [planesRes, devicesRes, typesRes] = await Promise.all([
          getPlanes(),
          getDevices(),
          getDeviceTypes()
        ]);

        const planes = Array.isArray(planesRes.data) ? planesRes.data : [];
        const currentMap = planes.find((p) => String(p.id) === String(id));

        if (!currentMap) {
          message.error("Không tìm thấy bản đồ");
          navigate("/monitor");
          return;
        }

        setMap(currentMap);
        setDevices(Array.isArray(devicesRes.data) ? devicesRes.data : []);
        setDeviceTypes(Array.isArray(typesRes.data) ? typesRes.data : []);
      } catch (err) {
        console.error("Failed to load map data:", err);
        message.error("Không thể tải dữ liệu bản đồ");
        navigate("/monitor");
      } finally {
        setLoading(false);
      }
    };

    loadData();
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [id, navigate]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin />
      </div>
    );
  }

  if (!map) {
    return null;
  }

  const cameraType = deviceTypes.find((t) => t.type === "Camera");
  const sensorType = deviceTypes.find((t) => t.type === "Sensor");

  const cameraOptions = devices
    .filter((d) => d.device_type_id === cameraType?.id)
    .map((d) => ({
      label: d.name,
      value: d.id
    }));

  const sensorOptions = devices
    .filter((d) => d.device_type_id === sensorType?.id)
    .map((d) => ({
      label: d.name,
      value: d.id
    }));

  if (fullscreen) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          background: "#000",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 9999
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <Button
          type="primary"
          danger
          icon={<CloseOutlined />}
          style={{
            position: "absolute",
            left: 20,
            top: 20,
            zIndex: 10000
          }}
          onClick={() => setFullscreen(false)}
        >
          X
        </Button>

        {map.image && (
          <img
            src={getFileUrl(map.image)}
            alt="Map Fullscreen"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain"
            }}
          />
        )}
      </div>
    );
  }

  if (editMode) {
    return (
      <div style={{ display: "flex", height: "calc(100vh - 100px)", gap: "20px", padding: "20px" }}>
        <div style={{ flex: "0 0 66%", overflow: "auto" }}>
          <div style={{ textAlign: "center" }}>
            {map.image && (
              <img
                src={getFileUrl(map.image)}
                alt="Map"
                style={{
                  maxWidth: "100%",
                  maxHeight: "600px",
                  objectFit: "contain"
                }}
              />
            )}
          </div>
        </div>

        <div style={{ flex: "0 0 33%", display: "flex", flexDirection: "column", gap: "15px" }}>
          <Button type="primary" block size="large">
            Lưu sửa đổi
          </Button>

          <Select
            placeholder="Tìm kiếm camera"
            options={cameraOptions}
            value={selectedCamera}
            onChange={setSelectedCamera}
            allowClear
            style={{ color: "#999" }}
          />

          <Select
            placeholder="Tìm kiếm cảm biến"
            options={sensorOptions}
            value={selectedSensor}
            onChange={setSelectedSensor}
            allowClear
            style={{ color: "#999" }}
          />

          <Button onClick={() => setEditMode(false)}>
            Đóng
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
        <Button
          type="text"
          icon={<CloseOutlined />}
          onClick={handleExit}
          style={{
            position: "absolute",
            right: 20,
            top: 20,
            zIndex: 100
          }}
        />

        <div style={{ textAlign: "center", marginTop: "40px" }}>
          {map.image && (
            <img
              src={getFileUrl(map.image)}
              alt="Map"
              style={{
                maxWidth: "100%",
                maxHeight: "600px",
                objectFit: "contain"
              }}
            />
          )}
        </div>

        <div style={{ position: "absolute", right: 20, bottom: 20, display: "flex", gap: "10px" }}>
          <Button
            icon={<ExpandOutlined />}
            onClick={() => setEditMode(true)}
          >
            Chỉnh sửa
          </Button>
          <Button
            icon={<CompressOutlined />}
            onClick={() => setFullscreen(true)}
          >
            Phóng to
          </Button>
        </div>
      </div>
    </div>
  );
}
