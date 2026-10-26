// 招聘管理
// 接口：GET /api/recruitments/admin（分页+筛选）、POST/PUT/DELETE /api/recruitments、
//       PATCH /api/recruitments/{id}/status（启停）。
// 说明：type 整数(1 社会/2 校园)，列表以 type_label 中文展示（引数据库设计文档 3.10）。
import { useEffect, useState } from 'react';
import { App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader';
import RichTextEditor from '../components/RichTextEditor';
import { del, get, patch, post, put } from '../lib/request';
import { tablePagination } from '../lib/pagination';
import type { Recruitment } from '../lib/types';

interface PageData {
  list: Recruitment[];
  total: number;
  page: number;
  page_size: number;
}

export default function Recruitments() {
  const { message } = App.useApp();
  const [data, setData] = useState<PageData>({ list: [], total: 0, page: 1, page_size: 10 });
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Recruitment | null>(null);
  const [form] = Form.useForm();

  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState<number | undefined>();
  const [status, setStatus] = useState<number | undefined>();

  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      const r = await get<PageData>('/api/recruitments/admin', {
        page,
        page_size: 10,
        keyword: keyword || undefined,
        type,
        status,
      });
      setData(r);
    } catch {}
    setLoading(false);
  };
  useEffect(() => {
    fetchData(1);
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ type: 1, status: 1, sort: 0, description: '', requirements: '' });
    setOpen(true);
  };
  const openEdit = (r: Recruitment) => {
    setEditing(r);
    form.setFieldsValue(r);
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await put(`/api/recruitments/${editing.id}`, values);
      message.success('更新成功');
    } else {
      await post('/api/recruitments', values);
      message.success('创建成功');
    }
    setOpen(false);
    fetchData(data.page);
  };
  const toggleStatus = async (r: Recruitment) => {
    await patch(`/api/recruitments/${r.id}/status`, {});
    message.success('操作成功');
    fetchData(data.page);
  };
  const remove = async (id: number) => {
    await del(`/api/recruitments/${id}`);
    message.success('删除成功');
    fetchData(data.page);
  };

  const columns = [
    { title: '职位', dataIndex: 'title' },
    { title: '部门', dataIndex: 'department', width: 120, render: (v: string) => v || '—' },
    { title: '地点', dataIndex: 'location', width: 120, render: (v: string) => v || '—' },
    {
      title: '类型',
      dataIndex: 'type_label',
      width: 110,
      render: (_: unknown, r: Recruitment) => <Tag color="blue">{r.type_label || '未知'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: number) => (s === 1 ? <Tag color="success">招聘中</Tag> : <Tag>停用</Tag>),
    },
    {
      title: '操作',
      width: 200,
      render: (_: unknown, r: Recruitment) => (
        <Space>
          <Button size="small" onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Button size="small" danger={r.status === 1} onClick={() => toggleStatus(r)}>
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
        title="招聘管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增职位
          </Button>
        }
      />

      <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <Input.Search
          placeholder="搜索职位"
          allowClear
          style={{ width: 200 }}
          onSearch={(v) => {
            setKeyword(v);
            fetchData(1);
          }}
        />
        <Select
          allowClear
          placeholder="全部类型"
          style={{ width: 140 }}
          value={type}
          onChange={(v) => {
            setType(v);
            fetchData(1);
          }}
          options={[
            { value: 1, label: '社会招聘' },
            { value: 2, label: '校园招聘' },
          ]}
        />
        <Select
          allowClear
          placeholder="全部状态"
          style={{ width: 130 }}
          value={status}
          onChange={(v) => {
            setStatus(v);
            fetchData(1);
          }}
          options={[
            { value: 1, label: '招聘中' },
            { value: 0, label: '停用' },
          ]}
        />
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={data.list}
        columns={columns}
        pagination={tablePagination(
          { page: data.page, page_size: data.page_size, total: data.total },
          (p) => fetchData(p),
        )}
        bordered
        style={{ boxShadow: 'none' }}
      />

      <Modal
        title={editing ? '编辑职位' : '新增职位'}
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        okText="保存"
        cancelText="取消"
        width={720}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="type" label="招聘类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select
              options={[
                { value: 1, label: '社会招聘' },
                { value: 2, label: '校园招聘' },
              ]}
            />
          </Form.Item>
          <Form.Item name="title" label="职位名称" rules={[{ required: true, message: '请输入职位' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Input />
          </Form.Item>
          <Form.Item name="location" label="工作地点">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="职位描述（富文本）" valuePropName="value">
            <RichTextEditor />
          </Form.Item>
          <Form.Item name="requirements" label="任职要求（富文本）" valuePropName="value">
            <RichTextEditor />
          </Form.Item>
          <Form.Item name="sort" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              options={[
                { value: 1, label: '招聘中' },
                { value: 0, label: '停用' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
