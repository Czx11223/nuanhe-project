// 路由表（集中定义全部前台/后台页面路由）
// 结构：
//   - /login、/change-password 为公开路由（未登录/首次改密用）；
//   - 其余受保护路由统一套用 AppLayout（顶栏+侧栏），并按模块权限二次守卫。
// 路由 path 与 components/menuConfig.tsx 的菜单 key 保持一致，便于侧栏高亮联动。
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Banners from './pages/Banners';
import AboutContent from './pages/AboutContent';
import ProductCategories from './pages/ProductCategories';
import Products from './pages/Products';
import News from './pages/News';
import Cases from './pages/Cases';
import Recruitments from './pages/Recruitments';
import Messages from './pages/Messages';
import SiteSettings from './pages/SiteSettings';
import Admins from './pages/Admins';
import Roles from './pages/Roles';
import { PERMS } from './lib/perm';

export default function App() {
  return (
    <Routes>
      {/* 公开路由：登录 / 首次改密 */}
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<ChangePassword />} />

      {/* 受保护路由：统一套用 App Shell（顶栏 + 侧栏 + Outlet） */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* 工作台：任意已登录用户可见（无权限约束） */}
        <Route path="/" element={<Dashboard />} />

        {/* 内容管理 */}
        <Route
          path="/banners"
          element={
            <ProtectedRoute perm={PERMS.BANNER}>
              <Banners />
            </ProtectedRoute>
          }
        />
        <Route
          path="/about-content"
          element={
            <ProtectedRoute perm={PERMS.ABOUT}>
              <AboutContent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/product-categories"
          element={
            <ProtectedRoute perm={PERMS.PRODUCT_CATEGORY}>
              <ProductCategories />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute perm={PERMS.PRODUCT}>
              <Products />
            </ProtectedRoute>
          }
        />
        <Route
          path="/news"
          element={
            <ProtectedRoute perm={PERMS.NEWS}>
              <News />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cases"
          element={
            <ProtectedRoute perm={PERMS.CASE}>
              <Cases />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recruitments"
          element={
            <ProtectedRoute perm={PERMS.RECRUITMENT}>
              <Recruitments />
            </ProtectedRoute>
          }
        />

        {/* 互动管理 */}
        <Route
          path="/messages"
          element={
            <ProtectedRoute perm={PERMS.MESSAGE}>
              <Messages />
            </ProtectedRoute>
          }
        />

        {/* 系统设置 */}
        <Route
          path="/site-settings"
          element={
            <ProtectedRoute perm={PERMS.SITE_SETTING}>
              <SiteSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admins"
          element={
            <ProtectedRoute perm={PERMS.ADMIN}>
              <Admins />
            </ProtectedRoute>
          }
        />
        <Route
          path="/roles"
          element={
            <ProtectedRoute perm={PERMS.ROLE}>
              <Roles />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 兜底：未知路径回跳工作台 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
