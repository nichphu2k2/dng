import { Button, Image, Space, Table } from "antd";
import { useNavigate } from "react-router-dom";
import PlaneTreeRow from "./PlaneTreeRow";
import SortableTableHeader, { compareText, compareThreeDigitId } from "./SortableTableHeader";
import getFileUrl from "../utils/fileUrl";

export default function MapList({ dataSource, expandedRowKeys, onExpandedRowsChange }) {
  const navigate = useNavigate();

  const columns = [
    {
      title: <SortableTableHeader title="Mặt phẳng" />,
      dataIndex: "image",
      width: 175,
      render: (value) => {
        if (!value) {
          return null;
        }

        return (
          <Image
            src={getFileUrl(value)}
            alt="Map"
            width={56}
            height={40}
            style={{ objectFit: "cover", borderRadius: 4 }}
            preview={false}
          />
        );
      }
    },
    {
      title: <SortableTableHeader title="ID" />,
      dataIndex: "id",
      sorter: (left, right) => compareThreeDigitId(String(left.id), String(right.id))
    },
    {
      title: <SortableTableHeader title="Tên mặt phẳng" />,
      dataIndex: "name",
      sorter: (left, right) => compareText(left.name, right.name),
      render: (_, record) => <PlaneTreeRow name={record.name} />
    },
    {
      title: <SortableTableHeader title="Mô tả" />,
      dataIndex: "description",
      sorter: (left, right) => compareText(left.description, right.description)
    },
    {
      title: "Hành động",
      width: 120,
      render: (_, record) => {
        // Only show Monitor button for Dependence type
        if (record.type !== "Dependence") {
          return null;
        }

        return (
          <Space>
            <Button
              type="primary"
              size="small"
              onClick={() => navigate(`/monitor/${record.id}`)}
            >
              Giám sát
            </Button>
          </Space>
        );
      }
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
        rowExpandable: (record) => Array.isArray(record.children) && record.children.length > 0,
        expandedRowKeys,
        onExpandedRowsChange
      }}
    />
  );
}
