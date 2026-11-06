// 路由表（集中定义全部前台/后台页面路由）
// 结构：
//   - /login、/change-password 为公开路由（未登录/首次改密用）；
//   - 其余受保护路由统一套用 AppLayout（顶栏+侧栏），并按模块权限二次守卫。
// 路由 path 与 components/menuConfig.tsx 的菜单 key 保持一致，便于侧栏高亮联动。
// 性能：除认证关键路径外，页面按路由懒加载（React.lazy），避免全部页面打进单个 bundle。
import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import { PERMS } from './lib/perm';

// 登录 / 首次改密是认证关键路径，保持静态导入，避免未登录首屏出现二次加载白屏。
// 其余 12 个页面按路由拆分 chunk，首屏只下载 AppLayout + 当前页面。
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Banners = lazy(() => import('./pages/Banners'));
const AboutContent = lazy(() => import('./pages/AboutContent'));
const ProductCategories = lazy(() => import('./pages/ProductCategories'));
const Products = lazy(() => import('./pages/Products'));
const News = lazy(() => import('./pages/News'));
const Cases = lazy(() => import('./pages/Cases'));
const Recruitments = lazy(() => import('./pages/Recruitments'));
const Messages = lazy(() => import('./pages/Messages'));
const SiteSettings = lazy(() => import('./pages/SiteSettings'));
const Admins = lazy(() => import('./pages/Admins'));
const Roles = lazy(() => import('./pages/Roles'));

// Suspense 边界放在每个路由 element 内部（而不是整个 Routes 外层），
// 这样切换页面时只替换主内容区，顶栏与侧栏不会闪退。
function PageBoundary({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

// 简写：把懒加载页面包进 Suspense 边界
const page = (node: ReactNode) => <PageBoundary>{node}</PageBoundary>;

export default function App() {
  return (
    <Routes>
      {/* 公开路由：登录 / 首次改密 */}
      <Route path="/login" element={<Login />} />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute allowMustChange>
            <ChangePassword />
          </ProtectedRoute>
        }
      />

      {/* 受保护路由：统一套用 App Shell（顶栏 + 侧栏 + Outlet） */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* 工作台：任意已登录用户可见（无权限约束） */}
        <Route path="/" element={page(<Dashboard />)} />

        {/* 内容管理 */}
        <Route
          path="/banners"
          element={
            <ProtectedRoute perm={PERMS.BANNER}>
              {page(<Banners />)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/about-content"
          element={
            <ProtectedRoute perm={PERMS.ABOUT}>
              {page(<AboutContent />)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/product-categories"
          element={
            <ProtectedRoute perm={PERMS.PRODUCT_CATEGORY}>
              {page(<ProductCategories />)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute perm={PERMS.PRODUCT}>
              {page(<Products />)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/news"
          element={
            <ProtectedRoute perm={PERMS.NEWS}>
              {page(<News />)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/cases"
          element={
            <ProtectedRoute perm={PERMS.CASE}>
              {page(<Cases />)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/recruitments"
          element={
            <ProtectedRoute perm={PERMS.RECRUITMENT}>
              {page(<Recruitments />)}
            </ProtectedRoute>
          }
        />

        {/* 互动管理 */}
        <Route
          path="/messages"
          element={
            <ProtectedRoute perm={PERMS.MESSAGE}>
              {page(<Messages />)}
            </ProtectedRoute>
          }
        />

        {/* 系统设置 */}
        <Route
          path="/site-settings"
          element={
            <ProtectedRoute perm={PERMS.SITE_SETTING}>
              {page(<SiteSettings />)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/admins"
          element={
            <ProtectedRoute perm={PERMS.ADMIN}>
              {page(<Admins />)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/roles"
          element={
            <ProtectedRoute perm={PERMS.ROLE}>
              {page(<Roles />)}
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 兜底：未知路径回跳工作台 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
