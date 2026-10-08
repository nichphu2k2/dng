import { useEffect, useMemo, useState } from "react";
import { Input, Space, message } from "antd";
import { SearchOutlined } from "@ant-design/icons";

import MonitorListTable from "../components/MonitorListTable";
import { getPlanes } from "../api/plane";

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

export default function MonitorList() {
  const [planes, setPlanes] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);

  const loadPlanes = async () => {
    try {
      const res = await getPlanes();
      const rows = Array.isArray(res.data) ? res.data : [];
      setPlanes(rows);
    } catch (err) {
      console.error("Failed to fetch planes:", err);
      message.error("Không thể tải danh sách bản đồ mặt phẳng");
    }
  };

  useEffect(() => {
    loadPlanes();
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
      String(item.description || "").toLowerCase().includes(keyword)
    ));
  }, [enrichedPlanes, searchKeyword]);

  const displayPlanes = useMemo(() => {
    return buildPlaneTree(filteredPlanes);
  }, [filteredPlanes]);

  return (
    <div className="page-container">

      <section className="page-content">
        <div className="search-section">
          <Space direction="vertical" style={{ marginBottom: "16px", maxWidth: "360px", width: "100%" }} size="middle">
            <Input
              placeholder="Tìm kiếm theo ID hoặc tên..."
              prefix={<SearchOutlined />}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              allowClear
            />
          </Space>
        </div>

        <MonitorListTable
          dataSource={displayPlanes}
          expandedRowKeys={expandedRowKeys}
          onExpandedRowsChange={setExpandedRowKeys}
        />
      </section>
    </div>
  );
}
