// frontend/src/pages/parent/AdminRedeemDrawer.tsx
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom'; // 🌟 引入 Portal 保证弹窗层级最高
import { useTranslation } from 'react-i18next';
import { useUserStore, Child } from '../../store';
import service, { ApiResponse } from '../../api/request';
import { appToast } from '../../utils/toast';

export interface Reward {
  id: string;
  name: string;
  cost: number;
  emoji: string;
}

export interface AdminRedeemDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  reward: Reward | null; // 接收传过来的奖品信息
}

export default function AdminRedeemDrawer({ isOpen, onClose, onSuccess, reward }: AdminRedeemDrawerProps) {
  const { t } = useTranslation();
  // 🌟 核心修改：不再需要 updateScoreLocal，完全交由 SSE 实时更新
  const { currentFamilyId, childrenList, setChildrenList } = useUserStore();
  
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (currentFamilyId && childrenList.length === 0) {
        fetchChildren();
      }
      setSelectedChildId(null);
      document.body.style.overflow = 'hidden'; // 防止背景滚动
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, currentFamilyId]);

  const fetchChildren = async () => {
    setFetching(true);
    try {
      const res = await service.get<any, ApiResponse<Child[]>>('/children');
      if (res.success) setChildrenList(res.data);
    } catch (err) {
      console.error('Fetch children failed', err);
    } finally { setFetching(false); }
  };

  const handleSubmit = async () => {
    if (!selectedChildId || !reward) {
      appToast.warn('请先选择要兑换的成员');
      return;
    }

    const targetChild = childrenList.find((c: Child) => c.id === selectedChildId);
    if (targetChild && (targetChild.balance || 0) < reward.cost) { 
      appToast.error(t('common.insufficient_points') || '该成员积分不足，无法兑换');
      return;
    }

    setLoading(true);
    try {
      // 🌟 核心修改：直接走通用的 adjust 接口，触发 DO 队列防并发扣分，并自带 SSE 广播
      const res = await service.post<any, ApiResponse>('/rewards/admin-redeem', {
        childId: selectedChildId,
        rewardId: reward.id
      });

      // request.ts 会拦截报错，能走到这说明一定成功了
      if (res && res.success) {
        appToast.success(`成功为 ${targetChild?.name} 兑换了 ${reward.name}！`);
        // updateScoreLocal(selectedChildId, -reward.cost); <- 🌟 删掉了这行，防止假双倍扣分
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally { 
      setLoading(false); 
    }
  };

  // 如果没有数据就不渲染内部
  if (!reward) return null;

  const drawerContent = (
    <div className={`fixed inset-0 z-[9999] ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div 
        className={`absolute inset-0 bg-black/40 dark:bg-black/60 transition-opacity duration-300 ease-out ${isOpen ? 'opacity-100' : 'opacity-0'}`} 
        onClick={onClose}
      />
      
      <div className={`absolute inset-x-0 bottom-0 bg-white dark:bg-gray-900 rounded-t-[24px] flex flex-col transform transition-transform duration-300 ease-out max-h-[85vh] ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        
        {/* 顶部把手指示器 */}
        <div className="w-full flex justify-center pt-3 pb-2">
          <div className="w-10 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
        </div>

        {/* 标题栏 */}
        <div className="px-5 pb-4 border-b border-gray-100 dark:border-gray-800 relative transition-colors">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 text-center transition-colors">
            {t('parent.admin_redeem_title') || '选择兑换成员'}
          </h3>
          <button 
            onClick={onClose}
            className="absolute right-5 top-0 w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-5 overflow-y-auto flex-1">
          {/* 奖品卡片 */}
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-4 flex items-center gap-4 mb-6 border border-orange-100 dark:border-orange-900/50 transition-colors">
            <span className="text-4xl">{reward.emoji || '🎁'}</span>
            <div>
              <p className="font-bold text-gray-800 dark:text-orange-100 transition-colors">{reward.name}</p>
              <p className="text-orange-500 dark:text-orange-400 font-bold text-sm transition-colors">-{reward.cost} 积分</p>
            </div>
          </div>

          <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider transition-colors">
            将此奖励发给：
          </p>

          {fetching ? (
            <div className="text-center py-10 text-gray-400 animate-pulse">加载成员中...</div>
          ) : (
            <div className="space-y-3">
              {childrenList.map((child: Child) => {
                const isSelected = selectedChildId === child.id;
                const canAfford = (child.balance || 0) >= reward.cost;

                return (
                  <button
                    key={child.id}
                    disabled={!canAfford}
                    onClick={() => setSelectedChildId(child.id)}
                    className={`w-full p-4 rounded-2xl flex items-center gap-4 border-2 text-left transition-all ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/30' 
                        : canAfford 
                          ? 'border-gray-100 bg-white hover:border-blue-200 dark:border-gray-800 dark:bg-gray-800 dark:hover:border-blue-700' 
                          : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed dark:border-gray-800 dark:bg-gray-800/50'
                    }`}
                  >
                    <span className="text-3xl bg-white dark:bg-gray-700 w-12 h-12 flex items-center justify-center rounded-xl shadow-sm transition-colors">
                      {child.avatar}
                    </span>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800 dark:text-gray-100 text-lg transition-colors">{child.name}</p>
                      <p className={`text-sm transition-colors ${canAfford ? 'text-gray-500 dark:text-gray-400' : 'text-red-400 dark:text-red-500'}`}>
                        当前余额: {child.balance || 0}
                        {!canAfford && ' (不足)'}
                      </p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {isSelected && <span className="text-white text-xs">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 20px)' }}>
          <button
            onClick={handleSubmit}
            disabled={!selectedChildId || loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95 text-lg flex items-center justify-center gap-2"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '确认兑换'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}