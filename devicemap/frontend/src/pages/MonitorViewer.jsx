import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Input, Spin, message } from "antd";
import { CloseOutlined, CompressOutlined, EditOutlined } from "@ant-design/icons";

import { getPlanes } from "../api/plane";
import { getDevices, turnOffDevice } from "../api/device";
import { getDeviceTypes } from "../api/deviceType";
import { getMonitorsByPlane, saveMonitorsByPlane } from "../api/monitor";
import { getActiveAlarms } from "../api/report";
import { getLineParameters } from "../api/settings";
import socket from "../socket/socket";
import DevicePopup from "../components/DevicePopup";
import CameraLiveWindow from "../components/CameraLiveWindow";
import getFileUrl from "../utils/fileUrl";

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const normalizePlacement = (item) => ({
  device_id: String(item.device_id),
  x: clamp01(Number(item.x || 0)),
  y: clamp01(Number(item.y || 0))
});

const isSensorDevice = (device) => {
  const type = String(device?.device_type || device?.type || "").toLowerCase();
  return type === "sensor";
};

const isCameraDevice = (device) => {
  const type = String(device?.device_type || device?.type || "").toLowerCase();
  return type === "camera";
};

const DEFAULT_LINE_PARAMETERS = {
  line_thickness: "medium",
  color_1: "#3dbbff",
  color_2: "#ff4d4f",
  transition_speed: 60
};

const LINE_THICKNESS_PIXELS = {
  thin: 2,
  medium: 4,
  thick: 10
};

const LINE_TRANSITION_SECONDS = {
  10: 2.0,
  20: 1.8,
  30: 1.6,
  40: 1.4,
  50: 1.2,
  60: 1.0,
  70: 0.8,
  80: 0.6,
  90: 0.4,
  100: 0.2
};

const LIVE_WINDOW_WIDTH = 268;
const LIVE_WINDOW_HEIGHT = 205;
const CAMERA_WINDOW_POSITION_STORAGE_KEY = "devicemap.monitor.cameraWindowPositions";

const buildCameraStreamName = (deviceId, streamIndex) => {
  const normalizedDeviceId = String(deviceId || "").trim();
  const normalizedStreamIndex = Number(streamIndex) === 2 ? 2 : 1;
  return `${normalizedDeviceId}_${normalizedStreamIndex}`;
};

const getCameraWindowSize = (windowCount) => {
  if (Number(windowCount) >= 6) {
    return {
      width: 134,
      height: 102.5
    };
  }

  return {
    width: LIVE_WINDOW_WIDTH,
    height: LIVE_WINDOW_HEIGHT
  };
};

export default function MonitorViewer() {
  const navigate = useNavigate();
  const { id } = useParams();

  const imageFrameRef = useRef(null);
  const imageRef = useRef(null);

  const [plane, setPlane] = useState(null);
  const [devices, setDevices] = useState([]);
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const [savedPlacements, setSavedPlacements] = useState([]);
  const [draftPlacements, setDraftPlacements] = useState([]);
  const [draftDirty, setDraftDirty] = useState(false);
  const [selectedPlacementId, setSelectedPlacementId] = useState(null);

  const [showCameraList, setShowCameraList] = useState(false);
  const [cameraSearchText, setCameraSearchText] = useState("");

  const [showSensorList, setShowSensorList] = useState(false);
  const [sensorSearchText, setSensorSearchText] = useState("");

  const [popupDevice, setPopupDevice] = useState(null);

  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [imageDrawRect, setImageDrawRect] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const DEVICE_ICON_REFERENCE_SIZE = 24;
  const DEVICE_ICON_REFERENCE_MAP_WIDTH = 870;
  const DEVICE_ICON_MIN_SIZE = 14;
  const DEVICE_ICON_MAX_SIZE = 24;

  const [draggingPlacementId, setDraggingPlacementId] = useState(null);
  const [lineParameters, setLineParameters] = useState(DEFAULT_LINE_PARAMETERS);
  const [activeAlarmTargetsByReportId, setActiveAlarmTargetsByReportId] = useState({});
  const [cameraWindows, setCameraWindows] = useState([]);
  const cameraWindowSequenceRef = useRef(0);
  const [dismissedBlinkDeviceIds, setDismissedBlinkDeviceIds] = useState([]);
  const [rememberedWindowPositions, setRememberedWindowPositions] = useState({});

  const devicesById = useMemo(
    () => new Map(devices.map((device) => [String(device.id), device])),
    [devices]
  );

  const deviceTypeNameById = useMemo(
    () => new Map(deviceTypes.map((item) => [String(item.id), String(item.type || "").toLowerCase()])),
    [deviceTypes]
  );

  const activePlacements = editMode ? draftPlacements : savedPlacements;

  const deviceIconSize = useMemo(() => {
    const mapWidth = imageDrawRect.width;

    if (mapWidth <= 0) {
      return DEVICE_ICON_REFERENCE_SIZE;
    }

    const scale =
      mapWidth / DEVICE_ICON_REFERENCE_MAP_WIDTH;

    const size =
      DEVICE_ICON_REFERENCE_SIZE * scale;

    return Math.max(
      DEVICE_ICON_MIN_SIZE,
      Math.min(DEVICE_ICON_MAX_SIZE, size)
    );
  }, [imageDrawRect.width]);

  const deviceIconContainerSize = useMemo(() => {
    return deviceIconSize * (34 / 24);
  }, [deviceIconSize]);

  const resolveDeviceType = useCallback((device) => {
    const normalized = String(device?.device_type || device?.type || "").toLowerCase();
    if (normalized === "camera" || normalized === "sensor") {
      return normalized;
    }

    return deviceTypeNameById.get(String(device?.device_type_id || "")) || "";
  }, [deviceTypeNameById]);

  const filteredCameras = useMemo(() => {
    const cameras = devices.filter((device) => {
      const type = resolveDeviceType(device);
      return type ? isCameraDevice({ ...device, device_type: type }) : false;
    });
    if (!cameraSearchText.trim()) return cameras;
    const searchLower = cameraSearchText.toLowerCase();
    return cameras.filter((camera) => String(camera.name || "").toLowerCase().includes(searchLower));
  }, [devices, resolveDeviceType, cameraSearchText]);

  const filteredSensors = useMemo(() => {
    const sensors = devices.filter((device) => {
      const type = resolveDeviceType(device);
      return type ? isSensorDevice({ ...device, device_type: type }) : false;
    });
    if (!sensorSearchText.trim()) return sensors;
    const searchLower = sensorSearchText.toLowerCase();
    return sensors.filter((sensor) => String(sensor.name || "").toLowerCase().includes(searchLower));
  }, [devices, resolveDeviceType, sensorSearchText]);

  const syncImageDrawRect = useCallback(() => {
    const frame = imageFrameRef.current;
    const img = imageRef.current;

    if (!frame || !img) {
      return;
    }

    const naturalWidth = imageNaturalSize.width || img.naturalWidth || 0;
    const naturalHeight = imageNaturalSize.height || img.naturalHeight || 0;

    const frameWidth = frame.clientWidth;
    const frameHeight = frame.clientHeight;

    if (frameWidth <= 0 || frameHeight <= 0 || naturalWidth <= 0 || naturalHeight <= 0) {
      return;
    }

    const frameRatio = frameWidth / frameHeight;
    const imageRatio = naturalWidth / naturalHeight;

    let drawWidth = frameWidth;
    let drawHeight = frameHeight;

    if (frameRatio > imageRatio) {
      drawHeight = frameHeight;
      drawWidth = drawHeight * imageRatio;
    } else {
      drawWidth = frameWidth;
      drawHeight = drawWidth / imageRatio;
    }

    setImageDrawRect({
      left: (frameWidth - drawWidth) / 2,
      top: (frameHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight
    });
  }, [imageNaturalSize]);

  const toNormalizedPoint = useCallback((clientX, clientY, clampOutside = false) => {
    const frame = imageFrameRef.current;
    if (!frame || imageDrawRect.width <= 0 || imageDrawRect.height <= 0) {
      return null;
    }

    const frameBounds = frame.getBoundingClientRect();
    const localX = clientX - frameBounds.left - imageDrawRect.left;
    const localY = clientY - frameBounds.top - imageDrawRect.top;

    if (!clampOutside) {
      if (
        localX < 0 ||
        localY < 0 ||
        localX > imageDrawRect.width ||
        localY > imageDrawRect.height
      ) {
        return null;
      }

      return {
        x: clamp01(localX / imageDrawRect.width),
        y: clamp01(localY / imageDrawRect.height)
      };
    }

    return {
      x: clamp01(localX / imageDrawRect.width),
      y: clamp01(localY / imageDrawRect.height)
    };
  }, [imageDrawRect]);

  const getScreenPoint = useCallback((placement) => {
    return {
      left: imageDrawRect.left + placement.x * imageDrawRect.width,
      top: imageDrawRect.top + placement.y * imageDrawRect.height
    };
  }, [imageDrawRect]);

  const exitEditMode = useCallback(() => {
    setEditMode(false);
    setDraftPlacements(savedPlacements.map((item) => ({ ...item })));
    setDraftDirty(false);
    setSelectedPlacementId(null);
  }, [savedPlacements]);

  const handleExit = useCallback(() => {
    navigate("/monitor");
  }, [navigate]);

  const handleKeyDown = useCallback((event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (fullscreen) {
      setFullscreen(false);
      return;
    }

    if (editMode) {
      exitEditMode();
      return;
    }

    handleExit();
  }, [fullscreen, editMode, exitEditMode, handleExit]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [planesRes, devicesRes, typesRes, monitorsRes] = await Promise.all([
          getPlanes(),
          getDevices(),
          getDeviceTypes(),
          getMonitorsByPlane(id)
        ]);

        const planes = Array.isArray(planesRes.data) ? planesRes.data : [];
        const currentPlane = planes.find((item) => String(item.id) === String(id));

        if (!currentPlane) {
          message.error("Không tìm thấy bản đồ");
          navigate("/monitor");
          return;
        }

        const normalizedSavedPlacements = (Array.isArray(monitorsRes.data) ? monitorsRes.data : []).map(normalizePlacement);

        setPlane(currentPlane);
        setDevices(Array.isArray(devicesRes.data) ? devicesRes.data : []);
        setDeviceTypes(Array.isArray(typesRes.data) ? typesRes.data : []);
        setSavedPlacements(normalizedSavedPlacements);
        setDraftPlacements(normalizedSavedPlacements.map((item) => ({ ...item })));
        setDraftDirty(false);
        setSelectedPlacementId(null);

        try {
          const lineSettingsRes = await getLineParameters();
          setLineParameters({
            ...DEFAULT_LINE_PARAMETERS,
            ...(lineSettingsRes?.data || {})
          });
        } catch (settingsErr) {
          console.error("Failed to load line parameters:", settingsErr);
          setLineParameters(DEFAULT_LINE_PARAMETERS);
        }
      } catch (err) {
        console.error("Failed to load monitor data:", err);
        message.error("Không thể tải dữ liệu bản đồ");
        navigate("/monitor");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, navigate]);

  useEffect(() => {
    const onResize = () => syncImageDrawRect();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [syncImageDrawRect]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CAMERA_WINDOW_POSITION_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      setRememberedWindowPositions(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setRememberedWindowPositions({});
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(CAMERA_WINDOW_POSITION_STORAGE_KEY, JSON.stringify(rememberedWindowPositions));
    } catch {
      // Ignore localStorage write errors.
    }
  }, [rememberedWindowPositions]);

  useEffect(() => {
    setActiveAlarmTargetsByReportId({});
    setCameraWindows([]);
    setDismissedBlinkDeviceIds([]);
  }, [id]);

  useEffect(() => {
    const loadActiveAlarmsByPlane = async () => {
      try {
        const res = await getActiveAlarms({ plane_id: id });
        const alarms = Array.isArray(res?.data?.alarms) ? res.data.alarms : [];

        const next = {};
        alarms.forEach((alarm) => {
          const reportId = Number(alarm?.report_id || 0);
          if (!Number.isInteger(reportId) || reportId <= 0) {
            return;
          }

          next[reportId] = {
            plane_id: String(alarm.plane_id || ""),
            flash_device_ids: Array.isArray(alarm.flash_device_ids) ? alarm.flash_device_ids.map((value) => String(value)) : [],
            pair_sensor_ids: Array.isArray(alarm.pair_sensor_ids) ? alarm.pair_sensor_ids.map((value) => String(value)) : []
          };
        });

        setActiveAlarmTargetsByReportId(next);
      } catch (err) {
        console.error("Failed to load active alarms by plane:", err);
      }
    };

    loadActiveAlarmsByPlane();
  }, [id]);

  useEffect(() => {
    const onDeviceAlert = (payload) => {
      const payloadType = String(payload?.type || "");
      const reportId = Number(payload?.report_id || payload?.id || 0);

      if (!Number.isInteger(reportId) || reportId <= 0) {
        return;
      }

      if (payloadType === "external_alarm_resolved") {
        setActiveAlarmTargetsByReportId((prev) => {
          if (!prev[reportId]) {
            return prev;
          }

          const next = { ...prev };
          delete next[reportId];
          return next;
        });
        return;
      }

      if (payloadType !== "external_alarm") {
        return;
      }

      if (String(payload?.plane_id || "") !== String(id || "")) {
        return;
      }

      const incomingFlashIds = Array.isArray(payload?.flash_device_ids)
        ? payload.flash_device_ids.map((value) => String(value))
        : [];
      const incomingPairIds = Array.isArray(payload?.pair_sensor_ids)
        ? payload.pair_sensor_ids.map((value) => String(value))
        : [];

      setActiveAlarmTargetsByReportId((prev) => ({
        ...prev,
        [reportId]: {
          plane_id: String(payload.plane_id || ""),
          flash_device_ids: incomingFlashIds,
          pair_sensor_ids: incomingPairIds
        }
      }));
    };

    socket.on("device_alert", onDeviceAlert);
    return () => socket.off("device_alert", onDeviceAlert);
  }, [id]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Delete" && selectedPlacementId) {
        removeSelectedPlacement();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedPlacementId]);


  useEffect(() => {
    if (!draggingPlacementId || !editMode) {
      return;
    }

    const handleMouseMove = (event) => {
      const normalized = toNormalizedPoint(event.clientX, event.clientY, true);
      if (!normalized) {
        return;
      }

      setDraftPlacements((prev) => prev.map((item) => {
        if (item.device_id !== draggingPlacementId) {
          return item;
        }

        return {
          ...item,
          x: normalized.x,
          y: normalized.y
        };
      }));
      setDraftDirty(true);
    };

    const handleMouseUp = () => {
      setDraggingPlacementId(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingPlacementId, editMode, toNormalizedPoint]);

  const sensorConnections = useMemo(() => {
    const groupedByPair = new Map();

    activePlacements.forEach((placement) => {
      const device = devicesById.get(String(placement.device_id));
      if (!device || !isSensorDevice(device)) {
        return;
      }

      const pairValue = Number(device.pair || 0);
      if (pairValue <= 0) {
        return;
      }

      if (!groupedByPair.has(pairValue)) {
        groupedByPair.set(pairValue, []);
      }

      groupedByPair.get(pairValue).push({
        placement,
        pairId: Number(device.pair_id || 0)
      });
    });

    const lines = [];

    groupedByPair.forEach((items) => {
      if (items.length < 2) {
        return;
      }

      const ordered = [...items].sort((left, right) => left.pairId - right.pairId);

      if (ordered.length === 2) {
        lines.push({ from: ordered[0].placement, to: ordered[1].placement });
        return;
      }

      for (let index = 0; index < ordered.length - 1; index += 1) {
        lines.push({ from: ordered[index].placement, to: ordered[index + 1].placement });
      }
    });

    return lines;
  }, [activePlacements, devicesById]);

  const lineThicknessPx = useMemo(() => {
    const thicknessKey = String(lineParameters.line_thickness || "").toLowerCase();
    return LINE_THICKNESS_PIXELS[thicknessKey] || LINE_THICKNESS_PIXELS.medium;
  }, [lineParameters.line_thickness]);

  const lineTransitionSeconds = useMemo(() => {
    const speed = Number(lineParameters.transition_speed || 60);
    return LINE_TRANSITION_SECONDS[speed] || LINE_TRANSITION_SECONDS[60];
  }, [lineParameters.transition_speed]);

  const flashingDeviceIds = useMemo(() => {
    const result = new Set();

    Object.values(activeAlarmTargetsByReportId).forEach((alarm) => {
      (alarm?.flash_device_ids || []).forEach((deviceId) => result.add(String(deviceId)));
    });

    return result;
  }, [activeAlarmTargetsByReportId]);

  const flashingPairSensorIds = useMemo(() => {
    const result = new Set();

    Object.values(activeAlarmTargetsByReportId).forEach((alarm) => {
      (alarm?.pair_sensor_ids || []).forEach((deviceId) => result.add(String(deviceId)));
    });

    return result;
  }, [activeAlarmTargetsByReportId]);

  const isDeviceFlashing = useCallback((deviceId) => {
    return flashingDeviceIds.has(String(deviceId));
  }, [flashingDeviceIds]);

  const isPairLineFlashing = useCallback((line) => {
    const fromId = String(line.from.device_id);
    const toId = String(line.to.device_id);

    return flashingPairSensorIds.has(fromId) && flashingPairSensorIds.has(toId);
  }, [flashingPairSensorIds]);

  const onDeviceDragStart = (event, deviceId) => {
    event.dataTransfer.setData("text/device-id", String(deviceId));
    event.dataTransfer.effectAllowed = "copy";
  };

  const onImageDrop = (event) => {
    event.preventDefault();
    if (!editMode) {
      return;
    }

    const droppedDeviceId = String(event.dataTransfer.getData("text/device-id") || "").trim();
    if (!droppedDeviceId) {
      return;
    }

    if (draftPlacements.some((item) => String(item.device_id) === droppedDeviceId)) {
      message.warning("Thiết bị đã tồn tại trên bản đồ này");
      return;
    }

    const normalized = toNormalizedPoint(event.clientX, event.clientY, false);
    if (!normalized) {
      message.warning("Chỉ được thả thiết bị trong phạm vi ảnh");
      return;
    }

    setDraftPlacements((prev) => [...prev, {
      device_id: droppedDeviceId,
      x: normalized.x,
      y: normalized.y
    }]);
    setDraftDirty(true);
  };

  const onImageDragOver = (event) => {
    if (editMode) {
      event.preventDefault();
    }
  };

  const removeSelectedPlacement = () => {
    if (!selectedPlacementId) {
      return;
    }

    setDraftPlacements((prev) => prev.filter((item) => item.device_id !== selectedPlacementId));
    setSelectedPlacementId(null);
    setDraftDirty(true);
  };

  const savePlacements = async () => {
    setSaving(true);
    try {
      const payload = draftPlacements.map((item) => ({
        device_id: item.device_id,
        x: clamp01(item.x),
        y: clamp01(item.y)
      }));

      const res = await saveMonitorsByPlane(id, payload);
      const normalizedSaved = (Array.isArray(res.data) ? res.data : []).map(normalizePlacement);

      setSavedPlacements(normalizedSaved);
      setDraftPlacements(normalizedSaved.map((item) => ({ ...item })));
      setDraftDirty(false);
      setSelectedPlacementId(null);
      setEditMode(false);

      // Refresh device status values that are synchronized by backend after monitor save.
      const devicesRes = await getDevices();
      setDevices(Array.isArray(devicesRes.data) ? devicesRes.data : []);

      message.success("Đã lưu vị trí thiết bị");
    } catch (err) {
      console.error("Failed to save monitor placements", err);
      message.error(err?.response?.data?.message || "Không thể lưu vị trí thiết bị");
    } finally {
      setSaving(false);
    }
  };

  const openDevicePopup = (deviceId) => {
    const device = devicesById.get(String(deviceId));
    if (!device) {
      return;
    }

    setPopupDevice(device);
  };

  const getLiveViewInitialPosition = useCallback((deviceId, windowWidth, windowHeight) => {
    const frame = imageFrameRef.current;
    const placement = activePlacements.find((item) => String(item.device_id) === String(deviceId));

    if (!frame || !placement) {
      return { left: 16, top: 16 };
    }

    const frameRect = frame.getBoundingClientRect();
    const point = getScreenPoint(placement);

    const resolvedWidth = Number(windowWidth || LIVE_WINDOW_WIDTH);
    const resolvedHeight = Number(windowHeight || LIVE_WINDOW_HEIGHT);
    const maxLeft = Math.max(8, window.innerWidth - resolvedWidth - 8);
    const maxTop = Math.max(8, window.innerHeight - resolvedHeight - 8);

    const rawLeft = frameRect.left + point.left - (resolvedWidth / 2);
    const rawTop = frameRect.top + point.top - resolvedHeight - 14;

    return {
      left: Math.max(8, Math.min(rawLeft, maxLeft)),
      top: Math.max(8, Math.min(rawTop, maxTop))
    };
  }, [activePlacements, getScreenPoint]);

  const openLiveView = useCallback((deviceId, streamIndex = 1, source = "manual") => {
    const normalizedDeviceId = String(deviceId || "").trim();
    const targetDevice = devicesById.get(normalizedDeviceId);
    if (!targetDevice) {
      return;
    }

    if (resolveDeviceType(targetDevice) !== "camera") {
      return;
    }

    const stream = Number(streamIndex) === 2 ? 2 : 1;
    const streamName = buildCameraStreamName(normalizedDeviceId, stream);
    const rememberedKey = `${id}:${streamName}`;

    setCameraWindows((prev) => {
      const existingIndex = prev.findIndex((item) => item.streamName === streamName);
      const nextCount = existingIndex >= 0 ? prev.length : prev.length + 1;
      const size = getCameraWindowSize(nextCount);
      const computedPosition = getLiveViewInitialPosition(normalizedDeviceId, size.width, size.height);
      const rememberedPosition = rememberedWindowPositions[rememberedKey];
      const initialPosition = rememberedPosition || computedPosition;

      if (!rememberedPosition) {
        setRememberedWindowPositions((current) => ({
          ...current,
          [rememberedKey]: computedPosition
        }));
      }

      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        const reordered = [
          ...prev.slice(0, existingIndex),
          ...prev.slice(existingIndex + 1),
          {
            ...existing,
            title: `${targetDevice.id} | ${targetDevice.name}`
          }
        ];

        return reordered;
      }

      return [
        ...prev,
        {
          id: `${streamName}-${cameraWindowSequenceRef.current += 1}`,
          deviceId: normalizedDeviceId,
          streamName,
          title: `${targetDevice.id} | ${targetDevice.name}`,
          source,
          initialPosition
        }
      ];
    });

    setPopupDevice(null);
  }, [devicesById, resolveDeviceType, getLiveViewInitialPosition, rememberedWindowPositions, id]);

  const rememberWindowPosition = useCallback((streamName, position) => {
    if (!streamName || !position) {
      return;
    }

    const key = `${id}:${streamName}`;
    setRememberedWindowPositions((current) => ({
      ...current,
      [key]: {
        left: Number(position.left || 16),
        top: Number(position.top || 16)
      }
    }));
  }, [id]);

  const bringCameraWindowToFront = useCallback((windowId) => {
    setCameraWindows((prev) => {
      const index = prev.findIndex((item) => item.id === windowId);
      if (index < 0 || index === prev.length - 1) {
        return prev;
      }

      const next = [...prev];
      const [selected] = next.splice(index, 1);
      next.push(selected);
      return next;
    });
  }, []);

  const closeLiveView = useCallback((windowId, options = {}) => {
    const { rememberDismissed = true } = options;

    setCameraWindows((prev) => {
      const target = prev.find((item) => item.id === windowId);

      if (
        rememberDismissed &&
        target?.source === "blink" &&
        target.deviceId
      ) {
        setDismissedBlinkDeviceIds((current) => {
          const normalizedDeviceId = String(target.deviceId);

          if (current.includes(normalizedDeviceId)) {
            return current;
          }

          return [...current, normalizedDeviceId];
        });
      }

      return prev.filter((item) => item.id !== windowId);
    });
  }, []);

  const handleTurnOff = async () => {
    const targetId = String(popupDevice?.id || "").trim();
    if (!targetId) {
      message.error("Không xác định được thiết bị");
      return;
    }

    try {
      const res = await turnOffDevice(targetId);
      if (res?.data?.success) {
        message.success("Đã thực thi lệnh Tắt thành công");
        return;
      }

      message.error(res?.data?.error || "Không thể thực thi lệnh Tắt");
    } catch (err) {
      message.error(err?.response?.data?.error || "Không thể thực thi lệnh Tắt");
    }
  };

  const enterEditMode = () => {
    setEditMode(true);
    setDraftPlacements(savedPlacements.map((item) => ({ ...item })));
    setDraftDirty(false);
    setSelectedPlacementId(null);
  };

  useEffect(() => {
    if (
      imageDrawRect.width <= 0 ||
      imageDrawRect.height <= 0 ||
      activePlacements.length === 0
    ) {
      return;
    }
    const flashingCameraIds = [...flashingDeviceIds].filter((deviceId) => {
      const targetDevice = devicesById.get(String(deviceId));

      if (!targetDevice) {
        return false;
      }
      return resolveDeviceType(targetDevice) === "camera";
    });

    const flashingCameraIdSet = new Set(
      flashingCameraIds.map((deviceId) => String(deviceId))
    );
    cameraWindows.forEach((windowItem) => {
      if (windowItem.source !== "blink") {
        return;
      }
      const deviceId = String(windowItem.deviceId);

      if (!flashingCameraIdSet.has(deviceId)) {
        closeLiveView(windowItem.id, {
          rememberDismissed: false
        });
      }
    });
    setDismissedBlinkDeviceIds((current) =>
      current.filter((deviceId) =>
        flashingCameraIdSet.has(String(deviceId))
      )
    );
    flashingCameraIds.forEach((deviceId) => {
      if (dismissedBlinkDeviceIds.includes(String(deviceId))) {
        return;
      }
      const nextStreamName = buildCameraStreamName(deviceId, 2);
      const alreadyOpen = cameraWindows.some(
        (item) => item.streamName === nextStreamName
      );
      if (alreadyOpen) {
        return;
      }
      openLiveView(deviceId, 2, "blink");
    });
  }, [
    flashingDeviceIds,
    devicesById,
    resolveDeviceType,
    dismissedBlinkDeviceIds,
    cameraWindows,
    openLiveView,
    closeLiveView,
    imageDrawRect.width,
    imageDrawRect.height,
    activePlacements.length
  ]);

  const cameraWindowSize = useMemo(() => getCameraWindowSize(cameraWindows.length), [cameraWindows.length]);

  const renderCameraWindows = () => cameraWindows.map((windowItem, index) => (
    <CameraLiveWindow
      key={windowItem.id}
      open
      title={windowItem.title}
      streamName={windowItem.streamName}
      initialPosition={windowItem.initialPosition}
      width={cameraWindowSize.width}
      height={cameraWindowSize.height}
      baseZIndex={2000 + index}
      onClose={() => closeLiveView(windowItem.id)}
      onActivate={() => bringCameraWindowToFront(windowItem.id)}
      onPositionChange={(position) => rememberWindowPosition(windowItem.streamName, position)}
    />
  ));

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin />
      </div>
    );
  }

  if (!plane) {
    return null;
  }

  const renderDeviceIcon = (placement) => {
    const device = devicesById.get(String(placement.device_id));
    if (!device) {
      return null;
    }

    // const iconUrl = getFileUrl(device.icon1);
    const iconUrl1 = getFileUrl(device.icon1);
    const iconUrl2 = device.icon2 ? getFileUrl(device.icon2) : null;
    const hasIcon2 = Boolean(iconUrl2);
    const isSelected = selectedPlacementId === placement.device_id;
    const flashing = isDeviceFlashing(placement.device_id);
    const color1 = String(lineParameters.color_1 || DEFAULT_LINE_PARAMETERS.color_1);
    const color2 = String(lineParameters.color_2 || DEFAULT_LINE_PARAMETERS.color_2);
    const point = getScreenPoint(placement);

    return (
      <div
        key={placement.device_id}
        onMouseDown={editMode ? (event) => {
          event.preventDefault();
          setSelectedPlacementId(placement.device_id);
          setDraggingPlacementId(placement.device_id);
        } : undefined}
        onClick={() => {
          if (editMode) {
            setSelectedPlacementId(placement.device_id);
            return;
          }

          openDevicePopup(placement.device_id);
        }}
        style={{
          position: "absolute",
          left: point.left,
          top: point.top,
          width: deviceIconContainerSize,
          height: deviceIconContainerSize,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          border: isSelected ? "2px solid #1677ff" : "2px solid rgba(255,255,255,0.9)",
          background: "rgba(0, 0, 0, 0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: editMode ? "grab" : "pointer",
          boxShadow: "0 3px 12px rgba(0, 0, 0, 0.35)",
          zIndex: 40,
          ...(flashing ? {
            border: `2px solid ${color1}`,
            boxShadow: `0 0 0 2px ${color1}66, 0 3px 12px rgba(0, 0, 0, 0.35)`,
            animation: `devicemapFlash ${lineTransitionSeconds}s linear infinite`,
            ["--flash-color-1"]: color1,
            ["--flash-color-2"]: color2,
            // ###########################################
            ["--flash-duration"]: `${lineTransitionSeconds}s`
          } : {})
        }}
      >
        {/* {iconUrl ? (
          <img
            src={iconUrl}
            alt={device.name}
            draggable={false}
            style={{
              width: 24,
              height: 24,
              objectFit: "contain"
            }}
          />
        )
         : (
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>
            {device.id}
          </span>
        )} */}
        {iconUrl1 ? (
          <div
            className={`device-icon-switch ${
              flashing && hasIcon2 ? "flashing" : ""
            }`}
            style={{
              "--device-icon-size": `${deviceIconSize}px`
            }}
          >
            <img
              className="device-icon-primary"
              src={iconUrl1}
              alt={device.name}
              draggable={false}
            />

            {hasIcon2 && (
              <img
                className="device-icon-secondary"
                src={iconUrl2}
                alt={device.name}
                draggable={false}
              />
            )}
          </div>
        ) : (
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>
            {device.id}
          </span>
        )}
      </div>
    );
  };

  const renderMonitorCanvas = (overrides = {}) => (
    <div
      ref={imageFrameRef}
      onDrop={onImageDrop}
      onDragOver={onImageDragOver}
      style={{
        position: "relative",
        width: "100%",
        height: "70vh",
        minHeight: 420,
        background: "#111",
        borderRadius: 8,
        overflow: "hidden",
        ...overrides
      }}
    >
      {plane.image ? (
        <img
          ref={imageRef}
          src={getFileUrl(plane.image)}
          alt="Monitor"
          onLoad={(event) => {
            setImageNaturalSize({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight
            });
            requestAnimationFrame(syncImageDrawRect);
          }}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block"
          }}
        />
      ) : (
        <div style={{ color: "#fff", textAlign: "center", paddingTop: 30 }}>
          Bản đồ chưa có ảnh
        </div>
      )}

      {imageDrawRect.width > 0 && imageDrawRect.height > 0 && (
        <svg
          width={imageDrawRect.width}
          height={imageDrawRect.height}
          style={{
            position: "absolute",
            left: imageDrawRect.left,
            top: imageDrawRect.top,
            pointerEvents: "none",
            zIndex: 20
          }}
        >
          {sensorConnections.map((line, index) => {
            const fromX = line.from.x * imageDrawRect.width;
            const fromY = line.from.y * imageDrawRect.height;
            const toX = line.to.x * imageDrawRect.width;
            const toY = line.to.y * imageDrawRect.height;
            const pairFlashing = isPairLineFlashing(line);
            const color1 = String(lineParameters.color_1 || DEFAULT_LINE_PARAMETERS.color_1);
            const color2 = String(lineParameters.color_2 || DEFAULT_LINE_PARAMETERS.color_2);

            return (
              <line
                key={`${line.from.device_id}-${line.to.device_id}-${index}`}
                x1={fromX}
                y1={fromY}
                x2={toX}
                y2={toY}
                stroke={color1}
                strokeWidth={lineThicknessPx}
                strokeDasharray="4 4"
              >
                {pairFlashing && (
                  <animate
                    attributeName="stroke"
                    values={`${color1};${color2};${color1}`}
                    dur={`${lineTransitionSeconds}s`}
                    repeatCount="indefinite"
                  />
                )}
              </line>
            );
          })}
        </svg>
      )}

      {activePlacements.map(renderDeviceIcon)}
    </div>
  );

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
          zIndex: 9000
        }}
      >
        <Button
          type="primary"
          danger
          icon={<CloseOutlined />}
          aria-label="Thoát toàn màn hình"
          style={{
            position: "absolute",
            left: 20,
            top: 20,
            zIndex: 10002
          }}
          onClick={() => setFullscreen(false)}
        />

        {renderMonitorCanvas({
          width: "100vw",
          height: "100vh",
          minHeight: "100vh",
          borderRadius: 0
        })}

        <DevicePopup
          device={popupDevice}
          open={!!popupDevice}
          onClose={() => setPopupDevice(null)}
          onLiveView={() => openLiveView(popupDevice?.id, 1, "manual")}
          onTurnOff={handleTurnOff}
        />

        {renderCameraWindows()}
      </div>
    );
  }

  if (editMode) {
    return (
      <div style={{ padding: "1px", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, right: 20, display: "flex", gap: "10px" }}>
          <Button icon={<EditOutlined />} onClick={exitEditMode}>
            Chỉnh sửa
          </Button>
          <Button icon={<CompressOutlined />} onClick={() => setFullscreen(true)}>
            Phóng to
          </Button>
          <Button onClick={handleExit}>
            Thoát
          </Button>
        </div>

        <div style={{ display: "flex", gap: "20px", marginTop: "40px" }}>
          <div style={{ flex: "0 0 66%" }}>
            {renderMonitorCanvas()}
          </div>

          <div style={{ flex: "0 0 33%", display: "flex", flexDirection: "column", gap: "15px" }}>
            <Button type="primary" block size="large" loading={saving} onClick={savePlacements}>
              Lưu sửa đổi
            </Button>
            {draftDirty && (
              <div style={{ color: "#faad14", fontSize: 12 }}>
                Có thay đổi chưa lưu
              </div>
            )}

            <Button
              danger
              disabled={!selectedPlacementId}
              onClick={removeSelectedPlacement}
              className="delete-placement-btn"
            >
              Xóa thiết bị đã chọn
            </Button>

            {/* ================= CAMERA ================= */}
            <div>
              {!showCameraList ? (
                <Button
                  block
                  onClick={() => {
                    setShowCameraList(true);
                    setShowSensorList(false);
                    setSensorSearchText("");
                  }}
                >
                  Danh sách camera
                </Button>
              ) : (
                <Input
                  autoFocus
                  block
                  placeholder="Nhập tên camera..."
                  value={cameraSearchText}
                  onChange={(event) => setCameraSearchText(event.target.value)}
                  allowClear
                />
              )}

              {showCameraList && (
                <div
                  style={{
                    marginTop: "10px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    padding: "10px"
                  }}
                >
                  <div style={{ maxHeight: "132px", overflowY: "auto" }}>
                    {filteredCameras.length > 0 ? (
                      filteredCameras.map((camera) => {
                        const exists = draftPlacements.some(
                          (item) => String(item.device_id) === String(camera.id)
                        );

                        return (
                          <div
                            key={camera.id}
                            draggable={!exists}
                            onDragStart={(event) =>
                              onDeviceDragStart(event, camera.id)
                            }
                            style={{
                              padding: "8px",
                              cursor: exists ? "not-allowed" : "grab",
                              background: exists ? "#f5f5f5" : "transparent",
                              borderRadius: "4px",
                              marginBottom: "4px",
                              color: exists ? "#999" : "inherit"
                            }}
                          >
                            {camera.name}
                          </div>
                        );
                      })
                    ) : (
                      <div
                        style={{
                          color: "#999",
                          textAlign: "center",
                          padding: "10px"
                        }}
                      >
                        Không tìm thấy camera
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>


            {/* ================= SENSOR ================= */}
            <div>
              {!showSensorList ? (
                <Button
                  block
                  onClick={() => {
                    setShowSensorList(true);
                    setShowCameraList(false);
                    setCameraSearchText("");
                  }}
                >
                  Danh sách cảm biến
                </Button>
              ) : (
                <Input
                  autoFocus
                  block
                  placeholder="Nhập tên cảm biến..."
                  value={sensorSearchText}
                  onChange={(event) => setSensorSearchText(event.target.value)}
                  allowClear
                />
              )}

              {showSensorList && (
                <div
                  style={{
                    marginTop: "10px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    padding: "10px"
                  }}
                >
                  <div style={{ maxHeight: "132px", overflowY: "auto" }}>
                    {filteredSensors.length > 0 ? (
                      filteredSensors.map((sensor) => {
                        const exists = draftPlacements.some(
                          (item) => String(item.device_id) === String(sensor.id)
                        );

                        return (
                          <div
                            key={sensor.id}
                            draggable={!exists}
                            onDragStart={(event) =>
                              onDeviceDragStart(event, sensor.id)
                            }
                            style={{
                              padding: "8px",
                              cursor: exists ? "not-allowed" : "grab",
                              background: exists ? "#f5f5f5" : "transparent",
                              borderRadius: "4px",
                              marginBottom: "4px",
                              color: exists ? "#999" : "inherit"
                            }}
                          >
                            {sensor.name}
                          </div>
                        );
                      })
                    ) : (
                      <div
                        style={{
                          color: "#999",
                          textAlign: "center",
                          padding: "10px"
                        }}
                      >
                        Không tìm thấy cảm biến
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {renderCameraWindows()}
      </div>
    );
  }

  return (
    <div style={{ padding: "1px", position: "relative" }}>
      <div style={{ position: "absolute", top: 0, right: 20, display: "flex", gap: "10px" }}>
        <Button icon={<EditOutlined />} onClick={enterEditMode}>
          Chỉnh sửa
        </Button>
        <Button icon={<CompressOutlined />} onClick={() => setFullscreen(true)}>
          Phóng to
        </Button>
        <Button onClick={handleExit}>
          Thoát
        </Button>
      </div>

      <div style={{ marginTop: "40px" }}>
        {renderMonitorCanvas()}
      </div>

      <DevicePopup
        device={popupDevice}
        open={!!popupDevice}
        onClose={() => setPopupDevice(null)}
        onLiveView={() => openLiveView(popupDevice?.id, 1, "manual")}
        onTurnOff={handleTurnOff}
      />

      {renderCameraWindows()}
    </div>
  );
}
