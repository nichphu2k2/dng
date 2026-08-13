import { Button, Image, Space, Table } from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import PlaneTreeRow from "./PlaneTreeRow";
import SortableTableHeader, { compareText } from "./SortableTableHeader";
import getFileUrl from "../utils/fileUrl";

export default function PlaneList({ dataSource, expandedRowKeys, onExpandedRowsChange, onEdit, onDelete }) {
  const columns = [
    {
      title: <SortableTableHeader title="Image" />,
      dataIndex: "image",
      render: (value) => {
        if (!value) {
          return null;
        }

        return (
          <Image
            src={getFileUrl(value)}
            alt="Plane"
            width={56}
            height={40}
            style={{ objectFit: "cover", borderRadius: 4 }}
            preview={false}
          />
        );
      }
    },
    {
      title: <SortableTableHeader title="Tên mặt phẳng" />,
      dataIndex: "name",
      sorter: (left, right) => compareText(left.name, right.name),
      render: (_, record) => <PlaneTreeRow name={record.name} />
    },
    {
      title: <SortableTableHeader title="Mặt phẳng cha" />,
      dataIndex: "parentPlaneName",
      sorter: (left, right) => compareText(left.parentPlaneName, right.parentPlaneName)
    },
    {
      title: <SortableTableHeader title="Loại" />,
      dataIndex: "type",
      sorter: (left, right) => compareText(left.type, right.type)
    },
    {
      title: <SortableTableHeader title="Mô tả" />,
      dataIndex: "description",
      sorter: (left, right) => compareText(left.description, right.description)
    },
    {
      title: "Action",
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            aria-label={`edit-plane-${record.id}`}
            icon={<EditOutlined />}
            onClick={() => onEdit(record)}
          />
          <Button
            aria-label={`delete-plane-${record.id}`}
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
      columns={columns}
      dataSource={dataSource}
      pagination={{ pageSize: 10 }}
      expandable={{
        expandRowByClick: true,
        rowExpandable: (record) => record.type !== "Dependence" && Array.isArray(record.children) && record.children.length > 0,
        expandedRowKeys,
        onExpandedRowsChange,
        childrenColumnName: "children"
      }}
    />
  );
}
