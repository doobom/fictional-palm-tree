import zhCN from '../locales/zh-CN.js';
import enUS from '../locales/en-US.js';

const dictionaries = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

// 翻译函数，支持变量替换 (如 {childName})
export function t(key, locale = 'zh-CN', params = {}) {
  const dict = dictionaries[locale] || dictionaries['zh-CN'];
  
  // 按点号解析 key (如 'bot.welcome_child')
  const keys = key.split('.');
  let template = dict;
  for (const k of keys) {
    template = template?.[k];
    if (!template) break;
  }

  // 如果找不到对应翻译，降级回中文或直接返回 key
  if (!template) {
    const fallback = keys.reduce((obj, k) => obj?.[k], dictionaries['zh-CN']);
    template = fallback || key;
  }

  // 替换变量
  return template.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? params[k] : `{${k}}`));
}