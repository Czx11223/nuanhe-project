// 管理员管理
// 接口：GET /api/admins、POST /api/admins、PUT /api/admins/{id}、PATCH /api/admins/{id}/disable（禁用/启用）。
// 说明：密码始终以 bcrypt 哈希入库；后端保护“至少保留一名启用的超级管理员”（引后台原型/数据库设计文档）。
import { useEffect, useState } from 'react';
import { App, Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader';
import { get, patch, post, put } from '../lib/request';
import type { AdminUserOut, Role } from '../lib/types';

export default function Admins() {
  const { message } = App.useApp();
  const [list, setList] = useState<AdminUserOut[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUserOut | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [admins, roleList] = await Promise.all([
        get<AdminUserOut[]>('/api/admins'),
        get<Role[]>('/api/roles'),
      ]);
      setList(admins);
      setRoles(roleList);
    } catch {}
    setLoading(false);
  };
  useEffect(() => {
    fetchData();
  }, []);

  const roleMap: Record<number, string> = Object.fromEntries(roles.map((r) => [r.id, r.name]));

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ status: 1 });
    setOpen(true);
  };
  const openEdit = (r: AdminUserOut) => {
    setEditing(r);
    form.setFieldsValue({ ...r, password: '' }); // 编辑时不回显密码
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await put(`/api/admins/${editing.id}`, values);
      message.success('更新成功');
    } else {
      await post('/api/admins', values);
      message.success('创建成功');
    }
    setOpen(false);
    fetchData();
  };

  // 禁用 / 启用（PATCH 翻转；后端保护最后一名超级管理员）
  const toggle = async (r: AdminUserOut) => {
    await patch(`/api/admins/${r.id}/disable`, {});
    message.success('操作成功');
    fetchData();
  };

  const columns = [
    { title: '账号', dataIndex: 'username' },
    { title: '姓名', dataIndex: 'real_name', render: (v: string) => v || '—' },
    {
      title: '角色',
      dataIndex: 'role_id',
      width: 130,
      render: (id: number) => <Tag color="blue">{roleMap[id] || '—'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: number) => (s === 1 ? <Tag color="success">启用</Tag> : <Tag>禁用</Tag>),
    },
    {
      title: '操作',
      width: 160,
      render: (_: unknown, r: AdminUserOut) => (
        <Space>
          <Button size="small" onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Button size="small" danger={r.status === 1} onClick={() => toggle(r)}>
            {r.status === 1 ? '禁用' : '启用'}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="管理员管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增管理员
          </Button>
        }
      />
      <Table
        rowKey="id"
        loading={loading}
        dataSource={list}
        columns={columns}
        pagination={false}
        bordered
        style={{ boxShadow: 'none' }}
      />

      <Modal
        title={editing ? '编辑管理员' : '新增管理员'}
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="username"
            label="登录账号"
            rules={[{ required: true, message: '请输入账号' }]}
          >
            <Input disabled={!!editing} placeholder="登录账号" />
          </Form.Item>
          <Form.Item name="real_name" label="姓名">
            <Input placeholder="真实姓名" />
          </Form.Item>
          <Form.Item
            name="password"
            label={editing ? '密码（留空不修改）' : '密码'}
            rules={editing ? [] : [{ required: true, message: '请输入密码（至少6位）' }, { min: 6, message: '至少6位' }]}
          >
            <Input.Password placeholder={editing ? '留空则不修改' : '至少 6 位'} />
          </Form.Item>
          <Form.Item name="role_id" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select options={roles.map((r) => ({ value: r.id, label: r.name }))} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              options={[
                { value: 1, label: '启用' },
                { value: 0, label: '禁用' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
