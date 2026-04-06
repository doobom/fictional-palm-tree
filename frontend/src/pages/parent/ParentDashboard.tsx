// frontend/src/pages/parent/ParentDashboard.tsx
import React, { useEffect, useState } from 'react';
import { useUserStore } from '../../store';
import { usePlatformApp } from '../../hooks/usePlatformApp';
import service, { ApiResponse } from '../../api/request';
import { appToast } from '../../utils/toast';

interface Child {
  id: string;
  name: string;
  avatar: string;
  balance: number;
}

const ParentDashboard: React.FC = () => {
  const { currentFamilyId, families, updateScoreLocal } = useUserStore();
  const { triggerImpact } = usePlatformApp(); // 获取触感反馈
  
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  // 获取当前家庭配置（用于显示积分 Emoji）
  const currentFamily = families.find(f => f.id === currentFamilyId);
  const canOperate = currentFamily?.role !== 'viewer';

  // 1. 当切换家庭时，重新加载孩子列表
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
        setChildren(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * 2. 执行加分操作
   * 逻辑：通过拦截器自动带上 x-family-id，发送给后端转发至 DO
   */
  const handleAdjustScore = async (childId: string, points: number) => {
    if (!canOperate) {
      appToast.error('您当前的观察者权限无法加分');
      return;
    }

    try {
      const res = await service.post<any, ApiResponse>('/scores/adjust', {
        childId,
        points,
        remark: '手动奖励'
      });

      if (res.success) {
        triggerImpact('medium'); // 震动反馈
        appToast.success(`成功发放 ${points} ${currentFamily?.point_name}`);
        
        // 乐观更新 UI：直接修改本地 state，或依赖 SSE 的自动同步
        setChildren(prev => prev.map(c => 
          c.id === childId ? { ...c, balance: c.balance + points } : c
        ));
      }
    } catch (err) {
      // 错误已由 api/request.ts 统一处理
    }
  };

  if (loading && children.length === 0) {
    return <div className="flex justify-center p-20">正在同步家庭数据...</div>;
  }

  return (
    <div className="dashboard-container p-4 pb-24">
      {/* 顶部标题栏 */}
      <header className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-gray-900">
            {currentFamily?.name || '我的家庭'}
          </h1>
          <p className="text-gray-500 text-sm">今天也要加油鸭 ✨</p>
        </div>
        <div className="bg-blue-50 px-3 py-1 rounded-full text-blue-600 text-xs font-bold">
          {currentFamily?.role.toUpperCase()}
        </div>
      </header>

      {/* 孩子卡片列表 */}
      <div className="grid gap-4">
        {children.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400">还没有添加孩子呢</p>
            <button className="text-blue-600 font-bold mt-2">+ 立即添加</button>
          </div>
        ) : (
          children.map(child => (
            <div key={child.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-4 mb-5">
                <span className="text-4xl bg-gray-50 w-16 h-16 flex items-center justify-center rounded-2xl">
                  {child.avatar}
                </span>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-800">{child.name}</h2>
                  <div className="flex items-center gap-1 text-orange-500">
                    <span className="text-lg">
                      {currentFamily?.point_emoji || '🪙'}
                    </span>
                    <span className="text-2xl font-black tracking-tight">
                      {child.balance}
                    </span>
                    <span className="text-xs font-medium ml-1 text-gray-400">
                      {currentFamily?.point_name}
                    </span>
                  </div>
                </div>
              </div>

              {/* 快捷操作区 */}
              {canOperate && (
                <div className="flex gap-2">
                  {[1, 2, 5, 10].map(val => (
                    <button
                      key={val}
                      onClick={() => handleAdjustScore(child.id, val)}
                      className="flex-1 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 py-3 rounded-xl font-bold text-gray-600 transition-all active:scale-95"
                    >
                      +{val}
                    </button>
                  ))}
                  <button 
                    onClick={() => appToast.info('更多操作请进入详情页')}
                    className="w-12 bg-gray-100 flex items-center justify-center rounded-xl text-gray-400"
                  >
                    ⋯
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ParentDashboard;