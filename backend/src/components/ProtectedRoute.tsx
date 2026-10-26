// 路由守卫 + 权限守卫
// 功能：
//  - 未登录（无 token）→ 跳转 /login；
//  - 处于“首次登录需改密”状态 → 强制跳转 /change-password；
//  - 访问无权限的模块 → 展示 403 提示页（前端约束，后端为权威鉴权）。
import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Result, Button } from 'antd';
import { useAuthStore } from '../store/auth';

interface Props {
  children: ReactNode;
  /** 访问该路由所需权限键；不传表示任意已登录用户可访问（如工作台） */
  perm?: string;
}

export default function ProtectedRoute({ children, perm }: Props) {
  const { token, mustChange, hasPerm } = useAuthStore();
  const location = useLocation();

  // 1. 未登录 → 登录页（并记录来源，登录后可回跳）
  if (!token) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // 2. 需强制改密 → 改密页
  if (mustChange) {
    return <Navigate to="/change-password" replace />;
  }

  // 3. 无菜单权限 → 403 结果页
  if (perm && !hasPerm(perm)) {
    return (
      <Result
        status="403"
        title="403"
        subTitle="抱歉，您没有访问该模块的权限。"
        extra={
          <Button type="primary" href="/">
            返回工作台
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}
