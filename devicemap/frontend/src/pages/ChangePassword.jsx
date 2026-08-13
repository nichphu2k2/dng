import { useState } from "react";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { useNavigate } from "react-router-dom";

import { changePassword } from "../api/auth";
import { clearAuthSession, setRequiresPasswordChange } from "../utils/auth";

export default function ChangePassword() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    setError("");

    try {
      await changePassword({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword
      });

      setRequiresPasswordChange(false);
      navigate("/", { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        clearAuthSession();
        navigate("/login", { replace: true });
        return;
      }

      setError(err?.response?.data?.message || "Không thể đổi mật khẩu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(135deg, #fef9c3 0%, #bae6fd 100%)",
        padding: 20
      }}
    >
      <Card style={{ width: "100%", maxWidth: 460 }}>
        <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 6 }}>
          Đổi mật khẩu lần đầu
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          Bạn cần đổi mật khẩu mặc định trước khi tiếp tục.
        </Typography.Paragraph>

        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            label="Mật khẩu cũ"
            name="oldPassword"
            rules={[{ required: true, message: "Nhập mật khẩu cũ" }]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            label="Mật khẩu mới"
            name="newPassword"
            rules={[
              { required: true, message: "Nhập mật khẩu mới" },
              { min: 6, message: "Mật khẩu tối thiểu 6 ký tự" }
            ]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            label="Xác nhận mật khẩu mới"
            name="confirmPassword"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "Xác nhận mật khẩu mới" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Mật khẩu xác nhận không khớp"));
                }
              })
            ]}
          >
            <Input.Password />
          </Form.Item>

          <Button htmlType="submit" type="primary" block loading={loading}>
            Cập nhật mật khẩu
          </Button>
        </Form>
      </Card>
    </div>
  );
}
