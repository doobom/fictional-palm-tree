// frontend/src/App.tsx
import React, { useEffect, useRef, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast'; // 🌟 核心修复 1：引入 Toaster
import { useUserStore } from './store';
import service, { ApiResponse } from './api/request';
import { appToast } from './utils/toast';

// 页面组件导入
import ParentLayout from './pages/parent/ParentDashboard';
import ChildLayout from './pages/child/ChildDashboard';
import AuthPage from './pages/auth/AuthPage';
import Onboarding from './pages/auth/Onboarding';

const App: React.FC = () => {
  // 🌟 新增：全局主题管理器 (智能跟随与手动覆盖)
  useEffect(() => {
    const applyTheme = () => {
      const tg = window.Telegram?.WebApp;
      // 默认读取本地设置，如果没有则为 auto
      const pref = localStorage.getItem('app_theme') || 'auto'; 
      // 判断是否应该应用深色：如果选了 dark，或者选了 auto 且 TG 当前是 dark
      const isDark = pref === 'dark' || (pref === 'auto' && tg?.colorScheme === 'dark');
      
      if (isDark) {
        document.documentElement.classList.add('dark'); // 给 HTML 根节点打上 dark 标签
        try { 
          tg?.setHeaderColor?.('#111827'); // Tailwind gray-900
          tg?.setBackgroundColor?.('#111827'); 
        } catch(e){}
      } else {
        document.documentElement.classList.remove('dark');
        try { 
          tg?.setHeaderColor?.('#ffffff'); 
          tg?.setBackgroundColor?.('#f9fafb'); // Tailwind gray-50
        } catch(e){}
      }
    };

    applyTheme(); // 应用刚启动时执行一次

    // 1. 监听 Telegram 官方的主题切换事件 (比如用户切到了后台把 TG 换成了黑夜模式)
    const tg = window.Telegram?.WebApp;
    tg?.onEvent?.('themeChanged', applyTheme);
    
    // 2. 监听设置页面发出的手动修改事件
    window.addEventListener('theme-updated', applyTheme);

    return () => {
      tg?.offEvent?.('themeChanged', applyTheme);
      window.removeEventListener('theme-updated', applyTheme);
    };
  }, []);

  const { currentFamilyId, setUserInfo, updateScoreLocal, token, userType } = useUserStore();
  const sseRef = useRef<EventSource | null>(null);
  
  // 🌟 核心修复 2：引入全局初始化状态，保证数据拉取完才渲染子页面
  const [isInitializing, setIsInitializing] = useState(true);

  // 1. 核心初始化：获取用户信息与家庭列表
  useEffect(() => {
    const initUser = async () => {
      // 如果完全没有凭证，说明是新用户，直接放行去 Auth 页
      if (!token && !window.Telegram?.WebApp?.initData) {
        setIsInitializing(false);
        return;
      }
      
      try {
        const res = await service.get<any, ApiResponse>('/user/me');
        if (res.success) {
          setUserInfo(res.data);
        }
      } catch (err: any) {
        console.error('Init user failed', err);
      } finally {
        // 🌟 无论接口成功与否，必须解除锁定
        setIsInitializing(false);
      }
    };

    initUser();
  }, [token, setUserInfo]);

  // 2. 实时通信：建立 SSE 连接
  useEffect(() => {
    if (!currentFamilyId) return;

    if (sseRef.current) {
      sseRef.current.close();
    }

    const url = `${import.meta.env.VITE_API_BASE_URL}/scores/realtime`;
    const sse = new EventSource(url, { withCredentials: true });

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // 🌟 修复 1：使用 Zustand 的 getState() 脱离 React 生命周期获取最新的 State 和方法
        const { setChildrenList, childrenList } = useUserStore.getState();

        switch (data.type) {
          case 'SCORE_UPDATED':
          case 'BATCH_SCORE_UPDATED':
          case 'SCORE_UNDONE': { 
            // 🌟 修复 2：加上花括号 {} 形成独立的块级作用域
            const { childId, points, childIds } = data.payload;
            
            if (childId) {
              updateScoreLocal(childId, points); // 触发 Zustand store 更新内存数据
            } else if (childIds) {
              childIds.forEach((id: string) => updateScoreLocal(id, points));
            }
            break;
          } // 结束独立作用域

          case 'ACHIEVEMENT_UNLOCKED': { 
            // 🌟 修复 2：加上花括号 {}，这里的 childId 就不会和上面的起冲突了
            const { childId, hasNew } = data.payload;
            if (hasNew) {
              // 实时更新本地 Store，让首页图标冒出红点
              const newList = childrenList.map(child => 
                child.id === childId ? { ...child, has_new_achievement: 1 } : child
              );
              setChildrenList(newList);
            }
            break; 
          }

          case 'GOAL_COMPLETED': {
            const { childId, goalName } = data.payload;
            // 🌟 触发专属提示。如果当前家长正在看这个孩子，可以直接弹窗
            // 或者简单点，弹一个全局 Toast，后续你甚至可以接入撒花特效
            appToast.success(`🎉 惊喜！${goalName} 愿望已经攒满啦！快去兑换吧！`);
            break;
          }
        }
      } catch (e) {
        console.error('SSE parse error', e);
      }
    };

    sse.onerror = () => {
      sse.close();
    };

    sseRef.current = sse;

    return () => {
      sse.close();
    };
  }, [currentFamilyId, updateScoreLocal]);

  // 🌟 核心修复 3：在数据拉取期间，展示全局骨架屏，坚决杜绝黑屏
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 font-medium">正在进入系统...</p>
      </div>
    );
  }

  // 3. 路由逻辑
  return (
    <HashRouter>
      {/* 🌟 核心修复 2：把 Toaster 挂载到应用的最外层，Toast 终于能看到了！ */}
      <Toaster 
        position="top-center" 
        containerStyle={{
          top: 'calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 16px)'
        }}
        toastOptions={{ 
          className: 'font-bold text-sm shadow-xl rounded-xl',
          duration: 3000,
          // 默认 Info 提示 (蓝色)
          style: { background: '#3b82f6', color: '#fff' },
          success: { 
            // 成功提示 (绿色)
            style: { background: '#10b981', color: '#fff' }, 
            iconTheme: { primary: '#fff', secondary: '#10b981' } 
          },
          error: { 
            // 错误提示 (红色)
            style: { background: '#ef4444', color: '#fff' }, 
            iconTheme: { primary: '#fff', secondary: '#ef4444' } 
          },
        }} 
      />
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/onboarding" element={<Onboarding />} />

        {/* 业务路由 */}
        <Route path="/parent/*" element={<ParentLayout />} />
        <Route path="/child/*" element={<ChildLayout />} />

        {/* 🌟 核心修复 4：超级容错路由。如果你已经登录且有了身份，打开根目录自动送进对应的 Dashboard */}
        <Route 
          path="/" 
          element={<Navigate to={token ? (userType === 'child' ? "/child" : "/parent") : "/auth"} replace />} 
        />
        
        {/* 捕获所有未知乱码路径，统一重定向回根目录 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;