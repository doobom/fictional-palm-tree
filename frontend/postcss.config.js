// postcss.config.js

export default {
  plugins: {
    // 🌟 核心插件：解析 Tailwind CSS v3 语法
    tailwindcss: {},
    
    // 🌟 兼容插件：自动为 CSS 规则添加浏览器厂商前缀
    // 例如自动把 user-select 编译出 -webkit-user-select 以兼容老版本 iOS
    autoprefixer: {},
  },
}