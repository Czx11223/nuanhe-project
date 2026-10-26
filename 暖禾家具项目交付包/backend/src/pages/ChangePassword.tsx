// 首次登录强制改密页（也可用于日常改密）
// 功能：校验原密码 → 提交新密码；成功后后端返回新令牌，本地更新登录态并进入后台。
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Card, Form, Input, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { post } from '../lib/request';
import { useAuthStore } from '../store/auth';

const { Title, Paragraph } = Typography;

interface ChangePwdForm {
  old_password: string;
  new_password: string;
}

export default function ChangePassword() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { user, setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: ChangePwdForm) => {
    setLoading(true);
    try {
      // 后端：POST /api/auth/change-password（需登录，返回新 access_token）
      const res = await post<{ access_token: string }>('/api/auth/change-password', values);
      // 用户身份不变，仅刷新令牌并清除“需改密”状态
      if (user) setAuth(res.access_token, user, false);
      message.success('密码修改成功');
      navigate('/', { replace: true });
    } catch {
      // 拦截器已 Toast（如“原密码错误”）
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
        <Title level={3} style={{ textAlign: 'center', marginBottom: 8 }}>
          修改密码
        </Title>
        <Paragraph style={{ textAlign: 'center', color: '#6E6E73', marginTop: 0 }}>
          首次登录请先修改密码后再进入后台
        </Paragraph>
        <Form<ChangePwdForm> layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="old_password"
            label="原密码"
            rules={[{ required: true, message: '请输入原密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入原密码" />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少 6 位' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="至少 6 位" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              确认修改
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
