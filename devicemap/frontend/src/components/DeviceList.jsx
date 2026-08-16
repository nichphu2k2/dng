import { Badge, Button, Space, Table } from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import SortableTableHeader, { compareText, compareThreeDigitId } from "./SortableTableHeader";

export default function DeviceList({ dataSource, onEdit, onDelete }) {
  const columns = [
    {
      title: <SortableTableHeader title="ID" />,
      dataIndex: "id",
      width: 50,
      sorter: (left, right) => compareThreeDigitId(left.id, right.id)
    },
    {
      title: <SortableTableHeader title="Tên thiết bị" />,
      dataIndex: "name",
      sorter: (left, right) => compareText(left.name, right.name)
    },
    {
      title: <SortableTableHeader title="Loại thiết bị" />,
      dataIndex: "deviceTypeName",
      width: 150,
      sorter: (left, right) => compareText(left.deviceTypeName, right.deviceTypeName)
    },
    {
      title: <SortableTableHeader title="Trạng thái" />,
      dataIndex: "status",
      width: 150,
      align: "center",
      render: (value) => (
        <div className="device-status-dot">
          <Badge color={Number(value) === 1 ? "#52c41a" : "#ff4d4f"} />
        </div>
      )
    },
    {
      title: "Ghép đôi",
      dataIndex: "pair",
      width: 120,
      render: (_, record) => (Number(record.pair || 0) > 0 ? `${record.pair} / ${record.pairId}` : "-")
    },
    {
      title: "Liên kết",
      dataIndex: "link",
      width: 120,
      render: (value) => (Number(value || 0) > 0 ? value : "-")
    },
    {
      title: <SortableTableHeader title="Mô tả" />,
      dataIndex: "description",
      sorter: (left, right) => compareText(left.description, right.description)
    },
    {
      title: "Hành động",
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            aria-label={`edit-device-${record.rawId}`}
            icon={<EditOutlined />}
            onClick={() => onEdit(record)}
          />
          <Button
            aria-label={`delete-device-${record.rawId}`}
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete(record)}
          />
        </Space>
      )
    }
  ];

  return (
    <Table
      rowKey="rawId"
      dataSource={dataSource}
      columns={columns}
      scroll={{ x: 700 }}
      pagination={{ pageSize: 10 }}
    />
  );
}
