// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

// 🌟 核心：引入全局样式 (Tailwind)
import './index.css';

// 🌟 核心：在应用启动前立即初始化 i18n 多语言引擎
import './locales'; 

// 寻找 index.html 中的挂载点并渲染 React 应用
ReactDOM.createRoot(document.getElementById('root')!).render(
  // StrictMode 会在开发环境下将组件渲染两次，帮助我们提前发现潜在的副作用 Bug
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);