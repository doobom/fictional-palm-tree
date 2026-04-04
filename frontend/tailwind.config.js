/** @type {import('tailwindcss').Config} */

const plugin = require('tailwindcss/plugin');

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tg: {
          bg: 'var(--tg-theme-bg-color, #ffffff)',
          text: 'var(--tg-theme-text-color, #000000)',
          button: 'var(--tg-theme-button-color, #3390ec)',
          buttonText: 'var(--tg-theme-button-text-color, #ffffff)',
          hint: 'var(--tg-theme-hint-color, #999999)',
        }
      }
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        // 自动适配顶部的安全距离
        '.pt-tg-safe': {
          paddingTop: 'var(--tg-safe-top, 0px)',
        },
        // 自动适配底部的安全距离
        '.pb-tg-safe': {
          paddingBottom: 'calc(var(--tg-safe-bottom, 0px) + 20px)', // 基础安全区 + 20px 缓冲
        },
        // sticky 定位时 top 固定为 0（body 无 padding-top，从 viewport 顶部开始）
        // 视觉上的避让由 pt-tg-safe 的内边距来实现
        '.top-tg-safe': {
          top: '0px',
        },
        // 无 sticky header 的页面（如 ChildDashboard），顶部内容区的间距
        // = 安全区高度 + 舒适内边距
        '.pt-tg-safe-content': {
          paddingTop: 'calc(var(--tg-safe-top, 0px) + 16px)',
        },
      });
    }),
  ],
}