// 后台 App Shell（应用骨架）
// 结构（引 UIUX 4.1 / 后台原型）：
//   顶栏 56px（Logo + 折叠/菜单按钮 + 用户区 + 退出）
//   侧边栏 240px（按权限动态渲染的分组菜单；桌面可折叠为 64px 图标态）
//   主内容区（路由出口 Outlet）
// 响应式（引 UIUX 5）：<768px 侧栏隐藏，改用左侧 Drawer 抽屉导航。
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Drawer, Menu, Button, Popconfirm, type MenuProps } from 'antd';
import { MenuOutlined, LogoutOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/auth';
import { menuGroups } from './menuConfig';

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, hasPerm, logout } = useAuthStore();

  // 响应式：窗口宽度 <768 视为移动端
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [collapsed, setCollapsed] = useState(false); // 桌面侧栏折叠
  const [drawerOpen, setDrawerOpen] = useState(false); // 移动端抽屉

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 按当前角色权限过滤菜单项（前端仅做展示约束，后端 RBAC 为权威校验）
  const visibleGroups = menuGroups
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.perm || hasPerm(it.perm)) }))
    .filter((g) => g.items.length > 0);

  // 组装 antd Menu items（分组标题 + 子项）
  const menuItems: MenuProps['items'] = visibleGroups.flatMap((g, gi) => [
    { type: 'group' as const, key: `grp-${gi}`, label: g.label },
    ...g.items.map((it) => ({ key: it.key, icon: it.icon, label: it.label })),
  ]);

  // 点击菜单跳转
  const onClickMenu = ({ key }: { key: string }) => {
    navigate(key);
    setDrawerOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const selectedKey = location.pathname;

  // 菜单组件（桌面/抽屉共用）
  const menuEl = (
    <Menu
      mode="inline"
      selectedKeys={[selectedKey]}
      items={menuItems as any}
      onClick={onClickMenu}
      style={{ borderInlineEnd: 'none', background: 'transparent' }}
      inlineCollapsed={!isMobile && collapsed}
    />
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F5F5F7' }}>
      {/* 桌面侧边栏（240 / 64 折叠） */}
      {!isMobile && (
        <aside
          style={{
            width: collapsed ? 64 : 240,
            background: '#FFFFFF',
            borderRight: '1px solid #E5E5EA',
            flexShrink: 0,
            transition: 'width .2s ease',
          }}
        >
          <div
            style={{
              height: 56,
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              fontWeight: 600,
              borderBottom: '1px solid #E5E5EA',
            }}
          >
            {collapsed ? 'L' : '暖禾 · 后台'}
          </div>
          <div style={{ padding: 8 }}>{menuEl}</div>
        </aside>
      )}

      {/* 主区域 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* 顶栏 56px */}
        <header
          style={{
            height: 56,
            background: '#FFFFFF',
            borderBottom: '1px solid #E5E5EA',
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => (isMobile ? setDrawerOpen(true) : setCollapsed((c) => !c))}
          />
          <span style={{ fontWeight: 600, marginLeft: 8 }}>暖禾 · 后台</span>
          <div style={{ flex: 1 }} />
          <span style={{ color: '#6E6E73', marginRight: 12 }}>
            {user?.real_name || user?.username}
          </span>
          <Popconfirm title="确认退出登录？" onConfirm={handleLogout} okText="退出" cancelText="取消">
            <Button type="text" icon={<LogoutOutlined />}>
              退出
            </Button>
          </Popconfirm>
        </header>

        {/* 内容区（路由出口） */}
        <main style={{ flex: 1, padding: 24 }}>
          <Outlet />
        </main>
      </div>

      {/* 移动端抽屉导航 */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="left"
        width={240}
        styles={{ body: { padding: 8 } }}
        title="暖禾 · 后台"
      >
        {menuEl}
      </Drawer>
    </div>
  );
}
