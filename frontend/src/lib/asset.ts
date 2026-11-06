// 静态资源地址解析
// - 演示图片：数据库存 /static/...，由 EdgeOne 静态站点直出（本地开发走 Vite 代理）
// - 后台新上传：部署版后端直接返回 /api/static/uploads/...（云函数 /tmp 目录），原样使用
// - 绝对地址（http/https/data:）原样返回
export function assetUrl(path?: string | null): string {
  if (!path) return ''
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:')) return path
  const p = path.startsWith('/') ? path : `/${path}`
  return p
}
