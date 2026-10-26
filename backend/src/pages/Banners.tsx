// 轮播图管理
// 接口：GET /api/banners/admin（含停用）、POST /api/banners、PUT /api/banners/{id}、
//       DELETE /api/banners/{id}（逻辑删除）、PATCH /api/banners/{id}/status（启停）。
import { useEffect, useState } from 'react';
import { App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader';
import ImageUpload from '../components/ImageUpload';
import { del, get, patch, post, put } from '../lib/request';
import type { Banner } from '../lib/types';

export default function Banners() {
  const { message } = App.useApp();
  const [data, setData] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form] = Form.useForm();

  // 拉取轮播图列表
  const fetchData = async () => {
    setLoading(true);
    try {
      const list = await get<Banner[]>('/api/banners/admin');
      setData(list);
    } catch {}
    setLoading(false);
  };
  useEffect(() => {
    fetchData();
  }, []);

  // 新增 / 编辑 打开模态框
  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ status: 1, sort: 0 });
    setOpen(true);
  };
  const openEdit = (r: Banner) => {
    setEditing(r);
    form.setFieldsValue(r);
    setOpen(true);
  };

  // 提交（新增或编辑）
  const submit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await put(`/api/banners/${editing.id}`, values);
      message.success('更新成功');
    } else {
      await post('/api/banners', values);
      message.success('创建成功');
    }
    setOpen(false);
    fetchData();
  };

  // 启停切换（PATCH 不带 status 则翻转）
  const toggle = async (r: Banner) => {
    await patch(`/api/banners/${r.id}/status`, {});
    message.success('操作成功');
    fetchData();
  };
  // 删除（逻辑删除）
  const remove = async (id: number) => {
    await del(`/api/banners/${id}`);
    message.success('删除成功');
    fetchData();
  };

  const columns = [
    { title: '标题', dataIndex: 'title', render: (v: string) => v || '—' },
    { title: '链接', dataIndex: 'link_url', render: (v: string) => v || '—' },
    { title: '排序', dataIndex: 'sort', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: number) => (s === 1 ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>),
    },
    {
      title: '操作',
      width: 210,
      render: (_: unknown, r: Banner) => (
        <Space>
          <Button size="small" onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Button size="small" danger={r.status === 1} onClick={() => toggle(r)}>
            {r.status === 1 ? '停用' : '启用'}
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => remove(r.id)} okText="删除" cancelText="取消">
            <Button size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="轮播图管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增轮播
          </Button>
        }
      />
      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={columns}
        pagination={false}
        bordered
        style={{ boxShadow: 'none' }}
      />

      <Modal
        title={editing ? '编辑轮播图' : '新增轮播图'}
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="轮播标题" />
          </Form.Item>
          <Form.Item name="image_url" label="封面图" valuePropName="value">
            <ImageUpload />
          </Form.Item>
          <Form.Item name="link_url" label="跳转链接">
            <Input placeholder="如 /products" />
          </Form.Item>
          <Form.Item name="sort" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              options={[
                { value: 1, label: '启用' },
                { value: 0, label: '停用' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
