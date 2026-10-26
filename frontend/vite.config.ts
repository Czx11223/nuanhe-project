import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 开发服务器配置
// 关键：将 /api 与 /static 转发到 FastAPI 后端（http://127.0.0.1:8000），
// 使前台在 3000 端口开发时以同源方式访问后端接口与上传静态资源（引 实施方案 7）。
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000, // 前台官网开发端口（start.bat 一键启动约定）
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/static': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  }
})
