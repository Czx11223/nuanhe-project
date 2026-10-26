/// <reference types="vite/client" />

// 声明自定义环境变量类型，便于 TypeScript 识别 import.meta.env.VITE_API_BASE
interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
