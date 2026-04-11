// backend/src/locales/index.js
import zhCN from './zh-CN.js';
import enUS from './en-US.js';

const messages = {
  'zh-CN': zhCN,
  'zh': zhCN, // 兼容简化写法
  'en-US': enUS,
  'en': enUS
};

const DEFAULT_LOCALE = 'zh-CN';

/**
 * 获取指定语言的翻译对象
 * @param {string} locale 
 * @returns {Object}
 */
export const getI18n = (locale) => {
  return messages[locale] || messages[DEFAULT_LOCALE];
};

/**
 * 获取特定语言的默认规则列表
 * @param {string} locale 
 */
export const getDefaultRules = (locale) => {
  const i18n = getI18n(locale);
  return i18n.defaultRules || messages[DEFAULT_LOCALE].defaultRules;
};

// 如果未来有不同年龄段的模板需求，也可以在这里扩展
export const getRulesTemplates = (locale) => {
  const i18n = messages[locale] || messages['zh-CN'];
  return i18n.ruleTemplates;
};
export const getGoalsTemplates = (locale) => {
  const i18n = messages[locale] || messages['zh-CN'];
  return i18n.goalsTemplates;
};