// src/hooks/useTelegramApp.ts
import { useEffect } from 'react';
import { detectPlatform } from '../utils/env'; // 🌟 引入环境探针

export function useTelegramApp() {
  const platform = detectPlatform();
  const twa = (window as any).Telegram?.WebApp;
  const isInTelegram = !!twa?.initData;

  useEffect(() => {
    if (platform !== 'telegram' || !twa) return;

    try { twa.ready(); } catch (_) {}

    // 1. 注入安全区 CSS 变量
    const applySafeArea = () => {
      // 优先获取 contentSafeArea，如果为 0 则尝试 safeArea
      let top = (twa.contentSafeAreaInset?.top ?? 0) || (twa.safeAreaInset?.top ?? 0);
      let bottom = (twa.contentSafeAreaInset?.bottom ?? 0) || (twa.safeAreaInset?.bottom ?? 0);

      // 🌟 核心修复：全屏模式下的强制避让逻辑
      // 如果开启了全屏，但系统返回的 inset 还是 0，强制设置一个最小安全值
      if (twa.isFullscreen && top <= 0) {
        // 通常刘海屏或带按钮的区域至少需要 44px - 48px
        top = 48; 
      }

      const r = document.documentElement;
      r.style.setProperty('--tg-safe-top', top + 'px');
      r.style.setProperty('--tg-safe-bottom', bottom + 'px');
      r.style.setProperty('--tg-safe-left', (twa.safeAreaInset?.left ?? 0) + 'px');
      r.style.setProperty('--tg-safe-right', (twa.safeAreaInset?.right ?? 0) + 'px');
    };

    const applyTheme = () => {
      try {
        if (twa.isVersionAtLeast('6.1')) {
          twa.setHeaderColor(twa.themeParams.bg_color || '#ffffff');
          twa.setBackgroundColor(twa.themeParams.secondary_bg_color || '#f9fafb');
        }
        if (twa.colorScheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (_) {}
    };

    // 3. 尝试真·全屏
    if (typeof twa.requestFullscreen === 'function') {
      twa.requestFullscreen()
        .then(() => {
          // 全屏成功后，稍微延迟一点点再计算，确保 SDK 拿到了最新的物理尺寸
          setTimeout(applySafeArea, 100); 
        })
        .catch(() => {
          try { twa.expand(); } catch (_) {}
          applySafeArea();
        });
    } else {
      try { twa.expand(); } catch (_) {}
      applySafeArea();
    }

    applyTheme();

    // 4. 绑定原生事件监听
    twa.onEvent?.('themeChanged',           applyTheme);
    twa.onEvent?.('fullscreenChanged',      applySafeArea);
    twa.onEvent?.('safeAreaChanged',        applySafeArea);
    twa.onEvent?.('contentSafeAreaChanged', applySafeArea);

    return () => {
      twa.offEvent?.('themeChanged',           applyTheme);
      twa.offEvent?.('fullscreenChanged',      applySafeArea);
      twa.offEvent?.('safeAreaChanged',        applySafeArea);
      twa.offEvent?.('contentSafeAreaChanged', applySafeArea);
    };
  }, [platform, twa]);

  return { isInTelegram, twa };
}