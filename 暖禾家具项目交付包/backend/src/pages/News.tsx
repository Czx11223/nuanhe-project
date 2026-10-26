// 新闻管理
// 接口：GET /api/news/admin（分页+筛选）、POST（默认草稿）/PUT/DELETE /api/news、
//       PATCH /api/news/{id}/publish（草稿↔发布）。
// 说明：news 表以 publish_status 表达启停（无 status 字段），新增默认草稿（引数据库设计文档 3.8）。
import { useEffect, useState } from 'react';
import { App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader';
import ImageUpload from '../components/ImageUpload';
import RichTextEditor from '../components/RichTextEditor';
import { del, get, patch, post, put } from '../lib/request';
import { tablePagination } from '../lib/pagination';
import type { News } from '../lib/types';

interface PageData {
  list: News[];
  total: number;
  page: number;
  page_size: number;
}

function fmt(s?: string | null): string {
  if (!s) return '—';
  return s.replace('T', ' ').slice(0, 19);
}

export default function News() {
  const { message } = App.useApp();
  const [data, setData] = useState<PageData>({ list: [], total: 0, page: 1, page_size: 10 });
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<News | null>(null);
  const [form] = Form.useForm();

  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [pub, setPub] = useState<number | undefined>();

  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      const r = await get<PageData>('/api/news/admin', {
        page,
        page_size: 10,
        keyword: keyword || undefined,
        category,
        publish_status: pub,
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
    form.setFieldsValue({ category: '企业新闻', sort: 0, content: '' });
    setOpen(true);
  };
  const openEdit = (r: News) => {
    setEditing(r);
    form.setFieldsValue(r);
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await put(`/api/news/${editing.id}`, values);
      message.success('更新成功');
    } else {
      await post('/api/news', values);
      message.success('创建成功（草稿）');
    }
    setOpen(false);
    fetchData(data.page);
  };

  // 发布 / 转草稿（PATCH 不带值翻转）
  const togglePublish = async (r: News) => {
    await patch(`/api/news/${r.id}/publish`, {});
    message.success('操作成功');
    fetchData(data.page);
  };
  const remove = async (id: number) => {
    await del(`/api/news/${id}`);
    message.success('删除成功');
    fetchData(data.page);
  };

  const columns = [
    { title: '标题', dataIndex: 'title' },
    { title: '分类', dataIndex: 'category', width: 120 },
    {
      title: '状态',
      dataIndex: 'publish_status',
      width: 100,
      render: (s: number) => (s === 1 ? <Tag color="success">已发布</Tag> : <Tag>草稿</Tag>),
    },
    { title: '发布时间', dataIndex: 'published_at', width: 170, render: (s: string) => fmt(s) },
    {
      title: '操作',
      width: 220,
      render: (_: unknown, r: News) => (
        <Space>
          <Button size="small" onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Button size="small" onClick={() => togglePublish(r)}>
            {r.publish_status === 1 ? '转草稿' : '发布'}
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
        title="新闻管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增新闻
          </Button>
        }
      />

      <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <Input.Search
          placeholder="搜索标题"
          allowClear
          style={{ width: 200 }}
          onSearch={(v) => {
            setKeyword(v);
            fetchData(1);
          }}
        />
        <Select
          allowClear
          placeholder="全部分类"
          style={{ width: 150 }}
          value={category}
          onChange={(v) => {
            setCategory(v);
            fetchData(1);
          }}
          options={[
            { value: '企业新闻', label: '企业新闻' },
            { value: '行业资讯', label: '行业资讯' },
          ]}
        />
        <Select
          allowClear
          placeholder="全部状态"
          style={{ width: 130 }}
          value={pub}
          onChange={(v) => {
            setPub(v);
            fetchData(1);
          }}
          options={[
            { value: 1, label: '已发布' },
            { value: 0, label: '草稿' },
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
        title={editing ? '编辑新闻' : '新增新闻'}
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
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select
              options={[
                { value: '企业新闻', label: '企业新闻' },
                { value: '行业资讯', label: '行业资讯' },
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
          <Form.Item name="author" label="作者">
            <Input />
          </Form.Item>
          <Form.Item name="sort" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
