// 角色管理（RBAC）
// 接口：GET /api/roles、POST/PUT /api/roles、DELETE /api/roles/{id}（super_admin 受保护不可删）。
// 说明：权限以字符串数组存库；前端以复选框勾选，super_admin 角色不可删除（引数据库设计文档/后端路由）。
import { useEffect, useState } from 'react';
import { App, Button, Checkbox, Form, Input, Modal, Popconfirm, Space, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader';
import { del, get, post, put } from '../lib/request';
import type { Role } from '../lib/types';
import { PERM_OPTIONS } from '../lib/perm';

// 权限键 → 中文标签
const permLabel = (key: string) => PERM_OPTIONS.find((o) => o.key === key)?.label || key;

// 渲染权限范围标签
const renderPerms = (perms: string[]) => {
  if (perms.includes('*')) return <Tag color="blue">全部</Tag>;
  if (!perms.length) return <Tag>无</Tag>;
  return (
    <Space size={4} wrap>
      {perms.map((p) => (
        <Tag key={p}>{permLabel(p)}</Tag>
      ))}
    </Space>
  );
};

export default function Roles() {
  const { message } = App.useApp();
  const [list, setList] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const r = await get<Role[]>('/api/roles');
      setList(r);
    } catch {}
    setLoading(false);
  };
  useEffect(() => {
    fetchData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ permissions: [], status: 1 });
    setOpen(true);
  };
  const openEdit = (r: Role) => {
    setEditing(r);
    form.setFieldsValue(r);
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await put(`/api/roles/${editing.id}`, values);
      message.success('更新成功');
    } else {
      await post('/api/roles', values);
      message.success('创建成功');
    }
    setOpen(false);
    fetchData();
  };

  const remove = async (r: Role) => {
    // 前端提示内置角色不可删（后端同样会拒绝 super_admin）
    if (r.code === 'super_admin') {
      message.warning('内置超级管理员角色不可删除');
      return;
    }
    await del(`/api/roles/${r.id}`);
    message.success('删除成功');
    fetchData();
  };

  const columns = [
    { title: '角色名', dataIndex: 'name', width: 140 },
    { title: '代码', dataIndex: 'code', width: 140 },
    { title: '权限范围', dataIndex: 'permissions', render: (p: string[]) => renderPerms(p) },
    {
      title: '操作',
      width: 160,
      render: (_: unknown, r: Role) =>
        r.code === 'super_admin' ? (
          <Tag color="error">不可删除</Tag>
        ) : (
          <Space>
            <Button size="small" onClick={() => openEdit(r)}>
              编辑
            </Button>
            <Popconfirm title="确认删除？" onConfirm={() => remove(r)} okText="删除" cancelText="取消">
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
        title="角色管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增角色
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
        title={editing ? '编辑角色' : '新增角色'}
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="角色名" rules={[{ required: true, message: '请输入角色名' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="code"
            label="角色代码"
            rules={[{ required: true, message: '请输入代码' }]}
          >
            <Input disabled={editing?.code === 'super_admin'} placeholder="如 editor" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="permissions" label="权限范围">
            <Checkbox.Group options={PERM_OPTIONS.map((o) => ({ value: o.key, label: o.label }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
