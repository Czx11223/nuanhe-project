/// <reference types="vite/client" />

// 声明自定义环境变量类型，便于 TypeScript 识别 import.meta.env.VITE_API_BASE
interface ImportMetaEnv {
  /** 后端 API 基地址；留空则走 Vite 开发代理 */
  readonly VITE_API_BASE: string;
  /** 静态资源前缀；EdgeOne Pages 部署时为 /api */
  readonly VITE_STATIC_BASE: string;
  /** 前端路由基路径；后台部署在 /admin 时为 /admin */
  readonly VITE_BASE_PATH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
