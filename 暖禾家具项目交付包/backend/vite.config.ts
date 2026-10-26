// vite 构建配置（后台管理系统）
// 开发端口 3001，与前台 3000、后端 8000 区分，三者互不冲突（引实施方案 2.3）。
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001, // 后台专用开发端口（start.bat 一键启动约定）
    // 开发期通过 Vite 代理把 /api 与 /static 转发到 FastAPI 后端（8000），
    // 这样前端无需配置跨域，上传图片(/static/uploads/...) 也能被正确代理。
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/static': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
