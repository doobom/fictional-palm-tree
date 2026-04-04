import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusCircle, MinusCircle, CheckSquare, Gift, Settings, User } from 'lucide-react';
import api from '../../api/request';
import { useAppStore } from '../../store';
import ScoreActionDrawer from './ScoreActionDrawer'; // 🌟 引入新组件
import ApprovalsView from './ApprovalsView'; // 🌟 引入新组件
import RewardsView from './RewardsView';     // 🌟 引入新组件
import SettingsView from './SettingsView';  // 🌟 引入刚写的设置组件
import { appToast } from '../../utils/toast';
import BatchActionDrawer from './BatchActionDrawer';

export default function ParentDashboard() {
  const { t } = useTranslation();
  const { childrenList, setChildrenList, selectedChildId, setSelectedChildId, getSelectedChild } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'approvals' | 'rewards' | 'settings'>('home'); // home, approvals, rewards, settings

  // 🌟 1. 新增 userInfo 状态
  const [userInfo, setUserInfo] = useState<any>(null);

  // 初始化拉取孩子列表
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 并发请求孩子列表和个人信息
        const [childRes, meRes]: any = await Promise.all([
          api.get('/children/list'),
          api.get('/me')
        ]);
        setChildrenList(childRes.data);
        
        // 提取并保存 userInfo
        const meData = meRes.data || meRes;
        setUserInfo(meData);
      } catch (err) {
        // 错误由拦截器处理
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [setChildrenList]);

  const selectedChild = getSelectedChild();

  // 🌟 新增抽屉控制状态
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<'plus' | 'minus'>('plus');
  const [batchDrawerOpen, setBatchDrawerOpen] = useState(false);

  // 🌟 新增：触发抽屉打开
  const openDrawer = (type: 'plus' | 'minus') => {
    setDrawerType(type);
    setDrawerOpen(true);
  };

  // 🌟 新增：操作成功后，重新拉取孩子数据以刷新积分仪表盘
  const handleScoreSuccess = async () => {
    try {
      const res: any = await api.get('/children/list');
      setChildrenList(res.data); // Zustan state 会自动触发仪表盘重新渲染
      appToast.success(t('parent.success_adjusted', '分数已更新！'));
    } catch (err) {}
  };

  //if (loading) {
  //  return <div className="flex h-screen items-center justify-center">Loading...</div>;
  //}

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      
      {/* 顶部标题栏 */}
      {/* 🌟 修改后：应用 pt-tg-safe 和 top-tg-safe */}
      <div className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10 px-4 pb-3 pt-tg-safe"
        // 顶部标题栏 / 头像区域
        style={{ 
          paddingTop: 'calc(max(var(--tg-safe-top, 0px), var(--app-fallback-top, 0px)) + 16px)' 
        }}
      >
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('parent.dashboard_title')}
        </h1>
      </div>

      {/* 🌟 核心修复：把 4 个 Tab 的视图完全平级分开 */}
      
      {/* 视图 1：主页 Home */}
      {activeTab === 'home' && (
        <div className="p-4 space-y-6">
          {/* 1. 孩子切换横向滚动列表 */}
          {childrenList.length > 0 ? (
            <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
              {childrenList.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setSelectedChildId(child.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                    selectedChildId === child.id 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <span className="mr-2">{child.avatar || '👦'}</span>
                  {child.name}
                </button>
              ))}
              <div className="flex justify-between items-center mb-3">
                <button 
                  onClick={() => setBatchDrawerOpen(true)}
                  className="flex items-center text-sm bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400 px-3 py-1.5 rounded-full font-bold active:scale-95 transition-transform"
                >
                  {t('parent.btn_batch_action')}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500">
              {t('parent.no_children')}
            </div>
          )}

          {/* 2. 当前选中孩子的积分仪表盘 */}
          {selectedChild && (
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-blue-100 text-sm mb-1">{t('parent.total_balance', { pointName: userInfo?.point_name || '积分' })}</p>
                <div className="text-5xl font-extrabold tracking-tight mb-4">
                  {selectedChild.score_gained - selectedChild.score_spent}
                  <span className="text-2xl ml-1 opacity-80">{userInfo?.point_emoji || '🪙'}</span>
                </div>
                <div className="flex space-x-6 text-sm">
                  <div>
                    <p className="text-blue-200 text-xs">{t('parent.gained', { pointName: userInfo?.point_name || '积分' })}</p>
                    <p className="font-semibold">+{selectedChild.score_gained}</p>
                  </div>
                  <div>
                    <p className="text-blue-200 text-xs">{t('parent.spent', { pointName: userInfo?.point_name || '积分' })}</p>
                    <p className="font-semibold">-{selectedChild.score_spent}</p>
                  </div>
                </div>
              </div>
              {/* 装饰性背景 */}
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
            </div>
          )}

          {/* 3. 快捷操作按钮组 */}
          {selectedChild && (
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => openDrawer('plus')} 
                className="flex items-center justify-center p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition active:scale-95"
              >
                <PlusCircle className="w-6 h-6 text-green-500 mr-2" />
                <span className="font-medium text-gray-900 dark:text-white">{t('parent.btn_add_score')}</span>
              </button>
              
              <button 
                onClick={() => openDrawer('minus')} 
                className="flex items-center justify-center p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition active:scale-95"
              >
                <MinusCircle className="w-6 h-6 text-red-500 mr-2" />
                <span className="font-medium text-gray-900 dark:text-white">{t('parent.btn_minus_score')}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 视图 2：挂载待审批视图 */}
      {activeTab === 'approvals' && <ApprovalsView />}

      {/* 视图 3：挂载奖品库视图 */}
      {activeTab === 'rewards' && <RewardsView />}

      {/* 视图 4：挂载设置视图 */}
      {activeTab === 'settings' && <SettingsView />}


      {/* 底部悬浮导航栏 (Bottom Navigation) */}
      {/* 🌟 修改后：移除 pb-safe，改用 pb-tg-safe */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50 pb-tg-safe"
        // 底部导航栏
        style={{ 
          paddingBottom: 'calc(max(var(--tg-safe-bottom, 0px), var(--app-fallback-bottom, 0px)) + 8px)' 
        }}
      >
        <div className="flex justify-around items-center h-16">
          <NavItem icon={<User />} label={t('parent.tab_home')} isActive={activeTab === 'home'} onClick={() => setActiveTab('home')} />
          <NavItem icon={<CheckSquare />} label={t('parent.tab_approvals')} isActive={activeTab === 'approvals'} onClick={() => setActiveTab('approvals')} />
          <NavItem icon={<Gift />} label={t('parent.tab_rewards')} isActive={activeTab === 'rewards'} onClick={() => setActiveTab('rewards')} />
          <NavItem icon={<Settings />} label={t('parent.tab_settings')} isActive={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </div>
      </div>

      {/* 💡 顺手帮你补上的 Bug：
        你写了 openDrawer 逻辑，但是忘记在页面里挂载 <ScoreActionDrawer /> 组件了！
        你需要在这里渲染抽屉，否则点击加减分按钮没有任何反应。
        (请根据你实际的 ScoreActionDrawer props 调整下面的属性) 
      */}
      {/* 🌟 只有当 selectedChild 存在时，才渲染抽屉，并把名字传进去 */}
      {selectedChildId && selectedChild && (
        <ScoreActionDrawer 
          isOpen={drawerOpen} 
          onClose={() => setDrawerOpen(false)} 
          type={drawerType}
          childId={selectedChildId}
          childName={selectedChild.name} /* 🌟 补上这个缺失的属性！ */
          onSuccess={handleScoreSuccess}
        />
      )}

      <BatchActionDrawer 
        isOpen={batchDrawerOpen} 
        onClose={() => setBatchDrawerOpen(false)} 
        onSuccess={handleScoreSuccess} 
      />

    </div>
  );
}

// 底部导航项子组件
function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
        isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
      }`}
    >
      <div className={`${isActive ? 'scale-110' : 'scale-100'} transition-transform duration-200`}>
        {React.cloneElement(icon as React.ReactElement, { size: 22, strokeWidth: isActive ? 2.5 : 2 })}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}