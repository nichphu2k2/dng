import { useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Space, message } from "antd";

import DeviceTypeForm from "../components/DeviceTypeForm";
import DeviceTypeList from "../components/DeviceTypeList";
import {
  createDeviceType,
  deleteDeviceType,
  getNextDeviceTypeId,
  getDeviceTypes,
  updateDeviceType
} from "../api/deviceType";

export default function DeviceTypeManagement() {
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingItem, setEditingItem] = useState(null);
  const [nextId, setNextId] = useState("...");

  const loadDeviceTypes = async () => {
    try {
      const res = await getDeviceTypes();
      setDeviceTypes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch device types:", err);
      message.error("Không thể tải danh sách loại thiết bị");
    }
  };

  useEffect(() => {
    loadDeviceTypes();
  }, []);

  const refreshNextId = async () => {
    try {
      const res = await getNextDeviceTypeId();
      const id = res?.data?.id || "...";
      setNextId(id);
      return id;
    } catch {
      setNextId("...");
      return "...";
    }
  };

  const filteredDeviceTypes = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return deviceTypes;
    }

    return deviceTypes.filter((item) => {
      return (
        String(item.id || "").toLowerCase().includes(keyword) ||
        String(item.name || "").toLowerCase().includes(keyword) ||
        String(item.type || "").toLowerCase().includes(keyword)
      );
    });
  }, [deviceTypes, searchKeyword]);

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
      title: "Bạn có chắc muốn xóa loại thiết bị này?",
      cancelText: "Hủy",
      okText: "Xác nhận",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteDeviceType(item.id);
          setDeviceTypes((prev) => prev.filter((row) => row.id !== item.id));
          message.success("Đã xóa loại thiết bị");
        } catch (err) {
          console.error("Failed to delete device type:", err);
          message.error("Không thể xóa loại thiết bị");
        }
      }
    });
  };

  const handleSubmitForm = async (values) => {
    try {
      if (formMode === "edit" && editingItem) {
        const res = await updateDeviceType(editingItem.id, {
          name: values.name,
          description: values.description
        });

        setDeviceTypes((prev) => prev.map((item) => (item.id === editingItem.id ? res.data : item)));
        message.success("Đã cập nhật loại thiết bị");
      } else {
        const res = await createDeviceType(values);
        setDeviceTypes((prev) => [res.data, ...prev]);
        refreshNextId();
        message.success("Đã tạo loại thiết bị");
      }

      setOpenForm(false);
      setEditingItem(null);
    } catch (err) {
      console.error("Failed to save device type:", err);
      message.error("Không thể lưu loại thiết bị");
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
          placeholder="Tìm kiếm loại thiết bị"
          style={{ maxWidth: 360 }}
          allowClear
        />

        <Space>
          <Button type="primary" onClick={handleCreateClick}>
            Thêm loại thiết bị
          </Button>
        </Space>
      </div>

      <DeviceTypeList
        dataSource={filteredDeviceTypes}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
      />

      <DeviceTypeForm
        open={openForm}
        mode={formMode}
        initialValues={editingItem}
        nextId={nextId}
        onCancel={() => {
          setOpenForm(false);
          setEditingItem(null);
        }}
        onSubmit={handleSubmitForm}
      />
    </div>
  );
}
