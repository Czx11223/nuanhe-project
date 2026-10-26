// 应用入口（React 18 createRoot）
// 职责：挂载 ConfigProvider（主题令牌 + 中文 locale）→ AntApp（提供 message/notification 上下文）
//        → BrowserRouter（路由）→ App（路由表）。
// 注意：antd 的 App.useApp() 必须在 <AntApp> 内部使用，否则会有静态调用告警。
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import { theme } from './theme';
import './index.css';

// 挂载根节点（index.html 中的 <div id="root">）
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* 主题与中文文案 */}
    <ConfigProvider locale={zhCN} theme={theme}>
      {/* antd 应用上下文：供全局 message / Modal.confirm 使用 */}
      <AntApp>
        {/* 前端路由 */}
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
