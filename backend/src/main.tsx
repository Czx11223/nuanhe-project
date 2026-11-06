// 应用入口（React 18 createRoot）
// 职责：挂载 ConfigProvider（主题令牌 + 中文 locale）→ AntApp → 登录态引导 → BrowserRouter → App。
// 登录态引导：刷新后先向 /api/auth/me 校验令牌有效性并以服务端权限为准，避免
// 过期/被禁用账号先渲染后台框架再连续弹 403，也防止伪造 localStorage 权限影响菜单。
import React, { useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, App as AntApp, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import { theme } from './theme';
import { get } from './lib/request';
import { useAuthStore } from './store/auth';
import type { UserOut } from './lib/types';
import './index.css';

type MeResult = UserOut & { must_change_password: boolean };

function AuthBootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('暖禾_token')) {
      setReady(true);
      return;
    }
    get<MeResult>('/api/auth/me')
      .then((me) => {
        useAuthStore.getState().setUser(me);
        useAuthStore.getState().setMustChange(me.must_change_password);
      })
      .catch(() => {
        // 401 已由请求层统一跳登录页；这里清掉本地残留登录态
        useAuthStore.getState().logout();
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }
  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={theme}>
      <AntApp>
        <AuthBootstrap>
          <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || '/'}>
            <App />
          </BrowserRouter>
        </AuthBootstrap>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
