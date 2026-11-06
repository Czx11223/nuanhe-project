// 静态资源地址解析
// 背景：生产环境前端（EdgeOne Pages）与后端（阿里云 FC）不同域，
//       后端返回的图片地址形如 /static/uploads/xxx.png，直接渲染会指向 Pages 域名导致 404。
// 规则：绝对地址（http/https/data:）原样返回，其余拼接 VITE_API_BASE 前缀；开发期前缀为空，走 Vite 代理。

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '')

export function assetUrl(path?: string | null): string {
  if (!path) return ''
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:')) return path
  const p = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${p}`
}
