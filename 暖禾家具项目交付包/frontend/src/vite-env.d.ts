/// <reference types="vite/client" />

// 前端环境变量类型声明（Vite 注入 import.meta.env）
interface ImportMetaEnv {
  /** 后端 API 基地址；留空则走 Vite 开发代理 */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
