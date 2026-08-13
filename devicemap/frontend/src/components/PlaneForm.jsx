import { useEffect, useState } from "react";
import { Button, Checkbox, Col, Form, Image, Input, Modal, Row, Select, Upload, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import getFileUrl from "../utils/fileUrl";

const { TextArea } = Input;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/svg+xml"];

export default function PlaneForm({
  open,
  mode,
  initialValues,
  nextId,
  rootPlaneOptions,
  onCancel,
  onSubmit
}) {
  const [form] = Form.useForm();
  const [selectedFile, setSelectedFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const planeType = Form.useWatch("planeType", form) || "Dependence";

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedFile(null);
    setRemoveImage(false);
    setPreviewUrl(null);

    if (mode === "edit" && initialValues) {
      setPreviewUrl(initialValues.image ? getFileUrl(initialValues.image) : null);

      form.setFieldsValue({
        id: initialValues.id,
        name: initialValues.name,
        planeType: initialValues.type || "Dependence",
        parentPlaneId: initialValues.parentId || undefined,
        description: initialValues.description || ""
      });
      return;
    }

    form.setFieldsValue({
      id: nextId || "...",
      name: "",
      planeType: "Dependence",
      parentPlaneId: undefined,
      description: ""
    });
  }, [form, initialValues, mode, nextId, open]);

  const handleBeforeUpload = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      message.error("Chỉ chấp nhận JPG, PNG hoặc SVG");
      return Upload.LIST_IGNORE;
    }

    setSelectedFile(file);
    setRemoveImage(false);

    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(String(reader.result || ""));
    reader.readAsDataURL(file);

    return false;
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (mode === "edit") {
      setRemoveImage(true);
    }
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();

    if (values.planeType === "Dependence" && !selectedFile && !previewUrl && mode !== "edit") {
      message.error("Vui lòng tải ảnh mặt phẳng");
      return;
    }

    onSubmit({
      id: values.id,
      name: values.name,
      type: values.planeType,
      parentId: values.planeType === "Root" ? null : values.parentPlaneId || null,
      description: values.description || "",
      image: values.planeType === "Root" ? null : selectedFile,
      removeImage: values.planeType === "Root" ? true : removeImage
    });
  };

  return (
    <Modal
      title={mode === "edit" ? "Chỉnh sửa mặt phẳng" : "Thêm mặt phẳng"}
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      okText={mode === "edit" ? "Cập nhật" : "Tạo mới"}
      cancelText="Hủy"
      destroyOnClose
      width={760}
    >
      <Form form={form} layout="vertical">
        <Row gutter={12}>
          <Col xs={24} md={10}>
            <Form.Item name="id" label="Plane ID" rules={[{ required: true }]}>
              <Input readOnly />
            </Form.Item>
          </Col>
          <Col xs={24} md={14}>
            <Form.Item
              name="name"
              label="Plane Name"
              rules={[{ required: true, message: "Vui lòng nhập tên mặt phẳng" }]}
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="planeType"
          label="Plane Type"
          rules={[{ required: true, message: "Vui lòng chọn loại mặt phẳng" }]}
        >
          <div style={{ display: "flex", gap: 16 }}>
            <Checkbox
              checked={planeType === "Root"}
              onChange={() => form.setFieldValue("planeType", "Root")}
            >
              Root
            </Checkbox>
            <Checkbox
              checked={planeType === "Dependence"}
              onChange={() => form.setFieldValue("planeType", "Dependence")}
            >
              Dependence
            </Checkbox>
          </div>
        </Form.Item>

        {planeType === "Dependence" && (
          <>
            <Form.Item name="parentPlaneId" label="Parent Plane">
              <Select
                allowClear
                options={rootPlaneOptions}
                placeholder="Chọn mặt phẳng cha"
              />
            </Form.Item>

            <Row gutter={12}>
              <Col xs={24} md={12}>
                <Form.Item label="Upload Plane">
                  <Upload
                    beforeUpload={handleBeforeUpload}
                    maxCount={1}
                    accept=".jpg,.jpeg,.png,.svg"
                    fileList={selectedFile ? [selectedFile] : []}
                    onRemove={() => {
                      handleRemoveImage();
                      return true;
                    }}
                  >
                    <Button type="default" icon={<UploadOutlined />}>
                      Tải ảnh
                    </Button>
                  </Upload>
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item label={mode === "edit" ? "Current Image" : "Preview Image"}>
                  <div
                    style={{
                      width: "100%",
                      minHeight: 140,
                      border: "1px solid #d9d9d9",
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "#fafafa",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 8
                    }}
                  >
                    {previewUrl ? (
                      <Image
                        src={previewUrl}
                        alt="Plane preview"
                        style={{ maxWidth: "100%", maxHeight: 124, objectFit: "contain" }}
                        preview={false}
                      />
                    ) : (
                      <span style={{ color: "#999" }}>Chưa có ảnh</span>
                    )}
                  </div>

                  {previewUrl && (
                    <Button style={{ marginTop: 8 }} onClick={handleRemoveImage}>
                      Xóa ảnh
                    </Button>
                  )}
                </Form.Item>
              </Col>
            </Row>
          </>
        )}

        <Form.Item name="description" label="Description">
          <TextArea autoSize={{ minRows: 2 }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
