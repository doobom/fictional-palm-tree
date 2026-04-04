import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import fs from 'fs';

// 1. 安全读取 package.json 里的版本号
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

// 2. 自动获取 Git 提交的简短 Hash (7位)
let commitHash = 'unknown';
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
  console.warn('⚠️ 无法获取 Git Commit Hash (可能不在 Git 仓库中)');
}

// 3. 自动生成构建日期 (格式: 2026.04.03)
const buildDate = new Date().toISOString().split('T')[0].replace(/-/g, '.');

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    
    // 🌟 核心魔法：注入全局变量供前端使用
    define: {
        __APP_VERSION__: JSON.stringify(packageJson.version || '1.0.0'),
        __BUILD_DATE__: JSON.stringify(buildDate),
        __COMMIT_HASH__: JSON.stringify(commitHash),
    },

    server: {
        // 🌟 开启局域网访问，终端会输出一个 Network IP，手机可直接访问以进行真机调试
        host: true,
        port: 5173,
    },
    
    build: {
        // 🌟 针对现代浏览器优化打包体积
        target: 'esnext',
        // 提高大文件警告阈值，避免第三方库报警
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                // 🌟 将打包后的文件进行分包，提升加载速度
                manualChunks: {
                    vendor: ['react', 'react-dom', 'react-router-dom', 'zustand'],
                    i18n: ['i18next', 'react-i18next'],
                }
            }
        }
    }
});