// frontend/src/pages/parent/ParentDashboard.tsx
import { Home, Gift, ClipboardCheck, Settings as SettingsIcon, CheckSquare, ArrowRightLeft, RefreshCw, Plus, Minus, Star } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useUserStore, Child, Family } from '../../store';
import service, { ApiResponse } from '../../api/request';
import { useTranslation } from 'react-i18next';

// 🌟 导入其他视图和组件 (拼图合体)
import FamilySelector from '../../components/FamilySelector';
import RewardsView from './RewardsView';
import ApprovalsView from './ApprovalsView';
import SettingsView from './SettingsView';
import ScoreActionDrawer from './ScoreActionDrawer';
import BatchActionDrawer from './BatchActionDrawer';
import HomeView from './HomeView';

// ==========================================
// 1. 首页视图组件 (真正的 Dashboard 数据区)
// ==========================================

// 注意：HomeView 组件被单独抽离成了一个文件，保持 ParentDashboard 的整洁

// ==========================================
// 2. 底部导航栏组件 (Tab Bar) - Lucide 高级重构版
// ==========================================
const BottomTabBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const tabs = [
    { path: '/parent', icon: <Home size={22} />, label: t('parent.tab_home') },
    { path: '/parent/rewards', icon: <Gift size={22} />, label: t('parent.tab_rewards') },
    { path: '/parent/approvals', icon: <CheckSquare size={22} />, label: t('parent.tab_approvals') },
    { path: '/parent/settings', icon: <SettingsIcon size={22} />, label: t('parent.tab_settings') },
  ];

  return (
    // 🌟 核心修改：底部导航栏支持暗夜模式的毛玻璃效果
    <div className="fixed bottom-0 w-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t border-gray-100 dark:border-gray-800 transition-colors duration-300 z-50">
      <div 
        className="flex justify-around items-center"
        // 适配 iPhone 的底部安全区 (Home Indicator)
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 5px)' }}
      >
        {tabs.map(tab => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex-1 flex flex-col items-center justify-center py-2 active:scale-95 transition-transform"
            >
              {/* 🌟 核心修改：活动/未活动的图标颜色 */}
              <div className={`mb-1 transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {tab.icon}
              </div>
              <span className={`text-[10px] font-bold transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================
// 3. 父布局主组件
// ==========================================
const ParentLayout: React.FC = () => {
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg && tg.setBackgroundColor) {
      // 亮色模式跟随 bg-gray-50 (#f9fafb)，暗色模式跟随 dark:bg-gray-900 (#111827)
      const bgColor = tg.colorScheme === 'dark' ? '#111827' : '#f9fafb';
      try { tg.setBackgroundColor(bgColor); } catch (e) {}
    }
  }, []);

  return (
    // 🌟 核心修改：大容器背景支持暗夜模式
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300 flex flex-col font-sans">
      
      {/* 🌟 核心修改：顶部家庭选择器吸顶栏 */}
      <div 
        className="sticky top-0 z-40 bg-white dark:bg-gray-800 transition-colors duration-300 shadow-sm"
        style={{ paddingTop: 'var(--safe-top, env(safe-area-inset-top, 0px))' }}
      >
        <FamilySelector />
      </div>

      <div className="flex-1 overflow-y-auto overscroll-y-none">
        <Routes>
          <Route path="/" element={<HomeView />} />
          <Route path="/rewards" element={<RewardsView />} />
          <Route path="/approvals" element={<ApprovalsView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="*" element={<Navigate to="/parent" replace />} />
        </Routes>
      </div>

      <BottomTabBar />
    </div>
  );
};

export default ParentLayout;