// frontend/src/pages/parent/ParentDashboard.tsx
import { Home, Gift, ClipboardCheck, Settings as SettingsIcon } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useUserStore, Child } from '../../store';
import service, { ApiResponse } from '../../api/request';

// 🌟 导入其他视图和组件 (拼图合体)
import FamilySelector from '../../components/FamilySelector';
import RewardsView from './RewardsView';
import ApprovalsView from './ApprovalsView';
import SettingsView from './SettingsView';
import ScoreActionDrawer from './ScoreActionDrawer';
import BatchActionDrawer from './BatchActionDrawer';

// ==========================================
// 1. 首页视图组件 (真正的 Dashboard 数据区)
// ==========================================
const HomeView: React.FC = () => {
  const { currentFamilyId, families, childrenList, setChildrenList } = useUserStore();
  const [loading, setLoading] = useState(true);
  
  // 抽屉状态
  const [scoreDrawerOpen, setScoreDrawerOpen] = useState(false);
  const [batchDrawerOpen, setBatchDrawerOpen] = useState(false);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);

  const currentFamily = families.find(f => f.id === currentFamilyId);
  const canOperate = currentFamily?.role !== 'viewer';

  useEffect(() => {
    if (currentFamilyId) {
      fetchChildren();
    }
  }, [currentFamilyId]);

  const fetchChildren = async () => {
    setLoading(true);
    try {
      const res = await service.get<any, ApiResponse<Child[]>>('/children');
      if (res.success) {
        setChildrenList(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const openScoreDrawer = (child: Child) => {
    setSelectedChild(child);
    setScoreDrawerOpen(true);
  };

  if (loading && childrenList.length === 0) {
    return <div className="flex justify-center p-20 text-gray-500 animate-pulse">加载家庭数据中...</div>;
  }

  return (
    <div className="home-view p-4 pb-24 space-y-6 animate-fade-in-up">
      
      {/* 顶部批量操作栏 */}
      {childrenList.length > 0 && canOperate && (
        <div className="flex justify-between items-center bg-blue-50 p-4 rounded-2xl border border-blue-100 shadow-sm">
          <div>
            <h3 className="font-bold text-blue-800">批量操作</h3>
            <p className="text-xs text-blue-600 mt-0.5">为多个孩子同时加减分</p>
          </div>
          <button 
            onClick={() => setBatchDrawerOpen(true)}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-md shadow-blue-200 active:scale-95 transition-all"
          >
            全选操作
          </button>
        </div>
      )}

      {/* 孩子列表 */}
      <div className="grid gap-4">
        {childrenList.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-gray-200 shadow-sm">
            <span className="text-5xl mb-3 block">👶</span>
            <p className="text-gray-500 font-medium mb-6">还没有添加孩子呢</p>
            {/* 🌟 修复“点击没反应”：直接跳转到设置页 */}
            <button 
              onClick={() => window.location.hash = '#/parent/settings'}
              className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all"
            >
              去设置页添加
            </button>
          </div>
        ) : (
          childrenList.map((child: Child) => (
            <div key={child.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center justify-between transition-all hover:shadow-md">
              <div className="flex items-center gap-4">
                <span className="text-4xl bg-gray-50 w-16 h-16 flex items-center justify-center rounded-2xl shadow-inner border border-gray-100">
                  {child.avatar}
                </span>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{child.name}</h2>
                  <div className="flex items-baseline gap-1 text-orange-500 mt-1">
                    <span className="text-sm">{currentFamily?.point_emoji || '🪙'}</span>
                    <span className="text-2xl font-black tracking-tight">{child.balance}</span>
                    <span className="text-xs font-medium text-gray-400 ml-1">{currentFamily?.point_name}</span>
                  </div>
                </div>
              </div>
              
              {canOperate && (
                <button 
                  onClick={() => openScoreDrawer(child)}
                  className="w-14 h-14 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-2xl font-black text-2xl flex items-center justify-center transition-colors shadow-sm active:scale-95"
                >
                  ±
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* 抽屉组件挂载 */}
      <ScoreActionDrawer 
        isOpen={scoreDrawerOpen} 
        onClose={() => setScoreDrawerOpen(false)} 
        child={selectedChild} 
      />
      <BatchActionDrawer 
        isOpen={batchDrawerOpen} 
        onClose={() => setBatchDrawerOpen(false)} 
      />
    </div>
  );
};

// ==========================================
// 2. 底部导航栏组件 (Tab Bar) - Lucide 高级重构版
// ==========================================
const BottomTabBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  // 🌟 使用 Lucide 图标组件
  const tabs = [
    { path: '/parent', exact: true, label: '首页', icon: Home },
    { path: '/parent/rewards', exact: false, label: '奖励', icon: Gift },
    { path: '/parent/approvals', exact: false, label: '审批', icon: ClipboardCheck },
    { path: '/parent/settings', exact: false, label: '设置', icon: SettingsIcon }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-100 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.04)] z-30">
      <div className="flex justify-around items-center h-16 sm:h-20 max-w-md mx-auto px-2">
        {tabs.map(tab => {
          const isActive = tab.exact 
            ? currentPath === '/parent' || currentPath === '/parent/' 
            : currentPath.startsWith(tab.path);
          
          const Icon = tab.icon;

          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center w-full h-full transition-colors duration-300 ${
                isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {/* 🌟 选中时图标放大，并且线条变粗 (2 -> 2.5) */}
              <Icon 
                className={`w-6 h-6 mb-1 transition-all duration-300 ${isActive ? 'scale-110' : 'scale-100'}`} 
                strokeWidth={isActive ? 2.5 : 2} 
              />
              <span className={`text-[10px] font-bold ${isActive ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'} transition-all duration-300`}>
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
  
  // 🌟 核心修复 2：强制同步 Telegram 底层背景色，彻底杜绝黑边
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg && tg.setBackgroundColor) {
      // 亮色模式跟随 bg-gray-50 (#f9fafb)，暗色模式跟随 dark:bg-gray-900 (#111827)
      const bgColor = tg.colorScheme === 'dark' ? '#111827' : '#f9fafb';
      try { tg.setBackgroundColor(bgColor); } catch (e) {}
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800 flex flex-col font-sans">
      
      <div 
        className="sticky top-0 z-40 bg-white dark:bg-gray-800 transition-colors shadow-sm"
        style={{ paddingTop: 'var(--safe-top, env(safe-area-inset-top, 0px))' }}
      >
        <FamilySelector />
      </div>

      {/* 🌟 核心修复 1：在真正的全局滚动容器上加上 overscroll-y-none，拦截浏览器的橡皮筋特效 */}
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