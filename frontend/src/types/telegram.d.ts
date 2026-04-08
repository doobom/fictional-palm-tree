// frontend/src/types/telegram.d.ts

export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        // 1. 基础数据
        initData: string;
        initDataUnsafe: {
          query_id?: string;
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
          start_param?: string;
          auth_date: number;
          hash: string;
        };
        
        // 2. 环境信息
        version: string;
        platform: string;
        colorScheme: 'light' | 'dark';
        headerColor: string;
        backgroundColor: string;
        
        // 3. 原生 UI 组件
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          setText: (text: string) => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive: boolean) => void;
          hideProgress: () => void;
          setParams: (params: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }) => void;
        };
        BackButton: {
          isVisible: boolean;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
        };

        // 4. 基础方法与事件
        ready: () => void;
        expand: () => void;
        close: () => void;
        
        // 🌟 新增：高级 UI 与全屏控制 API
        requestFullscreen: () => void;
        disableVerticalSwipes: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        
        // 🌟 链接跳转
        openTelegramLink: (url: string) => void;
        openLink: (url: string, options?: { try_instant_view?: boolean }) => void;

        // 5. 触感与数据传输
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        onEvent: (eventType: string, eventHandler: () => void) => void;
        offEvent: (eventType: string, eventHandler: () => void) => void;
        sendData: (data: string) => void;
        switchInlineQuery: (query: string, choose_types?: string[]) => void;
      };
    };
  }
}