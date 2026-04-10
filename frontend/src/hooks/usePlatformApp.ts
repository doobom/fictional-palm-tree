// frontend/src/hooks/usePlatformApp.ts
import { useEffect, useState, useCallback } from 'react';
import { useUserStore } from '../store';

export interface PlatformAppInfo {
  isTelegram: boolean;
  startParam: string | null;
  colorScheme: 'light' | 'dark';
  platform: string;
  version: string;
}

export const usePlatformApp = () => {
  const { setAuth } = useUserStore();
  const [appInfo, setAppInfo] = useState<PlatformAppInfo>({
    isTelegram: false, startParam: null, colorScheme: 'light', platform: 'web', version: '1.0.0'
  });

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg && tg.initData) {
      // 全屏和展开已经在 index.html 中执行过了，这里只做状态同步
      
      const startParam = tg.initDataUnsafe?.start_param || null;
      setAuth({ tgData: tg.initData });
      setAppInfo({
        isTelegram: true, startParam, colorScheme: tg.colorScheme || 'light',
        platform: tg.platform || 'telegram', version: tg.version || 'unknown'
      });

      const handleThemeChange = () => {
        setAppInfo(prev => ({ ...prev, colorScheme: tg.colorScheme }));
        if (tg.colorScheme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        
        if (tg.setHeaderColor) {
          tg.setHeaderColor(tg.colorScheme === 'dark' ? '#111827' : '#ffffff');
        }
      };

      handleThemeChange();
      tg.onEvent('themeChanged', handleThemeChange);
      return () => tg.offEvent('themeChanged', handleThemeChange);
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      setAppInfo(prev => ({
        ...prev, isTelegram: false, startParam: urlParams.get('startapp') || urlParams.get('code'),
        colorScheme: isDarkMode ? 'dark' : 'light', platform: 'web'
      }));
    }
  }, [setAuth]);

  const triggerImpact = useCallback((style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light') => {
    if (appInfo.isTelegram && window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
    } else if (navigator.vibrate) navigator.vibrate(style === 'heavy' ? 50 : 20);
  }, [appInfo.isTelegram]);

  const triggerNotification = useCallback((type: 'error' | 'success' | 'warning') => {
    if (appInfo.isTelegram && window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred(type);
    } else if (navigator.vibrate) navigator.vibrate(type === 'success' ? [30, 50, 30] : [100]);
  }, [appInfo.isTelegram]);

  const closeApp = useCallback(() => {
    if (appInfo.isTelegram) window.Telegram?.WebApp?.close();
    else { window.close(); if (!window.closed) window.history.back(); }
  }, [appInfo.isTelegram]);

  return { ...appInfo, triggerImpact, triggerNotification, closeApp };
};