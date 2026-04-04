// src/App.tsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import api from './api/request';
import { Toaster } from 'react-hot-toast';

// 🌟 引入我们的跨端环境探针与初始化 Hook
import { usePlatformApp } from './hooks/usePlatformApp';

// 引入我们的三大核心页面组件
import AuthPage from './pages/auth/AuthPage';
import ParentDashboard from './pages/parent/ParentDashboard';
import ChildDashboard from './pages/child/ChildDashboard';

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isInitializing, setIsInitializing] = useState(true);
  
  const { platform } = usePlatformApp();

  useEffect(() => {
    // 探针：向后端发起鉴权请求，检查用户状态
    const checkAuth = async () => {
      try {
        const res: any = await api.get('/me');
        const user = res.data;
        if (location.pathname === '/' || location.pathname === '/auth') {
          navigate(user.userType === 'child' ? '/child' : '/parent', { replace: true });
        }
      } catch (err: any) {
        if (err.type === 'NEED_REGISTER' || err.type === 'NEED_LOGIN') {
          if (location.pathname !== '/auth') {
            navigate('/auth', { replace: true });
          }
        }
      } finally {
        setIsInitializing(false);
      }
    };

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  if (isInitializing) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 dark:text-gray-400 font-medium tracking-widest text-sm animate-pulse">
          LOADING...
        </p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/auth" replace />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/parent" element={<ParentDashboard />} />
      <Route path="/child" element={<ChildDashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans selection:bg-blue-200 selection:text-blue-900">
        <AppRoutes />
        <Toaster 
          position="top-center"
          toastOptions={{
            duration: 2000,
            style: {
              background: '#333',
              color: '#fff',
              borderRadius: '12px',
              padding: '12px 24px',
              fontWeight: 'bold',
            },
            success: { style: { background: '#10B981' } }, // 绿色
            error: { style: { background: '#EF4444' } },   // 红色
          }} 
        />
      </div>
    </BrowserRouter>
  );
}