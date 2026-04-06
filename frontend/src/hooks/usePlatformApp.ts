// frontend/src/hooks/usePlatformApp.ts
import { useEffect, useState, useCallback } from 'react';
import { useUserStore } from '../store';

export interface PlatformAppInfo {
  isTelegram: boolean;
  startParam: string | null;
  colorScheme: 'light' | 'dark';
  platform: string; // 例如: 'ios', 'android', 'web', 'macos', 'unknown'
  version: string;
}

export const usePlatformApp = () => {
  const { setAuth } = useUserStore();
  
  const [appInfo, setAppInfo] = useState<PlatformAppInfo>({
    isTelegram: false,
    startParam: null,
    colorScheme: 'light',
    platform: 'web',
    version: '1.0.0'
  });

  useEffect(() => {
    // 检测环境：优先判断是否为 Telegram WebApp
    const tg = window.Telegram?.WebApp;

    if (tg && tg.initData) {
      // -----------------------------------------
      // 1. Telegram 环境初始化
      // -----------------------------------------
      tg.ready();
      tg.expand();

      const startParam = tg.initDataUnsafe?.start_param || null;

      // 同步 TG 身份认证数据到全局 Store
      setAuth({ tgData: tg.initData });

      setAppInfo({
        isTelegram: true,
        startParam,
        colorScheme: tg.colorScheme || 'light',
        platform: tg.platform || 'telegram',
        version: tg.version || 'unknown'
      });

      // 监听 TG 主题切换 (同步 Tailwind CSS 的 Dark Mode)
      const handleThemeChange = () => {
        setAppInfo(prev => ({ ...prev, colorScheme: tg.colorScheme }));
        if (tg.colorScheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      };

      handleThemeChange(); // 初始执行一次
      tg.onEvent('themeChanged', handleThemeChange);

      return () => {
        tg.offEvent('themeChanged', handleThemeChange);
      };

    } else {
      // -----------------------------------------
      // 2. 普通 Web / PWA 环境初始化
      // -----------------------------------------
      // 尝试从 URL 参数中获取邀请码 (兼容纯 Web 分享)
      const urlParams = new URLSearchParams(window.location.search);
      const webStartParam = urlParams.get('startapp') || urlParams.get('code');

      // 简单的系统级暗黑模式检测
      const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

      setAppInfo(prev => ({
        ...prev,
        isTelegram: false,
        startParam: webStartParam,
        colorScheme: isDarkMode ? 'dark' : 'light',
        platform: getWebPlatform(),
      }));
    }
  }, [setAuth]);

  /**
   * --- 跨平台通用 API 封装 ---
   * 这些方法在任何环境下调用都不会报错，内部会自动判断能力支持情况
   */

  // 1. 物理触感反馈 (仅 TG 或支持的移动端有效)
  const triggerImpact = useCallback((style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light') => {
    if (appInfo.isTelegram && window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
    } else if (navigator.vibrate) {
      // Web API 降级方案 (Android 浏览器大多支持)
      const pattern = style === 'heavy' ? 50 : 20;
      navigator.vibrate(pattern);
    }
  }, [appInfo.isTelegram]);

  // 2. 状态通知震动
  const triggerNotification = useCallback((type: 'error' | 'success' | 'warning') => {
    if (appInfo.isTelegram && window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred(type);
    } else if (navigator.vibrate) {
      // Web API 降级方案: success 连震两次，error 长震一次
      navigator.vibrate(type === 'success' ? [30, 50, 30] : [100]);
    }
  }, [appInfo.isTelegram]);

  // 3. 关闭应用
  const closeApp = useCallback(() => {
    if (appInfo.isTelegram) {
      window.Telegram?.WebApp?.close();
    } else {
      // Web 环境下尝试关闭窗口或返回上一页
      window.close();
      if (!window.closed) window.history.back();
    }
  }, [appInfo.isTelegram]);

  // 4. 原生按钮对象安全暴露 (如果非 TG 环境则为 undefined)
  const MainButton = appInfo.isTelegram ? window.Telegram?.WebApp?.MainButton : undefined;
  const BackButton = appInfo.isTelegram ? window.Telegram?.WebApp?.BackButton : undefined;

  return { 
    ...appInfo, 
    triggerImpact, 
    triggerNotification,
    closeApp,
    MainButton,
    BackButton
  };
};

/**
 * 辅助方法：简单判断 Web 环境下的操作系统
 */
function getWebPlatform(): string {
  if (typeof window === 'undefined') return 'unknown';
  const ua = window.navigator.userAgent.toLowerCase();
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('mac')) return 'ios/mac';
  if (ua.includes('android')) return 'android';
  if (ua.includes('win')) return 'windows';
  return 'web';
}