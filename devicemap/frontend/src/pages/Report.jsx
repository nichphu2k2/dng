import { useEffect, useMemo, useState } from "react";
import { Button, DatePicker, Dropdown, Space, Table } from "antd";
import dayjs from "dayjs";

import {
  exportReportDevicesExcel,
  exportReportDevicesPdf,
  exportReportHistoryExcel,
  exportReportHistoryPdf,
  exportReportPlanesExcel,
  exportReportPlanesPdf,
  getReports
} from "../api/report";
import downloadFile from "../utils/downloadFile";

const toQueryDate = (value) => {
  if (!value) {
    return undefined;
  }
  return dayjs(value).format("YYYY-MM-DD");
};

const mapStateLabel = (state) => {
  if (Number(state) === 1) return "Đã xử lý";
  if (Number(state) === 2) return "Bỏ qua";
  return "Chưa xử lý";
};

const parseFileNameFromDisposition = (contentDisposition) => {
  const raw = String(contentDisposition || "");

  const utf8Match = raw.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]).replace(/^"|"$/g, "").trim();
  }

  const basicMatch = raw.match(/filename=([^;]+)/i);
  if (basicMatch?.[1]) {
    return basicMatch[1].replace(/^"|"$/g, "").trim();
  }

  return "";
};

const ensureFileExtension = (fileName, extension) => {
  const safeName = String(fileName || "").trim().replace(/^"|"$/g, "");
  if (!safeName) {
    return `export.${extension}`;
  }

  return safeName.toLowerCase().endsWith(`.${extension}`)
    ? safeName
    : `${safeName}.${extension}`;
};

export default function Report() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0
  });

  const queryParams = useMemo(() => ({
    fromDate: toQueryDate(fromDate),
    toDate: toQueryDate(toDate)
  }), [fromDate, toDate]);

  const loadReports = async (nextPage = pagination.page, nextPageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const res = await getReports({
        ...queryParams,
        page: nextPage,
        pageSize: nextPageSize
      });

      const payload = res?.data || {};
      setRows(Array.isArray(payload.items) ? payload.items : []);
      setPagination({
        page: payload.pagination?.page || nextPage,
        pageSize: payload.pagination?.pageSize || nextPageSize,
        total: payload.pagination?.total || 0
      });
    } catch (err) {
      setRows([]);
      setPagination((prev) => ({ ...prev, total: 0 }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports(1, pagination.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParams.fromDate, queryParams.toDate]);

  const handleExport = async (type) => {
    let request = null;
    let extension = "dat";

    if (type === "excel-history") {
      request = () => exportReportHistoryExcel(queryParams);
      extension = "xlsx";
    }
    if (type === "excel-devices") {
      request = () => exportReportDevicesExcel();
      extension = "xlsx";
    }
    if (type === "excel-planes") {
      request = () => exportReportPlanesExcel();
      extension = "xlsx";
    }
    if (type === "pdf-history") {
      request = () => exportReportHistoryPdf(queryParams);
      extension = "pdf";
    }
    if (type === "pdf-devices") {
      request = () => exportReportDevicesPdf();
      extension = "pdf";
    }
    if (type === "pdf-planes") {
      request = () => exportReportPlanesPdf();
      extension = "pdf";
    }

    if (!request) {
      return;
    }

    const response = await request();
    const contentDisposition = response.headers?.["content-disposition"];
    const parsedFileName = parseFileNameFromDisposition(contentDisposition);
    const fileName = ensureFileExtension(parsedFileName, extension);

    const blob = response.data instanceof Blob
      ? response.data
      : new Blob([response.data], { type: response.headers?.["content-type"] || undefined });

    downloadFile(blob, fileName);
  };

  const excelMenu = {
    items: [
      { key: "excel-history", label: "Lịch sử cảnh báo" },
      { key: "excel-devices", label: "Danh sách thiết bị" },
      { key: "excel-planes", label: "Danh sách mặt phẳng" }
    ],
    onClick: ({ key }) => handleExport(key)
  };

  const pdfMenu = {
    items: [
      { key: "pdf-history", label: "Lịch sử cảnh báo" },
      { key: "pdf-devices", label: "Danh sách thiết bị" },
      { key: "pdf-planes", label: "Danh sách mặt phẳng" }
    ],
    onClick: ({ key }) => handleExport(key)
  };

  return (
    <div style={{ padding: 20 }}>
      <Space wrap>
        <DatePicker
          value={fromDate}
          onChange={(value) => setFromDate(value)}
          placeholder="Từ ngày"
          format="YYYY-MM-DD"
        />

        <DatePicker
          value={toDate}
          onChange={(value) => setToDate(value)}
          placeholder="Đến ngày"
          format="YYYY-MM-DD"
        />

        <Dropdown menu={excelMenu} trigger={["click"]}>
          <Button type="primary">Xuất Excel</Button>
        </Dropdown>

        {/* <Dropdown menu={pdfMenu} trigger={["click"]}>
          <Button>Xuất PDF</Button>
        </Dropdown> */}
      </Space>

      <Table
        style={{ marginTop: 20 }}
        dataSource={rows}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `${total} Cảnh báo`
        }}
        onChange={(nextPagination) => {
          loadReports(nextPagination.current, nextPagination.pageSize);
        }}
        columns={[
          { title: "STT", dataIndex: "stt", width: 70 },
          { title: "Tên thiết bị", dataIndex: "camera_name", width: 120 },
          { title: "ID thiết bị", dataIndex: "camera_id", width: 120 },
          { title: "Tên mặt phẳng", dataIndex: "plane_name", width: 120 },
          { title: "ID mặt phẳng", dataIndex: "plane_id", width: 120 },
          {
            title: "Trạng thái",
            dataIndex: "state",
            width: 140,
            render: (value, row) => row.state_label || mapStateLabel(value)
          },
          { title: "Bắt đầu cảnh báo", dataIndex: "created_at", width: 160 },
          { title: "Kết thúc cảnh báo", dataIndex: "updated_at", width: 160 },
          { title: "Người xác nhận", dataIndex: "confirmed_by_name", width: 160 },
          // { title: "Thời gian xác nhận", dataIndex: "confirmed_at", width: 180 },
          { title: "Nội dung cảnh báo", dataIndex: "description" }
          // { title: "Người phụ trách", dataIndex: "user_id", width: 140 }
        ]}
      />
    </div>
  );
}