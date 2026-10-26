// 登录页
// 功能：账号密码登录；成功后写入登录态；若后端标记“首次登录需改密”则跳转改密页，否则回跳来源页。
// 默认账号 admin / admin123（引后台原型登录卡片）。
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App, Button, Card, Form, Input, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { post } from '../lib/request';
import type { LoginResult } from '../lib/types';
import { useAuthStore } from '../store/auth';

const { Title, Paragraph } = Typography;

interface LoginForm {
  username: string;
  password: string;
}

export default function Login() {
  // 使用 App.useApp() 获取 message 实例（处于 <App> 上下文，无静态告警）
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);

  // 提交登录
  const onFinish = async (values: LoginForm) => {
    setLoading(true);
    try {
      const res = await post<LoginResult>('/api/auth/login', values);
      setAuth(res.access_token, res.user, res.must_change_password);
      message.success('登录成功');
      if (res.must_change_password) {
        // 首次登录：必须改密后才能进入后台
        navigate('/change-password', { replace: true });
      } else {
        // 回跳登录前页面，默认工作台
        const from = (location.state as { from?: string } | null)?.from || '/';
        navigate(from, { replace: true });
      }
    } catch {
      // 错误提示已由请求拦截器统一 Toast，此处无需重复
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F5F5F7',
      }}
    >
      <Card style={{ width: 360, boxShadow: 'none' }} styles={{ body: { padding: 32 } }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
          暖禾 后台登录
        </Title>
        <Form<LoginForm>
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ username: 'admin', password: 'admin123' }}
        >
          <Form.Item
            name="username"
            label="账号"
            rules={[{ required: true, message: '请输入账号' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="请输入账号" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 8 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登录
            </Button>
          </Form.Item>
        </Form>
        <Paragraph style={{ fontSize: 12, color: '#AEAEB2', textAlign: 'center', marginBottom: 0 }}>
          默认管理员 admin / admin123（首次登录强制修改）
        </Paragraph>
      </Card>
    </div>
  );
}
