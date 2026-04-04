// src/hooks/usePlatformApp.ts
import { useEffect } from 'react';
import { detectPlatform } from '../utils/env';
import { useTelegramApp } from './useTelegramApp';

export function usePlatformApp() {
  const platform = detectPlatform();

  // 1. 顶层调用！它内部如果发现不是 telegram 环境，会自动装死，不影响其他平台。
  useTelegramApp();

  // 2. 处理其他平台的逻辑
  useEffect(() => {

    const r = document.documentElement;

    // ==========================================
    // 🟠 Telegram 环境：注入 54px 的强制避让兜底
    // ==========================================
    if (platform === 'telegram') {
      // 只有在 TG 里，我们才允许开启 54px 的暴力兜底
      r.style.setProperty('--app-fallback-top', '80px');
      r.style.setProperty('--app-fallback-bottom', '24px');
      return;
    }
    // ==========================================
    // 🔵/⚪ 飞书 & Web 环境：完美贴边，不留白！
    // ==========================================
    if (platform === 'feishu' || platform === 'web') {
      // 1. 将 Telegram 的安全区置零
      r.style.setProperty('--tg-safe-top', '0px'); 
      r.style.setProperty('--tg-safe-bottom', '0px');
      
      // 2. 将强制兜底值也置零！(这样页面就会老老实实贴住顶部)
      r.style.setProperty('--app-fallback-top', '0px');
      r.style.setProperty('--app-fallback-bottom', '0px');
    }

    // ==========================================
    // 🔵 策略 B：飞书 环境初始化 (未来扩展)
    // ==========================================
    if (platform === 'feishu') {
      // 假设你未来引入了飞书的 JS-SDK
      // const h5 = window.h5sdk;
      // h5.ready(() => { 
      //    // 飞书的隐藏顶部导航栏 API
      //    h5.biz.navigation.setTitleBar({ isShow: false });
      // });
      
      return;
    }

    // ==========================================
    // ⚪ 策略 C：普通 Web 浏览器 (H5)
    // ==========================================
    if (platform === 'web') {
      // H5 环境通常不需要特殊处理，默认贴边即可。
      // 但如果你想针对某些老旧浏览器做兼容，也可以在这里添加逻辑。
      return;
    }

  }, [platform]);

  return { platform };
}