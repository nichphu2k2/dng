import { Button, Space, Table } from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import SortableTableHeader, { compareText, compareThreeDigitId } from "./SortableTableHeader";

export default function DeviceTypeList({ dataSource, onEdit, onDelete }) {
  const columns = [
    {
      title: <SortableTableHeader title="Device Type ID" />,
      dataIndex: "id",
      sorter: (left, right) => compareThreeDigitId(left.id, right.id)
    },
    {
      title: <SortableTableHeader title="Device Type Name" />,
      dataIndex: "name",
      sorter: (left, right) => compareText(left.name, right.name)
    },
    {
      title: <SortableTableHeader title="Type" />,
      dataIndex: "type",
      sorter: (left, right) => compareText(left.type, right.type)
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
            aria-label={`edit-device-type-${record.id}`}
            icon={<EditOutlined />}
            onClick={() => onEdit(record)}
          />
          <Button
            aria-label={`delete-device-type-${record.id}`}
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
      rowKey="id"
      dataSource={dataSource}
      columns={columns}
      pagination={{ pageSize: 10 }}
    />
  );
}
