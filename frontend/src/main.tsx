// frontend/src/main.tsx
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

// 引入全局样式 (Tailwind)
import './index.css';

// 初始化 i18n 多语言引擎
import './locales'; 

// 寻找 index.html 中的挂载点并渲染 React 应用
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* 🌟 核心修复 1：加入 Suspense 边界，拦截 i18n 造成的静默黑屏 */}
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-400 text-sm">Loading languages...</p>
      </div>
    }>
      <App />
    </Suspense>
  </React.StrictMode>,
);