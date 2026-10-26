// 关于我们内容管理
// 接口：GET /api/about-contents/admin、POST/PUT/DELETE /api/about-contents。
// 说明：section 取 about_暖禾 / history / brand（引数据库设计文档）；正文为 TipTap 富文本。
import { useEffect, useState } from 'react';
import { App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader';
import ImageUpload from '../components/ImageUpload';
import RichTextEditor from '../components/RichTextEditor';
import { del, get, post, put } from '../lib/request';
import type { AboutContent } from '../lib/types';

const SECTION_OPTIONS = [
  { value: 'about_暖禾', label: '关于暖禾' },
  { value: 'history', label: '发展历程' },
  { value: 'brand', label: '品牌介绍' },
];

export default function AboutContent() {
  const { message } = App.useApp();
  const [data, setData] = useState<AboutContent[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AboutContent | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const list = await get<AboutContent[]>('/api/about-contents/admin');
      setData(list);
    } catch {}
    setLoading(false);
  };
  useEffect(() => {
    fetchData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ section: 'about_暖禾', status: 1, sort: 0, content: '' });
    setOpen(true);
  };
  const openEdit = (r: AboutContent) => {
    setEditing(r);
    form.setFieldsValue(r);
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await put(`/api/about-contents/${editing.id}`, values);
      message.success('更新成功');
    } else {
      await post('/api/about-contents', values);
      message.success('创建成功');
    }
    setOpen(false);
    fetchData();
  };
  const remove = async (id: number) => {
    await del(`/api/about-contents/${id}`);
    message.success('删除成功');
    fetchData();
  };

  const columns = [
    { title: '板块', dataIndex: 'section', width: 120 },
    { title: '标题', dataIndex: 'title', render: (v: string) => v || '—' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: number) => (s === 1 ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>),
    },
    {
      title: '操作',
      width: 160,
      render: (_: unknown, r: AboutContent) => (
        <Space>
          <Button size="small" onClick={() => openEdit(r)}>
            编辑
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
        title="关于我们内容"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增板块
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
        title={editing ? '编辑板块' : '新增板块'}
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        okText="保存"
        cancelText="取消"
        width={720}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="section" label="板块" rules={[{ required: true, message: '请选择板块' }]}>
            <Select options={SECTION_OPTIONS} />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="板块标题" />
          </Form.Item>
          <Form.Item name="content" label="正文（富文本）" valuePropName="value">
            <RichTextEditor />
          </Form.Item>
          <Form.Item name="image_url" label="封面图" valuePropName="value">
            <ImageUpload />
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
