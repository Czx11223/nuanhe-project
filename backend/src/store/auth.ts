// 登录态管理（Zustand）
// 负责：保存/读取 token 与用户信息（localStorage 持久化）、登录、改密、退出、权限判定。
// 与 api/ 后端鉴权契约对应：登录返回 {access_token, user, must_change_password}。
import { create } from 'zustand';
import type { UserOut } from '../lib/types';

interface AuthState {
  token: string | null;
  user: UserOut | null;
  permissions: string[];
  /** 是否处于“首次登录需改密”状态（改密成功后清除） */
  mustChange: boolean;

  /** 登录成功写入令牌与用户 */
  setAuth: (token: string, user: UserOut, mustChange: boolean) => void;
  /** 更新当前用户（如改密后刷新） */
  setUser: (user: UserOut) => void;
  /** 仅刷新令牌（改密后 user 不变，避免 user 为空时丢令牌） */
  setToken: (token: string) => void;
  /** 同步服务端权威的「首次改密」状态 */
  setMustChange: (value: boolean) => void;
  /** 退出登录，清理本地态 */
  logout: () => void;
  /** 判定是否拥有某权限（'*' 代表全部） */
  hasPerm: (key: string) => boolean;
}

// 从 localStorage 还原登录态（刷新页面后保持登录）
function loadToken(): string | null {
  return localStorage.getItem('暖禾_token');
}
function loadUser(): UserOut | null {
  const raw = localStorage.getItem('暖禾_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserOut;
  } catch {
    return null;
  }
}

const MUST_CHANGE_KEY = '暖禾_must_change';

function loadMustChange(): boolean {
  return localStorage.getItem(MUST_CHANGE_KEY) === '1';
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: loadToken(),
  user: loadUser(),
  permissions: loadUser()?.permissions ?? [],
  mustChange: loadMustChange(),

  setAuth: (token, user, mustChange) => {
    localStorage.setItem('暖禾_token', token);
    localStorage.setItem('暖禾_user', JSON.stringify(user));
    localStorage.setItem(MUST_CHANGE_KEY, mustChange ? '1' : '0');
    set({ token, user, permissions: user.permissions ?? [], mustChange });
  },

  setUser: (user) => {
    localStorage.setItem('暖禾_user', JSON.stringify(user));
    set({ user, permissions: user.permissions ?? [] });
  },

  setToken: (token) => {
    localStorage.setItem('暖禾_token', token);
    set({ token });
  },

  setMustChange: (value) => {
    localStorage.setItem(MUST_CHANGE_KEY, value ? '1' : '0');
    set({ mustChange: value });
  },

  logout: () => {
    localStorage.removeItem('暖禾_token');
    localStorage.removeItem('暖禾_user');
    localStorage.removeItem(MUST_CHANGE_KEY);
    set({ token: null, user: null, permissions: [], mustChange: false });
  },

  hasPerm: (key) => {
    const p = get().permissions;
    return p.includes('*') || p.includes(key);
  },
}));
