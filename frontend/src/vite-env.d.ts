// src/vite-env.d.ts

/// <reference types="vite/client" />

// 🌟 声明全局注入的构建变量
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;
declare const __COMMIT_HASH__: string;

// 🌟 扩展 Vite 的环境变量类型定义
interface ImportMetaEnv {
  /**
   * 后端 API 的基础地址
   * 例如: https://你的项目名.你的账号.workers.dev/api
   */
  readonly VITE_API_BASE_URL: string;
  
  // 如果未来你有其他的环境变量 (必须以 VITE_ 开头)，都在这里追加声明
  // readonly VITE_SOME_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}