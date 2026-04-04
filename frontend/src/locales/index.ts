// src/locales/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './zh-CN.json';
import enUS from './en-US.json';

// 🌟 标准化语言列表
export const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en-US', label: 'English' },
  // 未来扩展示例：{ code: 'zh-TW', label: '繁體中文' }
];

// 获取用户的环境语言 (Telegram > 浏览器 > 默认中)
const getInitialLanguage = () => {
  const twa = (window as any).Telegram?.WebApp;
  const tgLang = twa?.initDataUnsafe?.user?.language_code; // 例如 'zh-hans', 'en'
  const browserLang = navigator.language; // 例如 'zh-CN', 'en-US'
  
  return tgLang || browserLang || 'zh-CN';
};

i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
    'en-US': { translation: enUS }
  },
  lng: getInitialLanguage(), // 初始语言
  
  // 🌟 核心魔法：智能回退路由表
  fallbackLng: {
    // 如果系统是繁体或任意中文，找不到翻译时，退回简体中文
    'zh-TW': ['zh-CN'],
    'zh-HK': ['zh-CN'],
    'zh': ['zh-CN'], 
    
    // 如果系统是英式/澳式英语等，退回美式英语
    'en-GB': ['en-US'],
    'en-AU': ['en-US'],
    'en': ['en-US'],
    
    // 全局终极兜底
    'default': ['zh-CN']
  },
  
  // 允许 i18next 自动去掉地区后缀去查找 (比如拿 'zh-CN' 去匹配 'zh' 的配置)
  nonExplicitSupportedLngs: true,
  interpolation: { escapeValue: false }
});

export default i18n;