import { useEffect } from "react";
import { Form, Input, Modal, Select } from "antd";

const TYPE_OPTIONS = [
  { value: "Camera", label: "Camera" },
  { value: "Sensor", label: "Sensor" }
];

export default function DeviceTypeForm({
  open,
  mode,
  initialValues,
  nextId,
  onCancel,
  onSubmit
}) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === "edit" && initialValues) {
      form.setFieldsValue({
        id: initialValues.id,
        name: initialValues.name,
        type: initialValues.type,
        description: initialValues.description
      });
      return;
    }

    form.setFieldsValue({
      id: nextId || "...",
      name: "",
      type: undefined,
      description: ""
    });
  }, [form, initialValues, mode, nextId, open]);

  const handleOk = async () => {
    const values = await form.validateFields();
    onSubmit(values);
  };

  return (
    <Modal
      title={mode === "edit" ? "Chỉnh sửa loại thiết bị" : "Thêm loại thiết bị"}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText={mode === "edit" ? "Cập nhật" : "Tạo mới"}
      cancelText="Hủy"
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item name="id" label="Device Type ID" rules={[{ required: true }]}>
          <Input readOnly />
        </Form.Item>

        <Form.Item
          name="name"
          label="Device Type Name"
          rules={[{ required: true, message: "Vui lòng nhập tên loại thiết bị" }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="type"
          label="Type"
          rules={[{ required: true, message: "Vui lòng chọn loại" }]}
        >
          <Select options={TYPE_OPTIONS} disabled={mode === "edit"} />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <Input.TextArea rows={4} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
