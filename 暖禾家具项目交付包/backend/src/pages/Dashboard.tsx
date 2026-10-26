// 工作台（概览）
// 功能：展示核心 KPI（产品数 / 新闻数 / 待处理留言 / 在招职位）+ 最新留言列表。
// 说明：各 KPI 依赖对应模块权限；无权限的接口会 403，此时以“—”占位（前端容错，后端为权威）。
import { useEffect, useState } from 'react';
import { Card, Table, Tag } from 'antd';
import type { Message, News, Product, Recruitment } from '../lib/types';
import { get } from '../lib/request';
import PageHeader from '../components/PageHeader';

// 格式化日期时间（后端 ISO 字符串 → 简洁展示）
function fmt(s?: string | null): string {
  if (!s) return '—';
  return s.replace('T', ' ').slice(0, 19);
}

// 单个 KPI 卡片
function Kpi({ num, label }: { num: string | number; label: string }) {
  return (
    <Card style={{ boxShadow: 'none', flex: 1, minWidth: 160 }} styles={{ body: { padding: 20 } }}>
      <div style={{ fontSize: 28, fontWeight: 600, color: '#007AFF' }}>{num}</div>
      <div style={{ fontSize: 12, color: '#AEAEB2', marginTop: 4 }}>{label}</div>
    </Card>
  );
}

export default function Dashboard() {
  // KPI 数值可能为数字（接口返回 total）或占位字符串 '—'，故联合类型
  const [kpis, setKpis] = useState<{
    product: string | number;
    news: string | number;
    pending: string | number;
    recruiting: string | number;
  }>({ product: '—', news: '—', pending: '—', recruiting: '—' });
  const [msgs, setMsgs] = useState<Message[]>([]);

  useEffect(() => {
    // 各指标独立请求，失败不影响其它（无权限时以 — 占位）
    (async () => {
      try {
        const r = await get<{ total: number }>('/api/products/admin', { page: 1, page_size: 1 });
        setKpis((k) => ({ ...k, product: r.total }));
      } catch {}
      try {
        const r = await get<{ total: number }>('/api/news/admin', { page: 1, page_size: 1 });
        setKpis((k) => ({ ...k, news: r.total }));
      } catch {}
      try {
        const r = await get<{ list: Message[]; total: number }>('/api/messages', {
          status: 0,
          page: 1,
          page_size: 5,
        });
        setKpis((k) => ({ ...k, pending: r.total }));
        setMsgs(r.list);
      } catch {}
      try {
        const r = await get<{ total: number }>('/api/recruitments/admin', {
          status: 1,
          page: 1,
          page_size: 1,
        });
        setKpis((k) => ({ ...k, recruiting: r.total }));
      } catch {}
    })();
  }, []);

  const msgColumns = [
    { title: '姓名', dataIndex: 'name', width: 100 },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (t: string) => <Tag color="success">{t}</Tag>,
    },
    { title: '内容', dataIndex: 'content', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (s: number) => (s === 0 ? <Tag>待处理</Tag> : s === 1 ? <Tag color="success">已处理</Tag> : <Tag color="default">已忽略</Tag>),
    },
    { title: '时间', dataIndex: 'created_date', width: 170, render: (s: string) => fmt(s) },
  ];

  return (
    <div>
      <PageHeader title="工作台" />
      {/* KPI 行 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <Kpi num={kpis.product} label="产品总数" />
        <Kpi num={kpis.news} label="新闻总数" />
        <Kpi num={kpis.pending} label="待处理留言" />
        <Kpi num={kpis.recruiting} label="在招职位" />
      </div>
      {/* 最新留言 */}
      <Card title="最新留言" style={{ boxShadow: 'none' }} styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          dataSource={msgs}
          columns={msgColumns}
          pagination={false}
          size="middle"
          style={{ boxShadow: 'none' }}
        />
      </Card>
    </div>
  );
}
