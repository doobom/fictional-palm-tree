// src/api/request.ts
import axios from 'axios';
import WebApp from '@twa-dev/sdk';
import i18n from '../locales/index'; // 假设 i18n 配置在这个目录
import { appToast } from '../utils/toast'; // 🌟 引入刚刚封装的带有震动反馈的 Toast

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://family-points-system-backend.dunp.workers.dev/api',
  timeout: 10000,
});

// 1. 请求拦截器：动态注入身份凭证
api.interceptors.request.use((config) => {
  if (WebApp.initData) {
    config.headers['X-Telegram-Init-Data'] = WebApp.initData;
  } else {
    const jwtToken = localStorage.getItem('jwt_token');
    if (jwtToken) {
      config.headers['Authorization'] = `Bearer ${jwtToken}`;
    }
  }
  // 🌟 让后端知道当前前端用的是什么语言，方便以后扩展后端多语言通知
  config.headers['Accept-Language'] = i18n.language;
  return config;
});

// 2. 响应拦截器：全局错误接管与多语言翻译
api.interceptors.response.use(
  (response) => {
    const res = response.data;
    if (res && res.success === false) {
      const errorCode = res.errorCode || 'ERR_SYSTEM_ERROR';
      
      // 🌟 核心翻译逻辑：
      // 1. 去 locales 里面找 `api.${errorCode}` 对应的文本
      // 2. 如果找不到，就用后端传来的 errorMessage 作为兜底
      // 3. 动态参数 (如果有)：传入 res.errorParams
      const translatedMsg = i18n.t(`api.${errorCode}`, res.errorMessage || '请求失败', res.errorParams) as string;;
      
      // 弹出多语言提示
      appToast.error(translatedMsg);
      
      // 抛出异常，阻止前端代码继续执行后续的 .then()
      return Promise.reject(res);
    }
    return res;
  },
  (error) => {
    const res = error.response?.data || error;
    
    if (res.errorCode) {
      // 核心 1：拦截未注册/未加入家庭的用户，静默抛出给 App.tsx 处理路由跳转
      if (res.errorCode === 'ERR_USER_NOT_FOUND' && res.needRegister) {
        return Promise.reject({ type: 'NEED_REGISTER' });
      }

      // 核心 2：拦截 Token 失效，踢回登录页
      if (res.errorCode === 'ERR_UNAUTHORIZED') {
        localStorage.removeItem('jwt_token');
        return Promise.reject({ type: 'NEED_LOGIN' });
      }

      // 🌟 核心 3：拦截所有常规业务报错，直接弹出带有震动的 Toast！
      // 它会优先去 i18n 字典找多语言翻译，如果没配，就会默认显示后端传过来的 errorMessage。
      const errorMsg = i18n.t(`api.${res.errorCode}`, res.errorParams || {}, { 
        defaultValue: res.errorMessage || '请求失败，请稍后重试' 
      });
      
      appToast.error(errorMsg); // 💥 触发红色的 Error Toast + 手机震动！
      console.warn('[API Warning]', errorMsg);
      
    } else {
      // 🌟 兜底：如果是彻底没网了、或者后端崩溃了报 500
      appToast.error(i18n.t('api.NETWORK_ERROR', '网络连接异常，请检查网络'));
    }

    return Promise.reject(error);
  }
);

export default api;