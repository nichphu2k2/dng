import { useEffect, useMemo, useState } from "react";
import { Avatar, Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Upload, message } from "antd";

import { createUser, deleteUser, getUsers, updateUser } from "../api/user";
import Permission from "../components/Permission";
import { getFileUrl } from "../utils/fileUrl";

const ROLE_OPTIONS = ["ADMIN", "OPERATOR", "VIEWER"];
const STATUS_OPTIONS = ["ACTIVE", "INACTIVE"];

export default function UserManagement() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [form] = Form.useForm();

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await getUsers();
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      message.error(err?.response?.data?.message || "Không thể tải danh sách user");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setAvatarFile(null);
    form.resetFields();
    form.setFieldsValue({
      role: "VIEWER",
      status: "ACTIVE"
    });
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setAvatarFile(null);
    form.setFieldsValue({
      username: row.username,
      email: row.email,
      full_name: row.full_name,
      role: row.role,
      status: row.status,
      password: ""
    });
    setOpen(true);
  };

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        avatar: avatarFile || undefined
      };

      if (!values.password) {
        delete payload.password;
      }

      if (editing) {
        await updateUser(editing.id, payload);
        message.success("Đã cập nhật user");
      } else {
        await createUser(payload);
        message.success("Đã tạo user");
      }

      setOpen(false);
      setEditing(null);
      setAvatarFile(null);
      form.resetFields();
      loadUsers();
    } catch (err) {
      if (err?.errorFields) {
        return;
      }
      message.error(err?.response?.data?.message || "Không thể lưu user");
    }
  };

  const columns = useMemo(() => ([
    {
      title: "Avatar",
      dataIndex: "avatar_url",
      width: 90,
      render: (value, row) => <Avatar src={value ? getFileUrl(value) : undefined}>{String(row.username || "U")[0]}</Avatar>
    },
    { title: "Username", dataIndex: "username", width: 150 },
    { title: "Email", dataIndex: "email", width: 220 },
    { title: "Họ tên", dataIndex: "full_name", width: 200 },
    { title: "Role", dataIndex: "role", width: 120 },
    { title: "Status", dataIndex: "status", width: 120 },
    {
      title: "Hành động",
      key: "action",
      width: 190,
      render: (_, row) => (
        <Permission roles={["ADMIN"]}>
          <Space>
            <Button size="small" onClick={() => openEdit(row)}>Sửa</Button>
            <Popconfirm
              title="Xóa user này?"
              okText="Xóa"
              cancelText="Hủy"
              disabled={row.username === "admin"}
              onConfirm={async () => {
                try {
                  await deleteUser(row.id);
                  message.success("Đã xóa user");
                  loadUsers();
                } catch (err) {
                  message.error(err?.response?.data?.message || "Không thể xóa user");
                }
              }}
            >
              <Button danger size="small" disabled={row.username === "admin"}>Xóa</Button>
            </Popconfirm>
          </Space>
        </Permission>
      )
    }
  ]), []);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Quản lý người dùng</h3>
        <Permission roles={["ADMIN"]}>
          <Button type="primary" onClick={openCreate}>Thêm user</Button>
        </Permission>
      </div>

      <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} />

      <Modal
        title={editing ? "Cập nhật user" : "Tạo user"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="Username" rules={[{ required: true, message: "Nhập username" }]}>
            <Input />
          </Form.Item>

          <Form.Item name="email" label="Email" rules={[{ required: true, message: "Nhập email" }]}>
            <Input />
          </Form.Item>

          <Form.Item name="full_name" label="Họ tên">
            <Input />
          </Form.Item>

          <Form.Item name="password" label={editing ? "Mật khẩu mới (tùy chọn)" : "Mật khẩu"} rules={editing ? [] : [{ required: true, message: "Nhập mật khẩu" }]}>
            <Input.Password />
          </Form.Item>

          <Form.Item name="role" label="Role" rules={[{ required: true, message: "Chọn role" }]}>
            <Select options={ROLE_OPTIONS.map((value) => ({ value, label: value }))} />
          </Form.Item>

          <Form.Item name="status" label="Status" rules={[{ required: true, message: "Chọn status" }]}>
            <Select options={STATUS_OPTIONS.map((value) => ({ value, label: value }))} />
          </Form.Item>

          <Form.Item label="Avatar">
            <Upload
              maxCount={1}
              beforeUpload={(file) => {
                setAvatarFile(file);
                return false;
              }}
              onRemove={() => setAvatarFile(null)}
              fileList={avatarFile ? [avatarFile] : []}
            >
              <Button>Chọn ảnh</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
