// 站点设置（单条记录，固定 id=1）
// 接口：GET /api/site-settings/admin（读取）、PUT /api/site-settings（更新/自动创建）。
// 说明：全站唯一记录，前端以表单形式整体保存（引数据库设计文档 1.4）。
import { useEffect, useState } from 'react';
import { App, Button, Card, Form, Input, InputNumber } from 'antd';
import PageHeader from '../components/PageHeader';
import ImageUpload from '../components/ImageUpload';
import { get, put } from '../lib/request';
import type { SiteSetting } from '../lib/types';

export default function SiteSettings() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  // 读取当前站点设置并回填表单
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const s = await get<SiteSetting | null>('/api/site-settings/admin');
        if (s) form.setFieldsValue(s);
      } catch {}
      setLoading(false);
    })();
  }, [form]);

  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await put('/api/site-settings', values);
      message.success('保存成功');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="站点设置"
        extra={
          <Button type="primary" loading={saving} onClick={submit}>
            保存
          </Button>
        }
      />
      <Card loading={loading} style={{ boxShadow: 'none', maxWidth: 720 }} styles={{ body: { padding: 24 } }}>
        <Form form={form} layout="vertical">
          <Form.Item name="site_name" label="站点名称">
            <Input placeholder="如暖禾家具" />
          </Form.Item>
          <Form.Item name="logo_url" label="Logo" valuePropName="value">
            <ImageUpload />
          </Form.Item>
          <Form.Item name="icp" label="备案号">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="公司地址">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input />
          </Form.Item>
          <Form.Item name="business_hours" label="营业时间">
            <Input placeholder="如 09:00 - 18:00" />
          </Form.Item>
          <Form.Item name="latitude" label="纬度">
            <InputNumber min={-90} max={90} step={0.0001} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="longitude" label="经度">
            <InputNumber min={-180} max={180} step={0.0001} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="seo_title" label="SEO 标题">
            <Input />
          </Form.Item>
          <Form.Item name="seo_keywords" label="SEO 关键词">
            <Input placeholder="逗号分隔" />
          </Form.Item>
          <Form.Item name="seo_description" label="SEO 描述">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
