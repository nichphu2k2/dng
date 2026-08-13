import { useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Space, message } from "antd";

import DeviceForm from "../components/DeviceForm";
import DeviceList from "../components/DeviceList";
import { createDevice, deleteDevice, getDevices, getNextDeviceId, updateDevice } from "../api/device";
import { getDeviceTypes } from "../api/deviceType";
import { normalizeThreeDigitId } from "../utils/threeDigitId";

const getDescription = (item) => {
  if (typeof item?.description === "string") {
    return item.description;
  }

  return item?.metadata?.description || "";
};

export default function DeviceManagement() {
  const [deviceRows, setDeviceRows] = useState([]);
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingItem, setEditingItem] = useState(null);
  const [nextId, setNextId] = useState("...");

  const loadDeviceTypes = async () => {
    try {
      const res = await getDeviceTypes();
      const rows = Array.isArray(res.data) ? res.data : [];
      setDeviceTypes(rows);
      return rows;
    } catch (err) {
      console.error("Failed to fetch device types:", err);
      message.error("Không thể tải loại thiết bị");
      return [];
    }
  };

  const loadDevices = async () => {
    try {
      const res = await getDevices();
      setDeviceRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch devices:", err);
      message.error("Không thể tải danh sách thiết bị");
    }
  };

  useEffect(() => {
    loadDeviceTypes();
    loadDevices();
    refreshNextId();
  }, []);

  const refreshNextId = async () => {
    try {
      const res = await getNextDeviceId();
      const id = res?.data?.id || "...";
      setNextId(id);
      return id;
    } catch {
      setNextId("...");
      return "...";
    }
  };

  const mappedDevices = useMemo(() => {
    return deviceRows.map((item) => {
      const normalizedId = normalizeThreeDigitId(item.id || item.device_code || item.code) || String(item.id || "");
      const matchedType = deviceTypes.find((deviceType) => String(deviceType.id) === String(item.device_type_id));
      const pairGroupItems = deviceRows
        .filter((row) => Number(row.pair || 0) > 0 && Number(row.pair || 0) === Number(item.pair || 0))
        .sort((left, right) => Number(left.pair_id || 0) - Number(right.pair_id || 0));
      const linkGroupItems = deviceRows
        .filter((row) => Number(row.link || 0) > 0 && Number(row.link || 0) === Number(item.link || 0))
        .sort((left, right) => String(left.id || "").localeCompare(String(right.id || "")));

      return {
        rawId: normalizedId,
        id: normalizedId,
        name: item.name || "",
        deviceTypeId: matchedType?.id || item.device_type_id,
        deviceTypeName: item.device_type_name || matchedType?.name || "",
        deviceTypeValue: matchedType?.type || "Camera",
        status: Number(item.status || 0),
        rtsp1: item.rtsp1 || "",
        rtsp2: item.rtsp2 || "",
        modbus: item.modbus || "",
        pair: Number(item.pair || 0),
        pairId: Number(item.pair_id || 0),
        pairDeviceIds: pairGroupItems
          .map((row) => String(row.id))
          .filter((deviceId) => deviceId !== normalizedId),
        link: Number(item.link || 0),
        linkDeviceIds: linkGroupItems
          .map((row) => String(row.id))
          .filter((deviceId) => deviceId !== normalizedId),
        icon1: item.icon1 || "",
        icon2: item.icon2 || "",
        description: getDescription(item),
        createdAt: item.created_at,
        updatedAt: item.updated_at
      };
    });
  }, [deviceRows, deviceTypes]);

  const filteredDevices = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return mappedDevices;
    }

    return mappedDevices.filter((item) => {
      return (
        String(item.id || "").toLowerCase().includes(keyword) ||
        String(item.name || "").toLowerCase().includes(keyword) ||
        String(item.deviceTypeName || "").toLowerCase().includes(keyword) ||
        String(item.description || "").toLowerCase().includes(keyword)
      );
    });
  }, [mappedDevices, searchKeyword]);

  const deviceTypeOptions = useMemo(() => {
    return deviceTypes.map((item) => ({
      value: item.id,
      label: item.name,
      rawType: item.type
    }));
  }, [deviceTypes]);

  const sensorOptions = useMemo(() => {
    return mappedDevices
      .filter((item) => String(item.deviceTypeValue || "").toLowerCase() === "sensor")
      .map((item) => ({ value: item.id, label: `${item.id} - ${item.name}` }));
  }, [mappedDevices]);

  const deviceOptions = useMemo(() => {
    return mappedDevices.map((item) => ({ value: item.id, label: `${item.id} - ${item.name}` }));
  }, [mappedDevices]);

  const handleCreateClick = async () => {
    setFormMode("create");
    setEditingItem(null);
    await refreshNextId();
    setOpenForm(true);
  };

  const handleEditClick = (item) => {
    setFormMode("edit");
    setEditingItem(item);
    setOpenForm(true);
  };

  const handleDeleteClick = (item) => {
    Modal.confirm({
      title: "Bạn có chắc muốn xóa thiết bị này?",
      cancelText: "Hủy",
      okText: "Xác nhận",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteDevice(item.rawId);
          setDeviceRows((prev) => prev.filter((row) => row.id !== item.rawId));
          refreshNextId();
          message.success("Đã xóa thiết bị");
        } catch (err) {
          console.error("Failed to delete device:", err);
          message.error("Không thể xóa thiết bị");
        }
      }
    });
  };

  const handleSubmitForm = async (values) => {
    try {
      const selectedType = deviceTypes.find((item) => item.id === values.deviceTypeId);
      const payload = {
        id: values.id,
        name: values.name,
        device_type_id: values.deviceTypeId,
        device_type_name: selectedType?.name,
        rtsp1: values.rtsp1 || "",
        rtsp2: values.rtsp2 || "",
        modbus: values.modbus || "",
        pair_enabled: values.pairEnabled,
        pair_device_ids: values.pairDeviceIds || [],
        link_enabled: values.linkEnabled,
        link_device_ids: values.linkDeviceIds || [],
        remove_icon1: values.removeIcon1,
        remove_icon2: values.removeIcon2,
        icons: values.icons || [],
        description: values.description || "",
      };

      if (formMode === "edit" && editingItem) {
        await updateDevice(editingItem.rawId, payload);
        message.success("Đã cập nhật thiết bị");
      } else {
        await createDevice(payload);
        refreshNextId();
        message.success("Đã tạo thiết bị");
      }

      setOpenForm(false);
      setEditingItem(null);
      await loadDevices();
    } catch (err) {
      console.error("Failed to save device:", err);
      message.error("Không thể lưu thiết bị");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16
        }}
      >
        <Input
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          placeholder="Tìm kiếm thiết bị"
          style={{ maxWidth: 360 }}
          allowClear
        />

        <Space>
          <Button type="primary" onClick={handleCreateClick}>
            Thêm thiết bị
          </Button>
        </Space>
      </div>

      <DeviceList
        dataSource={filteredDevices}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
      />

      <DeviceForm
        open={openForm}
        mode={formMode}
        initialValues={editingItem}
        nextId={nextId}
        deviceTypeOptions={deviceTypeOptions}
        sensorOptions={sensorOptions.filter((item) => item.value !== String(editingItem?.id || ""))}
        deviceOptions={deviceOptions.filter((item) => item.value !== String(editingItem?.id || ""))}
        onCancel={() => {
          setOpenForm(false);
          setEditingItem(null);
        }}
        onSubmit={handleSubmitForm}
      />
    </div>
  );
}
