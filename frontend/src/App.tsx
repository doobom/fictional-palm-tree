// frontend/src/App.tsx
import React, { useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useUserStore } from './store';
import service, { ApiResponse } from './api/request';

// 页面组件导入 (假设路径)
import ParentLayout from './pages/parent/ParentDashboard';
import ChildLayout from './pages/child/ChildDashboard';
import AuthPage from './pages/auth/AuthPage';
import Onboarding from './pages/auth/Onboarding';

const App: React.FC = () => {
  const { currentFamilyId, setUserInfo, updateScoreLocal, token, families } = useUserStore();
  const sseRef = useRef<EventSource | null>(null);

  // 1. 核心初始化：获取用户信息与家庭列表
  useEffect(() => {
    const initUser = async () => {
      if (!token && !window.Telegram?.WebApp?.initData) return;
      
      try {
        const res = await service.get<any, ApiResponse>('/user/me');
        if (res.success) {
          setUserInfo(res.data);
        }
      } catch (err: any) {
        // 错误已由 request.ts 拦截器处理（如跳转到 Onboarding）
        console.error('Init user failed', err);
      }
    };

    initUser();
  }, [token, setUserInfo]);

  // 2. 实时通信：建立 SSE 连接
  useEffect(() => {
    // 只有当存在活跃家庭 ID 时才建立连接
    if (!currentFamilyId) return;

    // 清理旧连接
    if (sseRef.current) {
      sseRef.current.close();
    }

    // 创建新连接到 Durable Object 转发的接口
    const url = `${import.meta.env.VITE_API_BASE_URL}/scores/realtime`;
    const sse = new EventSource(url, { withCredentials: true });

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[SSE] Received message:', data);

        if (data.type === 'SCORE_UPDATED') {
          const { childId, points } = data.payload;
          // 调用 Store 的 Action 进行局部 UI 更新，无需全量刷新
          updateScoreLocal(childId, points);
        }
      } catch (e) {
        console.error('SSE parse error', e);
      }
    };

    sse.onerror = () => {
      console.warn('[SSE] Connection lost, retrying...');
      sse.close();
    };

    sseRef.current = sse;

    return () => {
      sse.close();
    };
  }, [currentFamilyId, updateScoreLocal]);

  // 3. 简单的路由逻辑
  return (
    <HashRouter>
      <Routes>
        {/* 公共路由 */}
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/onboarding" element={<Onboarding />} />

        {/* 动态权限路由 */}
        <Route 
          path="/parent/*" 
          element={families.length > 0 ? <ParentLayout /> : <Navigate to="/onboarding" />} 
        />
        <Route path="/child/*" element={<ChildLayout />} />

        {/* 默认跳转 */}
        <Route path="/" element={<Navigate to="/auth" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;