import { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Input, InputNumber, Select, Spin, Typography, message } from "antd";

import { getAlertSetup, updateAlertSetup } from "../api/settings";

const DEFAULT_VALUES = {
  username: "",
  password: "",
  port: 3000,
  processing_time_value: 15,
  processing_time_unit: "minute"
};

export default function AlertSetupSettings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const res = await getAlertSetup();
        form.setFieldsValue({
          ...DEFAULT_VALUES,
          ...(res?.data || {})
        });
      } catch (err) {
        console.error("Failed to load alert setup:", err);
        message.error("Không thể tải cấu hình cảnh báo");
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
        username: String(values.username || "").trim(),
        password: String(values.password || "").trim(),
        processing_time_value: Number(values.processing_time_value),
        processing_time_unit: values.processing_time_unit
      };

      const res = await updateAlertSetup(payload);
      form.setFieldsValue({
        ...DEFAULT_VALUES,
        ...(res?.data || payload)
      });
      message.success("Đã lưu cấu hình cảnh báo");
    } catch (err) {
      console.error("Failed to save alert setup:", err);
      message.error(err?.response?.data?.message || "Không thể lưu cấu hình cảnh báo");
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
            Basic Auth
          </Typography.Title>

          <Form.Item
            name="username"
            label="Username"
            rules={[
              {
                pattern: /^[a-zA-Z0-9]*$/,
                message: "Username chỉ được nhập chữ và số"
              }
            ]}
          >
            <Input placeholder="Nhập username" maxLength={100} />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              {
                pattern: /^[a-zA-Z0-9]*$/,
                message: "Password chỉ được nhập chữ và số"
              }
            ]}
          >
            <Input.Password placeholder="Nhập password" maxLength={100} />
          </Form.Item>

          <Alert
            message="HTTP POST request"
            description={
              <>
                <div>
                  {`${window.location.origin}/api/devicemap`}
                </div>

                <pre
                  style={{
                    marginTop: 10,
                    marginBottom: 0
                  }}
                >
                  {`{"device_id":"xxx","plane_id":"xxx"}`}
                </pre>
              </>
            }
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />


          {/* <Form.Item
            name="port"
            label="Port"
          >
            <InputNumber disabled precision={0} style={{ width: 220 }} />
          </Form.Item> */}
        </Card>

        <Card>
          <Typography.Title level={4} style={{ marginTop: 0 }}>
            Thời gian cho phép xử lý cảnh báo
          </Typography.Title>

          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <Form.Item
              name="processing_time_value"
              rules={[
                { required: true, message: "Giá trị thời gian là bắt buộc" },
                {
                  validator: (_, value) => {
                    if (Number.isInteger(value) && value >= 1) {
                      return Promise.resolve();
                    }

                    return Promise.reject(new Error("Giá trị thời gian phải là số nguyên lớn hơn 0"));
                  }
                }
              ]}
              style={{ marginBottom: 0 }}
            >
              <InputNumber min={1} precision={0} style={{ width: 160 }} />
            </Form.Item>

            <Form.Item
              name="processing_time_unit"
              rules={[{ required: true, message: "Đơn vị thời gian là bắt buộc" }]}
              style={{ marginBottom: 0 }}
            >
              <Select
                style={{ width: 160 }}
                options={[
                  { value: "minute", label: "Phút" },
                  { value: "hour", label: "Giờ" },
                  { value: "day", label: "Ngày" }
                ]}
              />
            </Form.Item>
          </div>
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
