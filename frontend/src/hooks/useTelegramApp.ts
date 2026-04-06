// frontend/src/hooks/useTelegramApp.ts
import { useEffect, useState, useCallback } from 'react';
import { useUserStore } from '../store';

// 定义 Hook 返回的状态接口
export interface TelegramWebAppInfo {
  isTelegram: boolean;
  startParam: string | null;
  colorScheme: 'light' | 'dark';
  platform: string;
  version: string;
}

export const useTelegramApp = () => {
  const { setAuth } = useUserStore();
  
  const [tgInfo, setTgInfo] = useState<TelegramWebAppInfo>({
    isTelegram: false,
    startParam: null,
    colorScheme: 'light',
    platform: 'web', // 默认为普通 web 环境
    version: 'unknown'
  });

  useEffect(() => {
    // 获取全局 Telegram 对象 (依赖于 src/types/telegram.d.ts 的类型声明)
    const tg = window.Telegram?.WebApp;

    if (tg) {
      // 1. 初始化 App 视图
      tg.ready();   // 告诉 TG 页面已加载完毕，可以隐藏 loading
      tg.expand();  // 展开为全屏，防止用户滑动时意外关闭小程序

      // 2. 解析核心数据
      const initData = tg.initData;
      // 解析深层链接参数 (如邀请码: t.me/bot/app?startapp=INVITE_CODE)
      const startParam = tg.initDataUnsafe?.start_param || null;

      // 3. 将身份凭证同步到全局 Store，供 request.ts 拦截器使用
      if (initData) {
        setAuth({ tgData: initData });
      }

      // 4. 更新本地环境状态
      setTgInfo({
        isTelegram: true,
        startParam,
        colorScheme: tg.colorScheme || 'light',
        platform: tg.platform || 'unknown',
        version: tg.version || 'unknown'
      });

      // 5. 监听主题变化，并自动同步 Tailwind 的 Dark Mode
      const handleThemeChange = () => {
        const newScheme = tg.colorScheme;
        setTgInfo(prev => ({ ...prev, colorScheme: newScheme }));
        
        // 如果你的项目配置了 Tailwind 的 darkMode: 'class'
        if (newScheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      };

      // 初始化执行一次主题判定
      handleThemeChange();
      
      // 绑定事件
      tg.onEvent('themeChanged', handleThemeChange);

      return () => {
        tg.offEvent('themeChanged', handleThemeChange);
      };
    } else {
      // 非 TG 环境 (如浏览器直接打开调试)
      setTgInfo(prev => ({ ...prev, isTelegram: false }));
    }
  }, [setAuth]);

  /**
   * --- 辅助方法区 ---
   * 使用 useCallback 包裹，防止在其他组件的 useEffect 中引发无限重渲染
   */

  // 1. 物理震动反馈：常用于点击按钮、加减分数时
  const triggerImpact = useCallback((style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light') => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
    }
  }, []);

  // 2. 状态通知震动：常用于 API 请求成功/失败/警告时
  const triggerNotification = useCallback((type: 'error' | 'success' | 'warning') => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred(type);
    }
  }, []);

  // 3. 关闭小程序
  const closeApp = useCallback(() => {
    window.Telegram?.WebApp?.close();
  }, []);

  // 4. 暴露原生按钮对象 (方便在特定页面挂载底部大按钮或返回键)
  const MainButton = window.Telegram?.WebApp?.MainButton;
  const BackButton = window.Telegram?.WebApp?.BackButton;

  return { 
    ...tgInfo, 
    triggerImpact, 
    triggerNotification,
    closeApp,
    MainButton,
    BackButton
  };
};