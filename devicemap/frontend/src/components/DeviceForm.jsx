import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Col, Form, Image, Input, Modal, Row, Select, Upload, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import getFileUrl from "../utils/fileUrl";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/svg+xml"];

export default function DeviceForm({
  open,
  mode,
  initialValues,
  nextId,
  deviceTypeOptions,
  sensorOptions,
  deviceOptions,
  onCancel,
  onSubmit
}) {
  const [form] = Form.useForm();
  const [selectedIcons, setSelectedIcons] = useState([]);
  const [previewBySlot, setPreviewBySlot] = useState({ slot1: null, slot2: null });
  const [removeIcon1, setRemoveIcon1] = useState(false);
  const [removeIcon2, setRemoveIcon2] = useState(false);

  const deviceTypeId = Form.useWatch("deviceTypeId", form);
  const pairEnabled = Form.useWatch("pairEnabled", form);
  const linkEnabled = Form.useWatch("linkEnabled", form);

  const selectedType = useMemo(() => {
    return deviceTypeOptions.find((item) => String(item.value) === String(deviceTypeId));
  }, [deviceTypeId, deviceTypeOptions]);

  const isSensor = String(selectedType?.rawType || "").toLowerCase() === "sensor";
  const isCamera = String(selectedType?.rawType || "").toLowerCase() === "camera";

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedIcons([]);
    setRemoveIcon1(false);
    setRemoveIcon2(false);
    setPreviewBySlot({ slot1: null, slot2: null });

    if (mode === "edit" && initialValues) {
      form.setFieldsValue({
        id: initialValues.id,
        name: initialValues.name,
        deviceTypeId: initialValues.deviceTypeId,
        rtsp1: initialValues.rtsp1 || "",
        rtsp2: initialValues.rtsp2 || "",
        modbus: initialValues.modbus || "",
        pairEnabled: Number(initialValues.pair || 0) > 0,
        pairDeviceIds: initialValues.pairDeviceIds || [],
        linkEnabled: Number(initialValues.link || 0) > 0,
        linkDeviceIds: initialValues.linkDeviceIds || [],
        description: initialValues.description
      });

      setPreviewBySlot({
        slot1: initialValues.icon1 ? getFileUrl(initialValues.icon1) : null,
        slot2: initialValues.icon2 ? getFileUrl(initialValues.icon2) : null
      });
      return;
    }

    form.setFieldsValue({
      id: nextId || "...",
      name: "",
      deviceTypeId: undefined,
      rtsp1: "",
      rtsp2: "",
      modbus: "",
      pairEnabled: false,
      pairDeviceIds: [],
      linkEnabled: false,
      linkDeviceIds: [],
      description: ""
    });
  }, [form, initialValues, mode, nextId, open]);

  const beforeUpload = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      message.error("Chỉ chấp nhận JPG, PNG hoặc SVG");
      return Upload.LIST_IGNORE;
    }

    if (selectedIcons.length >= 2) {
      message.error("Chỉ được tải tối đa 2 ảnh icon");
      return Upload.LIST_IGNORE;
    }

    const nextFiles = [...selectedIcons, file].slice(0, 2);
    setSelectedIcons(nextFiles);

    if (nextFiles.length >= 1) {
      const reader1 = new FileReader();
      reader1.onload = () => {
        setPreviewBySlot((prev) => ({ ...prev, slot1: String(reader1.result || "") }));
      };
      reader1.readAsDataURL(nextFiles[0]);
    }

    if (nextFiles.length >= 2) {
      const reader2 = new FileReader();
      reader2.onload = () => {
        setPreviewBySlot((prev) => ({ ...prev, slot2: String(reader2.result || "") }));
      };
      reader2.readAsDataURL(nextFiles[1]);
    }

    if (nextFiles.length === 1) {
      setPreviewBySlot((prev) => ({ ...prev, slot2: removeIcon2 ? null : prev.slot2 }));
    }

    setRemoveIcon1(false);
    if (nextFiles.length > 1) {
      setRemoveIcon2(false);
    }

    return false;
  };

  const removeSlot = (slot) => {
    if (slot === 1) {
      setRemoveIcon1(true);
      setSelectedIcons([]);
      setPreviewBySlot((prev) => ({ ...prev, slot1: null }));
      return;
    }

    setRemoveIcon2(true);
    setSelectedIcons([]);
    setPreviewBySlot((prev) => ({ ...prev, slot2: null }));
  };

  const handleOk = async () => {
    const values = await form.validateFields();

    onSubmit({
      ...values,
      rtsp1: isCamera ? values.rtsp1 || "" : "",
      rtsp2: isCamera ? values.rtsp2 || "" : "",
      modbus: isSensor ? values.modbus || "" : "",
      pairEnabled: isSensor ? !!values.pairEnabled : false,
      pairDeviceIds: isSensor ? (values.pairDeviceIds || []) : [],
      linkEnabled: !!values.linkEnabled,
      linkDeviceIds: values.linkDeviceIds || [],
      removeIcon1,
      removeIcon2,
      icons: selectedIcons
    });
  };

  return (
    <Modal
      title={mode === "edit" ? "Chỉnh sửa thiết bị" : "Thêm thiết bị"}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText={mode === "edit" ? "Cập nhật" : "Tạo mới"}
      cancelText="Hủy"
      destroyOnClose
      width={860}
    >
      <Form form={form} layout="vertical">
        <Row gutter={12}>
          <Col xs={24} md={8}>
            <Form.Item name="id" label="ID" rules={[{ required: true }]}>
              <Input readOnly />
            </Form.Item>
          </Col>
          <Col xs={24} md={16}>
            <Form.Item
              name="name"
              label="Tên thiết bị"
              rules={[{ required: true, message: "Vui lòng nhập tên thiết bị" }]}
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="deviceTypeId"
          label="Loại thiết bị"
          rules={[{ required: true, message: "Vui lòng chọn loại thiết bị" }]}
        >
          <Select options={deviceTypeOptions} />
        </Form.Item>

        {isCamera && (
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="rtsp1" label="Main Stream">
                <Input placeholder="rtsp://..." />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="rtsp2" label="Sub Stream">
                <Input placeholder="rtsp://..." />
              </Form.Item>
            </Col>
          </Row>
        )}

        {isSensor && (
          <>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="modbus" label="Modbus">
                <Input placeholder="mbpoll -m tcp -a 1 -t 0 -r <coil> <ip_device> 0" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24}>
              <Form.Item name="pairEnabled" valuePropName="checked">
                <Checkbox>Ghép đôi</Checkbox>
              </Form.Item>
            </Col>
          </Row>

            {pairEnabled && (
              <Form.Item name="pairDeviceIds" label="Chọn Sensor ghép đôi theo thứ tự click">
                <Select
                  mode="multiple"
                  options={sensorOptions}
                  placeholder="Chọn sensor"
                />
              </Form.Item>
            )}
          </>
        )}

        <Form.Item name="linkEnabled" valuePropName="checked">
          <Checkbox>Liên kết</Checkbox>
        </Form.Item>

        {linkEnabled && (
          <Form.Item name="linkDeviceIds" label="Chọn thiết bị liên kết theo thứ tự click">
            <Select
              mode="multiple"
              options={deviceOptions}
              placeholder="Chọn device"
            />
          </Form.Item>
        )}

        <Row gutter={12}>
          <Col xs={24} md={10}>
            <Form.Item label="Tải ảnh thiết bị">
              <Upload
                beforeUpload={beforeUpload}
                maxCount={2}
                accept=".jpg,.jpeg,.png,.svg"
                fileList={selectedIcons.map((file) => ({ uid: file.uid, name: file.name, status: "done" }))}
                onRemove={(file) => {
                  const index = selectedIcons.findIndex((item) => item.uid === file.uid);
                  if (index === 0) {
                    removeSlot(1);
                  }
                  if (index === 1) {
                    removeSlot(2);
                  }
                  return true;
                }}
              >
                <Button type="default" icon={<UploadOutlined />}>
                  Tải tối đa 2 ảnh
                </Button>
              </Upload>
            </Form.Item>
          </Col>

          <Col xs={24} md={14}>
            <Form.Item label="Xem trước ảnh">
              <Row gutter={12}>
                <Col span={12}>
                  <div style={{ marginBottom: 6, color: "#666" }}>Ảnh 1</div>
                  <div
                    style={{
                      width: "100%",
                      minHeight: 110,
                      border: "1px solid #d9d9d9",
                      borderRadius: 8,
                      background: "#fafafa",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 8
                    }}
                  >
                    {previewBySlot.slot1 ? (
                      <Image src={previewBySlot.slot1} alt="Icon 1" preview={false} style={{ maxHeight: 90 }} />
                    ) : (
                      <span style={{ color: "#999" }}>Chưa có ảnh</span>
                    )}
                  </div>
                  {previewBySlot.slot1 && (
                    <Button style={{ marginTop: 8 }} onClick={() => removeSlot(1)}>
                      Xóa ảnh 1
                    </Button>
                  )}
                </Col>

                <Col span={12}>
                  <div style={{ marginBottom: 6, color: "#666" }}>Ảnh 2</div>
                  <div
                    style={{
                      width: "100%",
                      minHeight: 110,
                      border: "1px solid #d9d9d9",
                      borderRadius: 8,
                      background: "#fafafa",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 8
                    }}
                  >
                    {previewBySlot.slot2 ? (
                      <Image src={previewBySlot.slot2} alt="Icon 2" preview={false} style={{ maxHeight: 90 }} />
                    ) : (
                      <span style={{ color: "#999" }}>Chưa có ảnh</span>
                    )}
                  </div>
                  {previewBySlot.slot2 && (
                    <Button style={{ marginTop: 8 }} onClick={() => removeSlot(2)}>
                      Xóa ảnh 2
                    </Button>
                  )}
                </Col>
              </Row>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="description" label="Mô tả">
          <Input.TextArea autoSize={{ minRows: 2 }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
