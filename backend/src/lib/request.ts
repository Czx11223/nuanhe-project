// 后端 API 对接层（统一 HTTP 客户端）
// 职责：
//  1. 自动附加 JWT（Bearer）到请求头；
//  2. 统一解析后端约定响应 {code, data, msg} —— 成功时直接把 data 返回给调用方；
//  3. 统一处理 401/403/422/429/500 等错误并 Toast 提示。
// 该契约与 api/ 后端（FastAPI + 响应中间件）严格对应（引实施方案 4.3 / 技术文档 4.3）。
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { message } from 'antd';

// API 基础地址：默认空字符串，配合 Vite 代理转发到 8000；生产可改 .env 的 VITE_API_BASE。
const API_BASE = import.meta.env.VITE_API_BASE || '';

// 创建 axios 实例
const instance: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

// ---- 请求拦截：附加登录令牌 ----
instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('暖禾_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---- 响应拦截：解包统一结构 ----
instance.interceptors.response.use(
  (resp: AxiosResponse) => {
    const body = resp.data;
    // 若后端返回的是约定结构（含 code 字段），则解包；否则原样返回（如静态资源）。
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code !== 0) {
        message.error(body.msg || '请求失败');
        return Promise.reject(new Error(body.msg || '请求失败'));
      }
      // 成功：调用方拿到的就是 body.data，无需再 .data
      return body.data;
    }
    return body;
  },
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      // 登录失效：清理本地登录态并跳回登录页
      localStorage.removeItem('暖禾_token');
      localStorage.removeItem('暖禾_user');
      message.error('登录已失效，请重新登录');
      if (location.pathname !== '/login') location.href = '/login';
    } else if (status === 403) {
      message.error('无权访问该资源');
    } else if (status === 429) {
      message.error('操作过于频繁，请稍后再试');
    } else if (status === 422) {
      // 参数校验失败：后端 detail 可能是字符串或字段级对象，尽量友好展示
      const detail = error.response?.data?.detail;
      const text =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
          ? detail.map((d: any) => d.msg).join('；')
          : '参数校验失败';
      message.error(text || '参数校验失败');
    } else if (status === 404) {
      message.error('资源不存在或已删除');
    } else if (status === 400) {
      // 业务/文件校验失败：展示后端具体原因（如「仅支持 jpg/png/webp」「不能超过 5MB」），
      // 避免 400 落入兜底分支被误报为「网络异常」
      message.error((error.response?.data as { msg?: string })?.msg || '请求参数错误');
    } else {
      message.error('网络异常，请稍后重试');
    }
    return Promise.reject(error);
  },
);

// ---- 类型化便捷方法 ----
// 由于响应拦截器已经把 data 解包，这里把返回类型断言为业务数据类型，调用方直接拿业务数据。

/**
 * 查询参数净化（修复「参数校验失败 422」根因）：
 * 后端分页/筛选参数为严格类型（page/page_size 整型、category_id/status 为 int|null），
 * 空字符串 "" 会被 axios 原样发送为 `key=`，导致后端 int 解析失败返回 422。
 * 此处统一过滤：
 *   - undefined / null / 空字符串 "" 一律不发送（等价于「不传或传 null」）；
 *   - 保留数字 0（如 status=0 下架筛选、is_recommended=0），避免误删有效筛选。
 */
export function cleanParams(params?: Record<string, any>): Record<string, any> | undefined {
  if (!params) return undefined;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(params)) {
    // 分页参数：严格整型归一（禁止字符串页码）。非法值不传，交给后端默认值兜底。
    if (k === 'page' || k === 'page_size') {
      const n = Number(v);
      if (Number.isInteger(n) && n > 0) out[k] = n;
      continue;
    }
    // 空值（含空串）直接丢弃：不传比传空串更符合后端契约
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function get<T = any>(url: string, params?: Record<string, any>): Promise<T> {
  // params 经 cleanParams 净化：空串/undefined/null 不进入查询串
  return instance.get(url, { params: cleanParams(params) }) as unknown as Promise<T>;
}
export function post<T = any>(url: string, data?: any): Promise<T> {
  return instance.post(url, data) as unknown as Promise<T>;
}
export function put<T = any>(url: string, data?: any): Promise<T> {
  return instance.put(url, data) as unknown as Promise<T>;
}
export function patch<T = any>(url: string, data?: any): Promise<T> {
  return instance.patch(url, data) as unknown as Promise<T>;
}
export function del<T = any>(url: string, data?: any): Promise<T> {
  return instance.delete(url, { data }) as unknown as Promise<T>;
}

// 把后端返回的相对静态地址（如 /static/uploads/xxx）拼接为可访问的完整地址。
export function resolveStatic(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return API_BASE + url; // 开发期 API_BASE 为空，由 Vite 代理转发 /static
}

export default instance;
