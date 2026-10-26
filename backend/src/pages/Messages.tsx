// 留言反馈管理
// 接口：GET /api/messages（分页+筛选）、PUT /api/messages/{id}（标记处理/忽略 + 回复）。
// 说明：status 0 待处理 / 1 已处理 / 2 已忽略（引数据库设计文档 3.11）。
import { useEffect, useState } from 'react';
import { App, Button, Form, Input, Modal, Select, Space, Table, Tag } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader';
import { get, put } from '../lib/request';
import type { Message } from '../lib/types';

interface PageData {
  list: Message[];
  total: number;
  page: number;
  page_size: number;
}

function fmt(s?: string | null): string {
  if (!s) return '—';
  return s.replace('T', ' ').slice(0, 19);
}

const STATUS_TAG = (s: number) => {
  if (s === 0) return <Tag>待处理</Tag>;
  if (s === 1) return <Tag color="success">已处理</Tag>;
  return <Tag color="default">已忽略</Tag>;
};

export default function Messages() {
  const { message } = App.useApp();
  const [data, setData] = useState<PageData>({ list: [], total: 0, page: 1, page_size: 15 });
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<Message | null>(null);
  const [form] = Form.useForm();

  const [status, setStatus] = useState<number | undefined>();
  const [type, setType] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');

  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      const r = await get<PageData>('/api/messages', {
        page,
        page_size: 15,
        status,
        type,
        keyword: keyword || undefined,
      });
      setData(r);
    } catch {}
    setLoading(false);
  };
  useEffect(() => {
    fetchData(1);
  }, []);

  // 打开处理/回复弹窗
  const openHandle = (r: Message) => {
    setCurrent(r);
    form.resetFields();
    form.setFieldsValue({ status: r.status, reply: r.reply || '' });
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    if (!current) return;
    await put(`/api/messages/${current.id}`, values);
    message.success('处理成功');
    setOpen(false);
    fetchData(data.page);
  };

  const columns = [
    { title: '姓名', dataIndex: 'name', width: 100 },
    { title: '电话', dataIndex: 'phone', width: 130, render: (v: string) => v || '—' },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (t: string) => <Tag color="success">{t}</Tag>,
    },
    { title: '内容', dataIndex: 'content', ellipsis: true },
    { title: '状态', dataIndex: 'status', width: 90, render: (s: number) => STATUS_TAG(s) },
    { title: '时间', dataIndex: 'created_date', width: 170, render: (s: string) => fmt(s) },
    {
      title: '操作',
      width: 100,
      render: (_: unknown, r: Message) => (
        <Button size="small" icon={<MessageOutlined />} onClick={() => openHandle(r)}>
          处理
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="留言反馈" />

      <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
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
            { value: 0, label: '待处理' },
            { value: 1, label: '已处理' },
            { value: 2, label: '已忽略' },
          ]}
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
            { value: '留言', label: '留言' },
            { value: '预约', label: '预约' },
            { value: '咨询', label: '咨询' },
            { value: '简历投递', label: '简历投递' },
          ]}
        />
        <Input.Search
          placeholder="搜索姓名/内容"
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
        pagination={{
          current: data.page,
          pageSize: data.page_size,
          total: data.total,
          onChange: (p) => fetchData(p),
        }}
        bordered
        style={{ boxShadow: 'none' }}
      />

      {/* 处理 / 回复弹窗 */}
      <Modal
        title="处理留言"
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        {current && (
          <div style={{ marginBottom: 16, color: '#6E6E73', fontSize: 14 }}>
            <div>
              <b style={{ color: '#1D1D1F' }}>{current.name}</b> · {current.type} ·{' '}
              {current.phone || '无电话'}
            </div>
            <div style={{ marginTop: 8 }}>{current.content || '（无内容）'}</div>
          </div>
        )}
        <Form form={form} layout="vertical">
          <Form.Item name="status" label="处理状态">
            <Select
              options={[
                { value: 0, label: '待处理' },
                { value: 1, label: '已处理' },
                { value: 2, label: '已忽略' },
              ]}
            />
          </Form.Item>
          <Form.Item name="reply" label="回复内容">
            <Input.TextArea rows={3} placeholder="可填写回复/处理说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
