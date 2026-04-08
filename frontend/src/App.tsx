// frontend/src/App.tsx
import React, { useEffect, useRef, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useUserStore } from './store';
import service, { ApiResponse } from './api/request';

// 页面组件导入
import ParentLayout from './pages/parent/ParentDashboard';
import ChildLayout from './pages/child/ChildDashboard';
import AuthPage from './pages/auth/AuthPage';
import Onboarding from './pages/auth/Onboarding';

const App: React.FC = () => {
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
        if (data.type === 'SCORE_UPDATED') {
          const { childId, points } = data.payload;
          updateScoreLocal(childId, points);
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