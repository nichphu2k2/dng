import { useEffect, useState } from "react";
import { Button, Descriptions, Modal, Tag } from "antd";

const isSensorDevice = (device) => {
  const type = String(device?.device_type || device?.type || "").toLowerCase();
  return type === "sensor";
};

const isCameraDevice = (device) => {
  const type = String(device?.device_type || device?.type || "").toLowerCase();
  return type === "camera";
};

export default function DevicePopup({
  device,
  open,
  onClose,
  onLiveView,
  onTurnOff
}) {
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    if (open) {
      setShowDetail(false);
    }
  }, [open]);

  const pairValue = Number(device?.pair || 0);
  const pairIdValue = Number(device?.pair_id || 0);
  const linkValue = Number(device?.link || 0);

  const footerButtons = !showDetail
    ? [
        <Button key="detail" onClick={() => setShowDetail(true)}>
          Chi tiết
        </Button>,

        isCameraDevice(device) && (
          <Button key="live" type="primary" onClick={onLiveView}>
            Live View
          </Button>
        ),

        isSensorDevice(device) && (
          <Button key="off" danger onClick={onTurnOff}>
            Tắt
          </Button>
        )
      ].filter(Boolean)
    : null;

  return (
    <Modal
      open={open}
      title={device ? `${device.id} | ${device.name}` : ""}
      onCancel={onClose}
      maskClosable={false}
      footer={footerButtons}
      destroyOnClose
      centered
      zIndex={9999}
    >
      {device && showDetail && (
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="ID">{device.id}</Descriptions.Item>

          <Descriptions.Item label="Tên">
            {device.name}
          </Descriptions.Item>

          <Descriptions.Item label="Loại">
            {isCameraDevice(device) && (
              <Tag color="blue">Camera</Tag>
            )}

            {isSensorDevice(device) && (
              <Tag color="green">Sensor</Tag>
            )}

            {!isCameraDevice(device) &&
              !isSensorDevice(device) && (
                <Tag>{device.type || "Unknown"}</Tag>
              )}
          </Descriptions.Item>

          <Descriptions.Item label="Trạng thái">
            <Tag
              color={
                Number(device.status) === 1
                  ? "success"
                  : "default"
              }
            >
              {Number(device.status) === 1
                ? "Đang giám sát"
                : "Chưa giám sát"}
            </Tag>
          </Descriptions.Item>

          <Descriptions.Item label="Link|Pair|Pair_ID">
            {`${linkValue} | ${pairValue} | ${pairIdValue}`}
          </Descriptions.Item>

          <Descriptions.Item label="Mô tả">
            {device.description || "-"}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Modal>
  );
}