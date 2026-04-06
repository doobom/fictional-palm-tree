// frontend/src/utils/env.ts

/**
 * 环境配置工具类
 * 用于统一管理 API 地址、第三方平台标识以及功能开关
 */

// 1. 获取 Vite 环境变量 (通过 import.meta.env)
const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const VITE_APP_ENV = import.meta.env.MODE || 'development';

// 2. 导出基础配置
export const ENV_CONFIG = {
  // 后端基础 API 地址
  API_BASE_URL: VITE_API_BASE_URL,
  
  // SSE 实时推送地址 (连接至 Durable Object)
  // 如果 API_BASE_URL 是相对路径，则自动补全协议
  SSE_URL: VITE_API_BASE_URL.startsWith('http') 
    ? `${VITE_API_BASE_URL}/scores/realtime`
    : `${window.location.origin}${VITE_API_BASE_URL}/scores/realtime`,

  // 当前环境标识
  IS_PROD: VITE_APP_ENV === 'production',
  IS_DEV: VITE_APP_ENV === 'development',

  // Telegram 相关配置
  TELEGRAM: {
    BOT_USERNAME: import.meta.env.VITE_TG_BOT_USERNAME || 'FamilyPointsBot',
    APP_NAME: import.meta.env.VITE_TG_APP_NAME || 'points_app',
  },

  // 业务逻辑限制兜底
  APP: {
    DEFAULT_LANGUAGE: 'zh-CN',
    MAX_CHILDREN_PER_FAMILY: 10,
    REQUEST_TIMEOUT: 10000, // 10秒超时
  }
};

/**
 * 辅助方法：检查当前是否处于 Telegram 环境
 */
export const isTelegramEnv = (): boolean => {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData;
};

/**
 * 辅助方法：获取完整的邀请链接 (Deep Link)
 * 格式: https://t.me/botname/appname?startapp=CODE
 */
export const getInviteLink = (inviteCode: string): string => {
  const { BOT_USERNAME, APP_NAME } = ENV_CONFIG.TELEGRAM;
  return `https://t.me/${BOT_USERNAME}/${APP_NAME}?startapp=${inviteCode}`;
};

export default ENV_CONFIG;