import { useEffect, useState } from "react";
import { Alert, Button, Card, Checkbox, Form, Input, InputNumber, Spin, Typography, message } from "antd";

import { getNetworkOptixSettings, updateNetworkOptixSettings } from "../api/settings";

const DEFAULT_VALUES = {
  ip: "",
  port: 7001,
  username: "",
  password: "",
  sync_enabled: 0
};

export default function NetworkOptixSettings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const res = await getNetworkOptixSettings();
        const data = res?.data || {};
        setHasPassword(Boolean(data.has_password));
        form.setFieldsValue({
          ...DEFAULT_VALUES,
          ...data,
          password: ""
        });
      } catch (err) {
        console.error("Failed to load NX settings:", err);
        message.error("Không thể tải cấu hình NX Server");
        form.setFieldsValue(DEFAULT_VALUES);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [form]);

  const onSubmit = async (values) => {
    setSaving(true);
    try {
      const payload = {
        ip: String(values.ip || "").trim(),
        port: Number(values.port),
        username: String(values.username || "").trim(),
        sync_enabled: values.sync_enabled ? 1 : 0
      };

      const password = String(values.password || "").trim();
      if (password) {
        payload.password = password;
      }

      const res = await updateNetworkOptixSettings(payload);
      const data = res?.data || {};
      setHasPassword(Boolean(data.has_password));
      form.setFieldsValue({
        ...DEFAULT_VALUES,
        ...data,
        password: ""
      });
      message.success("Đã lưu cấu hình NX Server");
    } catch (err) {
      console.error("Failed to save NX settings:", err);
      message.error(err?.response?.data?.message || "Không thể lưu cấu hình NX Server");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <Form
        layout="vertical"
        form={form}
        initialValues={DEFAULT_VALUES}
        onFinish={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <Card>
          <Typography.Title level={4} style={{ marginTop: 0 }}>
            Cài đặt kết nối
          </Typography.Title>

          <Form.Item
            name="ip"
            label="IP"
            rules={[{ required: true, message: "IP là bắt buộc" }]}
          >
            <Input placeholder="Nhập IP NX Server" maxLength={255} />
          </Form.Item>

          <Form.Item
            name="port"
            label="Port"
            rules={[{ required: true, message: "Port là bắt buộc" }]}
          >
            <InputNumber min={1} max={65535} precision={0} style={{ width: 220 }} />
          </Form.Item>

          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: true, message: "Username là bắt buộc" }]}
          >
            <Input placeholder="Nhập username NX Server" maxLength={100} />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
          >
            <Input.Password
              placeholder={hasPassword ? "Để trống nếu không đổi mật khẩu" : "Nhập password NX Server"}
              maxLength={200}
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item name="sync_enabled" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>Đồng bộ Camera với NX</Checkbox>
          </Form.Item>

          <Alert
            style={{ marginTop: 16 }}
            type="info"
            showIcon
            message="Đồng bộ Camera"
            description={
              <>
                Khi bật, hệ thống sẽ đồng bộ Camera với NX VMS.
                <br />
                Khi tắt, có thể tạo thêm các Camera ảo.
              </>
            }
          />
        </Card>

        <div>
          <Button type="primary" htmlType="submit" loading={saving}>
            Lưu cấu hình
          </Button>
        </div>
      </Form>
    </div>
  );
}
