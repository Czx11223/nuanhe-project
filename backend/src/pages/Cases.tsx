// 案例管理
// 接口：GET /api/cases/admin（分页+关键词筛选）、POST/PUT/DELETE /api/cases、
//       PATCH /api/cases/{id}/top（置顶）。
// 说明：case 表无独立“置顶”字段，置顶通过将 sort 置为最小值实现（引数据库设计文档 3.9）。
//       后台列表为服务端分页（返回 {list,total,page,page_size}），关键词筛选走后端。
import { useEffect, useState } from 'react';
import { App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader';
import ImageUpload from '../components/ImageUpload';
import RichTextEditor from '../components/RichTextEditor';
import { del, get, patch, post, put } from '../lib/request';
import { tablePagination } from '../lib/pagination';
import type { CaseItem } from '../lib/types';

interface PageData {
  list: CaseItem[];
  total: number;
  page: number;
  page_size: number;
}

export default function Cases() {
  const { message } = App.useApp();
  const [data, setData] = useState<PageData>({ list: [], total: 0, page: 1, page_size: 10 });
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CaseItem | null>(null);
  const [keyword, setKeyword] = useState('');
  const [form] = Form.useForm();

  // 服务端分页请求：携带 page/page_size/keyword（keyword 为空串不传，避免空参数）
  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      const r = await get<PageData>('/api/cases/admin', {
        page,
        page_size: 10,
        keyword: (keyword || '').trim() || undefined,
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
    form.setFieldsValue({ category: '项目案例', status: 1, sort: 0, content: '' });
    setOpen(true);
  };
  const openEdit = (r: CaseItem) => {
    setEditing(r);
    form.setFieldsValue(r);
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await put(`/api/cases/${editing.id}`, values);
      message.success('更新成功');
    } else {
      await post('/api/cases', values);
      message.success('创建成功');
    }
    setOpen(false);
    fetchData(data.page);
  };
  const top = async (r: CaseItem) => {
    await patch(`/api/cases/${r.id}/top`, {});
    message.success('已置顶');
    fetchData(data.page);
  };
  const remove = async (id: number) => {
    await del(`/api/cases/${id}`);
    message.success('删除成功');
    fetchData(data.page);
  };

  const columns = [
    { title: '标题', dataIndex: 'title' },
    { title: '分类', dataIndex: 'category', width: 120, render: (v: string) => v || '—' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: number) => (s === 1 ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>),
    },
    {
      title: '操作',
      width: 210,
      render: (_: unknown, r: CaseItem) => (
        <Space>
          <Button size="small" onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Button size="small" onClick={() => top(r)}>
            置顶
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
        title="案例管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增案例
          </Button>
        }
      />

      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索案例标题"
          allowClear
          style={{ width: 220 }}
          onSearch={(v) => {
            setKeyword(v);
            fetchData(1);
          }}
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
        title={editing ? '编辑案例' : '新增案例'}
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        okText="保存"
        cancelText="取消"
        width={720}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Select
              options={[
                { value: '项目案例', label: '项目案例' },
                { value: '客户案例', label: '客户案例' },
              ]}
            />
          </Form.Item>
          <Form.Item name="cover_image" label="封面图" valuePropName="value">
            <ImageUpload />
          </Form.Item>
          <Form.Item name="summary" label="摘要">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="content" label="正文（富文本）" valuePropName="value">
            <RichTextEditor />
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
