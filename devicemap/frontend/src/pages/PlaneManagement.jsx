import { useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Space, message } from "antd";

import PlaneForm from "../components/PlaneForm";
import PlaneList from "../components/PlaneList";
import { createPlane, deletePlane, getNextPlaneId, getPlanes, updatePlane } from "../api/plane";

const buildPlaneTree = (planes) => {
  const mapById = new Map(planes.map((item) => [String(item.id), { ...item }]));
  const roots = [];

  mapById.forEach((item) => {
    const isDependenceWithParent = item.type === "Dependence" && item.parentId;
    if (!isDependenceWithParent) {
      roots.push(item);
      return;
    }

    const parent = mapById.get(String(item.parentId));
    if (!parent || parent.type !== "Root") {
      roots.push(item);
      return;
    }

    if (!Array.isArray(parent.children)) {
      parent.children = [];
    }
    parent.children.push(item);
  });

  return roots;
};

export default function PlaneManagement() {
  const [planes, setPlanes] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingItem, setEditingItem] = useState(null);
  const [nextId, setNextId] = useState("...");
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);

  const loadPlanes = async () => {
    try {
      const res = await getPlanes();
      const rows = Array.isArray(res.data) ? res.data : [];
      setPlanes(rows);
    } catch (err) {
      console.error("Failed to fetch planes:", err);
      message.error("Không thể tải danh sách mặt phẳng");
    }
  };

  const refreshNextId = async () => {
    try {
      const res = await getNextPlaneId();
      setNextId(res?.data?.id || "...");
    } catch {
      setNextId("...");
    }
  };

  useEffect(() => {
    loadPlanes();
    refreshNextId();
  }, []);

  const planeMapById = useMemo(() => {
    const map = new Map();
    planes.forEach((item) => {
      map.set(String(item.id), item);
    });
    return map;
  }, [planes]);

  const enrichedPlanes = useMemo(() => {
    return planes.map((item) => {
      const parent = item.parentId ? planeMapById.get(String(item.parentId)) : null;

      return {
        ...item,
        parentPlaneName: parent?.name || ""
      };
    });
  }, [planeMapById, planes]);

  const filteredPlanes = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return enrichedPlanes;
    }

    return enrichedPlanes.filter((item) => (
      String(item.id || "").toLowerCase().includes(keyword) ||
      String(item.name || "").toLowerCase().includes(keyword) ||
      String(item.parentPlaneName || "").toLowerCase().includes(keyword) ||
      String(item.description || "").toLowerCase().includes(keyword)
    ));
  }, [enrichedPlanes, searchKeyword]);

  const treeData = useMemo(() => buildPlaneTree(filteredPlanes), [filteredPlanes]);

  const rootPlaneOptions = useMemo(() => {
    return planes
      .filter((item) => item.type === "Root")
      .map((item) => ({ value: String(item.id), label: item.name }));
  }, [planes]);

  const handleCreateClick = () => {
    setFormMode("create");
    setEditingItem(null);
    refreshNextId();
    setOpenForm(true);
  };

  const handleEditClick = (item) => {
    setFormMode("edit");
    setEditingItem(item);
    setOpenForm(true);
  };

  const handleDeleteClick = (item) => {
    const hasChildren = planes.some((plane) => String(plane.parentId || "") === String(item.id));

    if (hasChildren) {
      message.warning("Không thể xóa vì mặt phẳng này đang có mặt phẳng con");
      return;
    }

    Modal.confirm({
      title: "Bạn có chắc muốn xóa mặt phẳng này?",
      cancelText: "Hủy",
      okText: "Xác nhận",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deletePlane(item.id);
          setPlanes((prev) => prev.filter((row) => row.id !== item.id));
          refreshNextId();
          message.success("Đã xóa mặt phẳng");
        } catch (err) {
          console.error("Failed to delete plane:", err);
          message.error(err?.response?.data?.message || "Không thể xóa mặt phẳng");
        }
      }
    });
  };

  const handleSubmitForm = async (values) => {
    try {
      if (formMode === "edit" && editingItem) {
        const res = await updatePlane(editingItem.id, values);
        setPlanes((prev) => prev.map((item) => (item.id === editingItem.id ? res.data : item)));
        message.success("Đã cập nhật mặt phẳng");
      } else {
        const res = await createPlane(values);
        setPlanes((prev) => [res.data, ...prev]);
        refreshNextId();
        message.success("Đã tạo mặt phẳng");
      }

      setOpenForm(false);
      setEditingItem(null);
      await loadPlanes();
    } catch (err) {
      console.error("Failed to save plane:", err);
      message.error(err?.response?.data?.message || "Không thể lưu mặt phẳng");
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
          placeholder="Tìm kiếm mặt phẳng"
          style={{ maxWidth: 360 }}
          allowClear
        />

        <Space>
          <Button type="primary" onClick={handleCreateClick}>
            Thêm mặt phẳng
          </Button>
        </Space>
      </div>

      <PlaneList
        dataSource={treeData}
        expandedRowKeys={expandedRowKeys}
        onExpandedRowsChange={setExpandedRowKeys}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
      />

      <PlaneForm
        open={openForm}
        mode={formMode}
        initialValues={editingItem}
        nextId={nextId}
        rootPlaneOptions={rootPlaneOptions.filter((option) => String(option.value) !== String(editingItem?.id || ""))}
        onCancel={() => {
          setOpenForm(false);
          setEditingItem(null);
        }}
        onSubmit={handleSubmitForm}
      />
    </div>
  );
}
