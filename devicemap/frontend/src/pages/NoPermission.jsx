import { Button, Result } from "antd";
import { useNavigate } from "react-router-dom";

export default function NoPermission() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: 24 }}>
      <Result
        status="403"
        title="403"
        subTitle="Bạn không có quyền truy cập trang này"
        extra={(
          <Button type="primary" onClick={() => navigate("/")}>
            Về trang chủ
          </Button>
        )}
      />
    </div>
  );
}
