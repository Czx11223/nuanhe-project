// 前端统一请求层
// 功能：封装 axios，自动解包后端统一响应结构 {code,data,msg}，统一错误提示（轻量 toast）。
// 约定：
//  - 后端基地址由 VITE_API_BASE 决定；留空则走 Vite 开发代理（/api、/static 转发到 8000）。
//  - 所有业务接口返回 {code:0, data, msg}；code !== 0 视为业务失败并提示。
//  - 401/403/404/429/500 等 HTTP 错误统一提示，便于前端定位。

import axios from 'axios'

/** 后端统一响应结构 */
export interface ApiResult<T = unknown> {
  code: number
  data: T
  msg: string
}

// 后端基地址：优先读取环境变量，未配置则留空走 Vite 代理
const BASE_URL = import.meta.env.VITE_API_BASE || ''

export const http = axios.create({
  baseURL: BASE_URL,
  timeout: 10000
})

// ----------------- 轻量 Toast（不引入额外 UI 库；遵守 UIUX 禁阴影约束，使用 border 而非 shadow） -----------------
let toastTimer: ReturnType<typeof setTimeout> | undefined

function showToast(message: string, kind: 'error' | 'success' = 'error') {
  let box = document.getElementById('app-toast')
  if (!box) {
    box = document.createElement('div')
    box.id = 'app-toast'
    box.className = 'app-toast'
    document.body.appendChild(box)
  }
  box.textContent = message
  // 切换样式触发显隐过渡
  box.className = `app-toast app-toast--${kind} app-toast--show`
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    if (box) box.className = 'app-toast'
  }, 3000)
}

// ----------------- 响应拦截：统一处理 {code,data,msg} 与 HTTP 错误 -----------------
http.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResult
    // 响应体含 code 字段，说明是后端统一结构
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code !== 0) {
        showToast(body.msg || '请求失败')
        return Promise.reject(new Error(body.msg || '请求失败'))
      }
    }
    return response
  },
  (error) => {
    const status = error.response?.status
    const serverMsg = error.response?.data?.msg as string | undefined
    if (status === 401) showToast('登录已失效，请重新登录')
    else if (status === 403) showToast('无权限执行该操作')
    else if (status === 429) showToast('操作过于频繁，请稍后再试')
    else if (status === 404) showToast('请求的资源不存在')
    else showToast(serverMsg || error.message || '网络异常，请稍后重试')
    return Promise.reject(error)
  }
)

// ----------------- 便捷方法：直接返回解包后的 data -----------------
export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const resp = await http.get<ApiResult<T>>(url, { params })
  return resp.data.data
}

export async function post<T>(url: string, data?: unknown): Promise<T> {
  const resp = await http.post<ApiResult<T>>(url, data)
  return resp.data.data
}

/** 暴露给页面在需要时主动提示（如提交成功） */
export function toast(message: string, kind: 'error' | 'success' = 'success') {
  showToast(message, kind)
}
