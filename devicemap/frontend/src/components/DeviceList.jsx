import { Badge, Button, Space, Table } from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import SortableTableHeader, { compareText, compareThreeDigitId } from "./SortableTableHeader";

export default function DeviceList({ dataSource, onEdit, onDelete }) {
  const columns = [
    {
      title: <SortableTableHeader title="Device ID" />,
      dataIndex: "id",
      sorter: (left, right) => compareThreeDigitId(left.id, right.id)
    },
    {
      title: <SortableTableHeader title="Device Name" />,
      dataIndex: "name",
      sorter: (left, right) => compareText(left.name, right.name)
    },
    {
      title: <SortableTableHeader title="Device Type" />,
      dataIndex: "deviceTypeName",
      sorter: (left, right) => compareText(left.deviceTypeName, right.deviceTypeName)
    },
    {
      title: <SortableTableHeader title="Status" />,
      dataIndex: "status",
      align: "center",
      render: (value) => (
        <div className="device-status-dot">
          <Badge color={Number(value) === 1 ? "#52c41a" : "#ff4d4f"} />
        </div>
      )
    },
    {
      title: "Pair",
      dataIndex: "pair",
      render: (_, record) => (Number(record.pair || 0) > 0 ? `${record.pair} / ${record.pairId}` : "-")
    },
    {
      title: "Link",
      dataIndex: "link",
      render: (value) => (Number(value || 0) > 0 ? value : "-")
    },
    {
      title: <SortableTableHeader title="Description" />,
      dataIndex: "description",
      sorter: (left, right) => compareText(left.description, right.description)
    },
    {
      title: "Action",
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
      scroll={{ x: 1400 }}
      pagination={{ pageSize: 10 }}
    />
  );
}
