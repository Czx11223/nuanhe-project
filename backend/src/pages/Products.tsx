// 产品管理
// 接口：GET /api/products/admin（分页+筛选）、POST/PUT/DELETE /api/products、
//       PATCH /api/products/{id}/status（上下架）、PATCH /api/products/{id}/recommend（推荐切换）。
import { useEffect, useState } from 'react';
import { App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader';
import ImageUpload from '../components/ImageUpload';
import ImageGalleryUpload from '../components/ImageGalleryUpload';
import RichTextEditor from '../components/RichTextEditor';
import { del, get, patch, post, put } from '../lib/request';
import { tablePagination } from '../lib/pagination';
import type { Product, ProductCategory } from '../lib/types';

interface PageData {
  list: Product[];
  total: number;
  page: number;
  page_size: number;
}

// 递归扁平化分类树，用于下拉与名称映射
function flatten(nodes: ProductCategory[], acc: ProductCategory[] = []): ProductCategory[] {
  nodes.forEach((n) => {
    acc.push(n);
    if (n.children) flatten(n.children, acc);
  });
  return acc;
}

export default function Products() {
  const { message } = App.useApp();
  const [data, setData] = useState<PageData>({ list: [], total: 0, page: 1, page_size: 12 });
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [cats, setCats] = useState<ProductCategory[]>([]);
  const [form] = Form.useForm();

  // 筛选条件
  const [keyword, setKeyword] = useState('');
  const [catId, setCatId] = useState<number | undefined>();
  const [status, setStatus] = useState<number | undefined>();

  // 拉取分类（用于下拉与 category_name 回退）
  const fetchCats = async () => {
    try {
      const list = await get<ProductCategory[]>('/api/product-categories/admin');
      setCats(list);
    } catch {}
  };

  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      // 分页请求契约（修复「参数校验失败」）：
      //  1. page/page_size 必须为数字（Number 强转兜底，禁止字符串页码）
      //  2. 筛选为空时不传（?? undefined / trim 后空串不传），避免发出 category_id= 空串触发后端 422
      //  3. category_id/status 严格整型；keyword 去除首尾空白
      const r = await get<PageData>('/api/products/admin', {
        page: Number(page) || 1,
        page_size: 12,
        keyword: (keyword || '').trim() || undefined,
        category_id: catId ?? undefined,
        status: status ?? undefined,
      });
      setData(r);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchCats();
    fetchData(1);
  }, []);

  const catFlat = flatten(cats);
  const catNameMap: Record<number, string> = Object.fromEntries(catFlat.map((c) => [c.id, c.name]));

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    // 默认值：上架 + 不推荐 + 空多图列表（gallery 为副图数组，主图走 cover_image）
    form.setFieldsValue({ status: 1, is_recommended: 0, sort: 0, description: '', gallery: [] });
    setOpen(true);
  };
  const openEdit = (r: Product) => {
    setEditing(r);
    // r.gallery 为后端返回的图片 URL 数组；为空时兜底为 []（组件受控安全）
    form.setFieldsValue({ ...r, gallery: r.gallery || [] });
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await put(`/api/products/${editing.id}`, values);
      message.success('更新成功');
    } else {
      await post('/api/products', values);
      message.success('创建成功');
    }
    setOpen(false);
    fetchData(data.page);
  };

  // 上下架 / 推荐 切换（PATCH 不带值则翻转）
  const toggleStatus = async (r: Product) => {
    await patch(`/api/products/${r.id}/status`, {});
    message.success('操作成功');
    fetchData(data.page);
  };
  const toggleRecommend = async (r: Product) => {
    await patch(`/api/products/${r.id}/recommend`, {});
    message.success('操作成功');
    fetchData(data.page);
  };
  const remove = async (id: number) => {
    await del(`/api/products/${id}`);
    message.success('删除成功');
    fetchData(data.page);
  };

  const columns = [
    { title: '名称', dataIndex: 'name' },
    {
      title: '系列',
      dataIndex: 'series',
      render: (v: string) => v || '—',
    },
    {
      title: '参考价',
      dataIndex: 'reference_price',
      width: 110,
      render: (v: number | null) => (v != null ? `¥${v}` : '—'),
    },
    {
      title: '分类',
      dataIndex: 'category_name',
      width: 120,
      render: (v: string | null, r: Product) => v || catNameMap[r.category_id as number] || '—',
    },
    {
      title: '推荐',
      dataIndex: 'is_recommended',
      width: 90,
      render: (v: number) => (v === 1 ? <Tag color="success">推荐</Tag> : <Tag>—</Tag>),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (s: number) => (s === 1 ? <Tag color="success">上架</Tag> : <Tag>下架</Tag>),
    },
    {
      title: '操作',
      width: 280,
      render: (_: unknown, r: Product) => (
        <Space wrap>
          <Button size="small" onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Button size="small" danger={r.status === 1} onClick={() => toggleStatus(r)}>
            {r.status === 1 ? '下架' : '上架'}
          </Button>
          <Button size="small" onClick={() => toggleRecommend(r)}>
            {r.is_recommended === 1 ? '取消推荐' : '推荐'}
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
        title="产品管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增产品
          </Button>
        }
      />

      {/* 工具栏：关键词 + 分类 + 状态筛选 */}
      <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <Input.Search
          placeholder="搜索产品名 / 货号"
          allowClear
          style={{ width: 220 }}
          onSearch={(v) => {
            setKeyword(v);
            fetchData(1);
          }}
        />
        <Select
          allowClear
          placeholder="全部分类"
          style={{ width: 160 }}
          value={catId}
          onChange={(v) => {
            setCatId(v);
            fetchData(1);
          }}
          options={catFlat.map((c) => ({ value: c.id, label: c.name }))}
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
            { value: 1, label: '上架' },
            { value: 0, label: '下架' },
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
        title={editing ? '编辑产品' : '新增产品'}
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        okText="保存"
        cancelText="取消"
        width={720}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="category_id" label="分类">
            <Select
              allowClear
              placeholder="请选择分类"
              options={catFlat.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="series" label="系列">
            <Input />
          </Form.Item>
          <Form.Item name="code" label="货号">
            <Input />
          </Form.Item>
          <Form.Item name="reference_price" label="参考价">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="如 3280" />
          </Form.Item>
          <Form.Item name="cover_image" label="封面图（主图）" valuePropName="value">
            <ImageUpload />
          </Form.Item>
          <Form.Item name="gallery" label="多图片列表（轮播副图）" valuePropName="value">
            <ImageGalleryUpload />
          </Form.Item>
          <Form.Item name="description" label="详情（富文本）" valuePropName="value">
            <RichTextEditor />
          </Form.Item>
          <Form.Item name="specs" label="规格参数">
            <Input.TextArea rows={2} placeholder="如 尺寸/材质，可用换行" />
          </Form.Item>
          <Form.Item name="is_recommended" label="首页推荐">
            <Select
              options={[
                { value: 1, label: '推荐' },
                { value: 0, label: '不推荐' },
              ]}
            />
          </Form.Item>
          <Form.Item name="sort" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              options={[
                { value: 1, label: '上架' },
                { value: 0, label: '下架' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
