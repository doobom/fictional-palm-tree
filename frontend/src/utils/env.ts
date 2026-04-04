// src/utils/env.ts

export type AppPlatform = 'telegram' | 'feishu' | 'wechat' | 'web';

export const detectPlatform = (): AppPlatform => {
  // 1. 探测 Telegram
  if ((window as any).Telegram?.WebApp?.initData) {
    return 'telegram';
  }
  
  // 2. 探测飞书 (Lark/Feishu)
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('lark') || ua.includes('feishu')) {
    return 'feishu';
  }

  // 3. 探测微信
  if (ua.includes('micromessenger')) {
    return 'wechat';
  }

  // 4. 兜底：普通 Web 浏览器
  return 'web';
};