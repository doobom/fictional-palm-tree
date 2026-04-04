// src/version.ts
export const VERSION_INFO = {
  version: __APP_VERSION__,        // 打包时会被自动替换成 '1.2.4' 等
  buildDate: __BUILD_DATE__,       // 打包时会自动替换成当天的日期
  commitHash: __COMMIT_HASH__,     // 打包时会自动替换成真实的 Git Hash
  env: import.meta.env.MODE,
};