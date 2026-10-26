// 产品分类管理（树形）
// 接口：GET /api/product-categories/admin（树形，含 children）、POST/PUT/DELETE /api/product-categories。
// 说明：支持二级分类（parent_id 自引用）；删除前后端校验无关联产品（引数据库设计文档 2.1）。
import { useEffect, useMemo, useState } from 'react';
import type { Key } from 'react';
import { App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader';
import { del, get, post, put } from '../lib/request';
import type { ProductCategory } from '../lib/types';

export default function ProductCategories() {
  const { message } = App.useApp();
  const [tree, setTree] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductCategory | null>(null);
  // 受控展开键：数据刷新后仍保持子分类可见（defaultExpandAllRows 仅首次渲染生效）
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const list = await get<ProductCategory[]>('/api/product-categories/admin');
      setTree(list);
      // 展开全部节点（含新增的子分类），保证树形子节点加载后立即可见
      const keys: Key[] = [];
      const walk = (nodes: ProductCategory[]) =>
        nodes.forEach((n) => {
          keys.push(n.id);
          if (n.children && n.children.length > 0) walk(n.children);
        });
      walk(list);
      setExpandedKeys(keys);
    } catch {}
    setLoading(false);
  };
  useEffect(() => {
    fetchData();
  }, []);

  // 递归扁平化树，用于“上级分类”下拉与 id→name 映射
  const flatten = (nodes: ProductCategory[], acc: ProductCategory[] = []) => {
    nodes.forEach((n) => {
      acc.push(n);
      if (n.children) flatten(n.children, acc);
    });
    return acc;
  };
  const flat = useMemo(() => flatten(tree), [tree]);
  const nameMap: Record<number, string> = Object.fromEntries(flat.map((c) => [c.id, c.name]));

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ status: 1, sort: 0, parent_id: null });
    setOpen(true);
  };
  const openEdit = (r: ProductCategory) => {
    setEditing(r);
    form.setFieldsValue(r);
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await put(`/api/product-categories/${editing.id}`, values);
      message.success('更新成功');
    } else {
      await post('/api/product-categories', values);
      message.success('创建成功');
    }
    setOpen(false);
    fetchData();
  };
  const remove = async (id: number) => {
    await del(`/api/product-categories/${id}`);
    message.success('删除成功');
    fetchData();
  };

  const columns = [
    { title: '名称', dataIndex: 'name' },
    {
      title: '上级',
      dataIndex: 'parent_id',
      width: 140,
      render: (pid: number | null) => (pid ? nameMap[pid] || '—' : '—'),
    },
    { title: '排序', dataIndex: 'sort', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: number) => (s === 1 ? <Tag color="success">启用</Tag> : <Tag>禁用</Tag>),
    },
    {
      title: '操作',
      width: 160,
      render: (_: unknown, r: ProductCategory) => (
        <Space>
          <Button size="small" onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Popconfirm
            title="删除该分类；若其下有子分类将一并删除"
            description="删除后不可恢复，且该分类及其子分类下需无产品"
            onConfirm={() => remove(r.id)}
            okText="删除"
            cancelText="取消"
          >
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
        title="产品分类"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增分类
          </Button>
        }
      />
      <Table
        rowKey="id"
        loading={loading}
        dataSource={tree}
        columns={columns}
        pagination={false}
        bordered
        expandable={{
          expandedRowKeys: expandedKeys,
          onExpandedRowsChange: (keys) => setExpandedKeys([...keys]),
        }}
        style={{ boxShadow: 'none' }}
      />

      <Modal
        title={editing ? '编辑分类' : '新增分类'}
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="分类名称" />
          </Form.Item>
          <Form.Item name="parent_id" label="上级分类">
            <Select
              allowClear
              placeholder="无（作为一级分类）"
              options={flat
                .filter((c) => c.id !== editing?.id)
                .map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Form.Item name="sort" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
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
