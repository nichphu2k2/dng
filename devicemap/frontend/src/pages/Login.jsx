import { useMemo, useState } from "react";
import { Alert, Button, Card, Checkbox, Form, Input, Typography } from "antd";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { login } from "../api/auth";
import { getAuthUser, isAuthenticated, setAuthSession } from "../utils/auth";
import { connectSocket } from "../socket/socket";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const revokedMessage = location.state?.sessionRevoked ? "Tài khoản của bạn đã được đăng nhập trên một thiết bị hoặc trình duyệt khác." : "";

  const redirectTo = useMemo(() => {
    const from = location.state?.from;
    return typeof from === "string" && from ? from : "/";
  }, [location.state]);

  if (isAuthenticated() && getAuthUser()) {
    return <Navigate to="/" replace />;
  }

  const onFinish = async (values) => {
    setLoading(true);
    setError("");

    try {
      const res = await login(values);
      const token = res?.data?.token;
      const user = res?.data?.user;
      const requirePasswordChange = Boolean(res?.data?.require_password_change);
      const rememberMe = Boolean(values.rememberMe);

      if (!token || !user) {
        throw new Error("Missing login data");
      }

      setAuthSession({ token, user, requirePasswordChange, rememberMe });
      connectSocket();
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || "Đăng nhập thất bại");
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
        background: "linear-gradient(135deg, rgb(221 225 211) 0%, rgb(138 165 179) 100%)",
        padding: 20
      }}
    >
      <Card style={{ width: "100%", maxWidth: 420 }}>
        <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 6 }}>
          Đăng nhập
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          Vui lòng nhập thông tin để tiếp tục.
        </Typography.Paragraph>

        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
        {revokedMessage && <Alert type="warning" showIcon message={revokedMessage} style={{ marginBottom: 16 }} />}

        <Form layout="vertical" onFinish={onFinish} autoComplete="off">
          <Form.Item label="Tên đăng nhập" name="username" rules={[{ required: true, message: "Nhập tên đăng nhập" }]}>
            <Input autoFocus autoComplete="username" />
          </Form.Item>

          <Form.Item label="Mật khẩu" name="password" rules={[{ required: true, message: "Nhập mật khẩu" }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>

          <Form.Item name="rememberMe" valuePropName="checked" initialValue={false}>
            <Checkbox>Ghi nhớ đăng nhập</Checkbox>
          </Form.Item>

          <Button htmlType="submit" type="primary" block loading={loading}>
            Đăng nhập
          </Button>
        </Form>
      </Card>
    </div>
  );
}
