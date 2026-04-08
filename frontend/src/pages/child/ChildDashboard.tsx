// frontend/src/pages/child/ChildDashboard.tsx
import React, { useEffect, useState } from 'react';
import { useUserStore } from '../../store';
import { usePlatformApp } from '../../hooks/usePlatformApp';
import service, { ApiResponse } from '../../api/request'; // 🌟 导入 ApiResponse 泛型
import { appToast } from '../../utils/toast'; // 🌟 统一使用 appToast

// 1. 修复接口定义：移除 extends any，直接定义清晰的数据结构
export interface ChildDetail {
  id: string;
  name: string;
  avatar: string;
  balance: number;
  achievementCount: number;
  // 如果后端还会返回其他未知字段，可以使用索引签名保留扩展性
  [key: string]: any; 
}

const ChildDashboard: React.FC = () => {
  // 2. 从全局 Store 获取当前上下文
  const { currentFamilyId, families, user } = useUserStore();
  const { triggerImpact } = usePlatformApp(); // 触感反馈
  
  const [data, setData] = useState<ChildDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // 获取当前家庭的个性化配置 (如积分名称、Emoji)
  const currentFamily = families.find(f => f.id === currentFamilyId);

  // 3. 监听家庭切换，拉取当前家庭下的孩子数据
  useEffect(() => {
    // 确保 user 存在且当前有选中的家庭
    if (currentFamilyId && user?.id) {
      fetchChildData();
    }
  }, [currentFamilyId, user?.id]);

  const fetchChildData = async () => {
    setLoading(true);
    try {
      // 🌟 严格指定泛型，消除 res.success 报错
      // 拦截器会自动注入 x-family-id，后端会校验该 user.id 在该家庭下的数据
      const res = await service.get<any, ApiResponse<ChildDetail>>(`/children/${user?.id}`);
      
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      // 报错已由 api/request.ts 拦截器统一处理并 toast
      console.error('Failed to fetch child data:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 4. 模拟发起兑换申请/前往商城
   */
  const handleRedeemRequest = () => {
    triggerImpact('heavy'); // 兑换时的重度震动反馈，增强沉浸感
    appToast.info('正在为您打开奖品商店...'); // 🌟 使用 appToast
    // window.location.hash = '#/child/rewards';
  };

  // 骨架屏或加载提示
  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-blue-50 pb-20">
        <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-blue-500 font-bold animate-pulse">正在进入您的专属乐园...</p>
      </div>
    );
  }

  return (
    <div 
      className="child-dashboard bg-gradient-to-b from-blue-50 to-white min-h-screen px-4 pb-24"
      // 🌟 核心修复：增加顶部安全隔离区 (原生边距 + 额外 1rem 留白)
      style={{ paddingTop: 'calc(1rem + var(--tg-safe-area-inset-top, env(safe-area-inset-top, 24px)))' }}
    >
      {/* 1. 个人资料与积分卡片 */}
      <section className="relative bg-white rounded-3xl p-6 shadow-xl shadow-blue-100 mb-6 overflow-hidden">
        {/* ... 后面的代码保持完全不变 ... */}
        {/* 背景装饰 Emoji */}
        <div className="absolute -top-4 -right-4 p-4 opacity-10 text-8xl transform rotate-12">
          {currentFamily?.point_emoji || '🪙'}
        </div>
        
        <div className="flex items-center gap-4 mb-6 relative z-10">
          <div className="text-5xl p-3 bg-yellow-50 border-2 border-yellow-100 rounded-2xl shadow-sm">
            {data?.avatar || '👦'}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Hi, {data?.name}!</h1>
            <p className="text-gray-500 text-sm">{currentFamily?.name} 的小勇士</p>
          </div>
        </div>

        <div className="bg-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-300 relative z-10">
          <p className="text-blue-100 text-sm font-medium mb-1">我的当前可用{currentFamily?.point_name || '积分'}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black tracking-tight">{data?.balance || 0}</span>
            <span className="text-xl opacity-90">{currentFamily?.point_emoji || '🪙'}</span>
          </div>
        </div>
      </section>

      {/* 2. 统计概览 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 text-center shadow-sm">
          <p className="text-3xl mb-2">🏆</p>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">已获成就</p>
          <p className="text-2xl font-black text-gray-800 mt-1">{data?.achievementCount || 0}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 text-center shadow-sm">
          <p className="text-3xl mb-2">🎁</p>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">心愿清单</p>
          <p className="text-2xl font-black text-gray-800 mt-1">3</p>
        </div>
      </div>

      {/* 3. 快捷行动区 */}
      <h3 className="font-bold text-gray-700 mb-3 px-1 text-lg">快速行动</h3>
      <div className="grid gap-4">
        <button 
          onClick={handleRedeemRequest}
          className="w-full bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white p-4 rounded-2xl font-bold flex items-center justify-between transition-all active:scale-95 shadow-lg shadow-orange-200"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl bg-white/20 p-2 rounded-xl">🛍️</span>
            <span className="text-lg">兑换我的心仪奖品</span>
          </div>
          <span className="opacity-80 text-xl">→</span>
        </button>

        <button 
          onClick={() => appToast.info('开发中，敬请期待！')}
          className="w-full bg-white border-2 border-gray-100 p-4 rounded-2xl font-bold flex items-center justify-between text-gray-700 hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl bg-gray-50 p-2 rounded-xl">📈</span>
            <span className="text-lg">查看积分成长轨迹</span>
          </div>
          <span className="text-gray-300 text-xl">→</span>
        </button>
      </div>

      {/* 4. 底部鼓励语 */}
      <div className="mt-10 flex justify-center">
        <p className="text-center text-gray-400 text-xs italic bg-white/50 px-4 py-2 rounded-full inline-block">
          ✨ 继续加油！再获得 50 {currentFamily?.point_name || '积分'} 就能兑换惊喜啦！
        </p>
      </div>
    </div>
  );
};

export default ChildDashboard;