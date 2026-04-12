// frontend/src/pages/child/ChildDashboard.tsx
import React, { useEffect, useState } from 'react';
import { useUserStore } from '../../store';
import { usePlatformApp } from '../../hooks/usePlatformApp';
import service, { ApiResponse } from '../../api/request'; 
import { appToast } from '../../utils/toast';
import ScoreTrendChart from '../../components/ScoreTrendChart';
import { Activity } from 'lucide-react';

export interface ChildDetail {
  id: string;
  name: string;
  avatar: string;
  balance: number;
  achievementCount: number;
  [key: string]: any; 
}

const ChildDashboard: React.FC = () => {
  const { currentFamilyId, families, user } = useUserStore();
  const { triggerImpact } = usePlatformApp(); 
  
  const [data, setData] = useState<ChildDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const currentFamily = families.find(f => f.id === currentFamilyId);

  const childId = user?.id;

  useEffect(() => {
    if (currentFamilyId && user?.id) fetchChildData();
  }, [currentFamilyId, user?.id]);

  const fetchChildData = async () => {
    setLoading(true);
    try {
      const res = await service.get<any, ApiResponse<ChildDetail>>(`/children/${user?.id}`);
      if (res.success) setData(res.data);
    } catch (err) {
      console.error('Failed to fetch child data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemRequest = () => {
    triggerImpact('heavy'); 
    appToast.info('正在为您打开奖品商店...'); 
    window.location.hash = '#/child/rewards'; // 放开注释，允许跳转
  };

  if (loading && !data) {
    return (
      // 🌟 加载页暗黑适配
      <div className="flex flex-col items-center justify-center min-h-screen bg-blue-50 dark:bg-gray-900 pb-20 transition-colors duration-300">
        <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-blue-500 dark:text-blue-400 font-bold animate-pulse">正在进入您的专属乐园...</p>
      </div>
    );
  }

  return (
    <div 
      // 🌟 背景渐变暗黑适配
      className="child-dashboard bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 min-h-screen px-4 pb-24 transition-colors duration-300"
      style={{ paddingTop: 'calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 16px)' }}
    >
      {/* 1. 个人资料与积分卡片 */}
      <section className="relative bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-xl shadow-blue-100 dark:shadow-none mb-6 overflow-hidden transition-colors duration-300">
        <div className="absolute -top-4 -right-4 p-4 opacity-10 text-8xl transform rotate-12">
          {currentFamily?.point_emoji || '🪙'}
        </div>
        
        <div className="flex items-center gap-4 mb-6 relative z-10">
          <div className="text-5xl p-3 bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-100 dark:border-yellow-900/50 rounded-2xl shadow-sm transition-colors">
            {data?.avatar || '👦'}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 transition-colors">Hi, {data?.name}!</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm transition-colors">{currentFamily?.name} 的小勇士</p>
          </div>
        </div>

        <div className="bg-blue-600 dark:bg-blue-500 rounded-2xl p-5 text-white shadow-lg shadow-blue-300 dark:shadow-none relative z-10 transition-colors">
          <p className="text-blue-100 text-sm font-medium mb-1">我的当前可用{currentFamily?.point_name || '积分'}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black tracking-tight">{data?.balance || 0}</span>
            <span className="text-xl opacity-90">{currentFamily?.point_emoji || '🪙'}</span>
          </div>
        </div>
      </section>

      {/* 🌟 新增：统计图表模块 */}
      <section className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="text-blue-500" size={20} />
            最近 7 天成长轨迹
          </h2>
        </div>
        
        {/* 渲染图表 */}
        {childId ? (
          <ScoreTrendChart childId={childId} />
        ) : (
          <div className="text-center text-sm text-gray-400 mt-10">加载中...</div>
        )}
      </section>

      {/* 2. 统计概览 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 text-center shadow-sm transition-colors duration-300">
          <p className="text-3xl mb-2">🏆</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider transition-colors">已获成就</p>
          <p className="text-2xl font-black text-gray-800 dark:text-gray-100 mt-1 transition-colors">{data?.achievementCount || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 text-center shadow-sm transition-colors duration-300">
          <p className="text-3xl mb-2">🎁</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider transition-colors">心愿清单</p>
          <p className="text-2xl font-black text-gray-800 dark:text-gray-100 mt-1 transition-colors">3</p>
        </div>
      </div>

      {/* 3. 快捷行动区 */}
      <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-3 px-1 text-lg transition-colors">快速行动</h3>
      <div className="grid gap-4">
        <button 
          onClick={handleRedeemRequest}
          className="w-full bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 dark:from-orange-500 dark:to-orange-600 text-white p-4 rounded-2xl font-bold flex items-center justify-between transition-all active:scale-95 shadow-lg shadow-orange-200 dark:shadow-none"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl bg-white/20 p-2 rounded-xl">🛍️</span>
            <span className="text-lg">兑换我的心仪奖品</span>
          </div>
          <span className="opacity-80 text-xl">→</span>
        </button>

        <button 
          onClick={() => appToast.info('开发中，敬请期待！')}
          className="w-full bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold flex items-center justify-between text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl bg-gray-50 dark:bg-gray-700 p-2 rounded-xl transition-colors">📈</span>
            <span className="text-lg">查看积分成长轨迹</span>
          </div>
          <span className="text-gray-300 dark:text-gray-500 text-xl transition-colors">→</span>
        </button>
      </div>

      {/* 4. 底部鼓励语 */}
      <div className="mt-10 flex justify-center">
        <p className="text-center text-gray-400 dark:text-gray-500 text-xs italic bg-white/50 dark:bg-gray-800/50 px-4 py-2 rounded-full inline-block transition-colors">
          ✨ 继续加油！再获得 50 {currentFamily?.point_name || '积分'} 就能兑换惊喜啦！
        </p>
      </div>
    </div>
  );
};

export default ChildDashboard;