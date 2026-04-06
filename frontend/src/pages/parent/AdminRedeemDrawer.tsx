// frontend/src/pages/parent/AdminRedeemDrawer.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next'; // 假设你使用的是 react-i18next
import { useUserStore, Child } from '../../store';
import service, { ApiResponse } from '../../api/request';
import { appToast } from '../../utils/toast'; // 🌟 已统一替换为 appToast

// 定义奖励的数据接口
export interface Reward {
  id: string;
  name: string;
  points: number;
  icon: string;
}

export interface AdminRedeemDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  reward: Reward | null;
}

export default function AdminRedeemDrawer({ isOpen, onClose, onSuccess, reward }: AdminRedeemDrawerProps) {
  const { t } = useTranslation();
  
  // 1. 从 Store 获取状态和动作
  const { currentFamilyId, childrenList, setChildrenList, updateScoreLocal } = useUserStore();
  
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  // 2. 当 Drawer 打开且孩子列表为空时，主动拉取数据
  useEffect(() => {
    if (isOpen && currentFamilyId && childrenList.length === 0) {
      fetchChildren();
    }
    // 每次打开重置选择状态
    if (isOpen) {
      setSelectedChildId(null);
    }
  }, [isOpen, currentFamilyId]);

  const fetchChildren = async () => {
    setFetching(true);
    try {
      // 🌟 严格使用泛型
      const res = await service.get<any, ApiResponse<Child[]>>('/children');
      if (res.success) {
        setChildrenList(res.data);
      }
    } catch (err) {
      console.error('Fetch children failed', err);
    } finally {
      setFetching(false);
    }
  };

  // 3. 提交兑换操作
  const handleSubmit = async () => {
    if (!selectedChildId || !reward) {
      appToast.warn('请先选择要兑换的成员');
      return;
    }

    // 前端提前校验积分余额
    const targetChild = childrenList.find((c: Child) => c.id === selectedChildId);
    if (targetChild && targetChild.balance < reward.points) {
      appToast.error(t('common.insufficient_points') || '该成员积分不足，无法兑换');
      return;
    }

    setLoading(true);
    try {
      // 🌟 严格指定提交泛型
      const res = await service.post<any, ApiResponse>('/rewards/redeem', {
        childId: selectedChildId,
        rewardId: reward.id,
        // 如果后端需要管理员代办标记，可加上此参数
        adminOverride: true 
      });

      if (res.success) {
        appToast.success(`成功为 ${targetChild?.name} 兑换了 ${reward.name}！`);
        
        // 乐观更新 UI：扣除对应积分
        updateScoreLocal(selectedChildId, -reward.points);
        
        onSuccess?.(); // 通知父组件刷新
        onClose();    // 关闭 Drawer
      }
    } catch (err) {
      // 错误已由拦截器处理
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !reward) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div 
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* 底部抽屉 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 transform transition-transform duration-300 max-h-[85vh] flex flex-col shadow-2xl">
        <div className="p-5 border-b border-gray-100 relative">
          <button 
            onClick={onClose}
            className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"
          >
            ✕
          </button>
          <h3 className="text-xl font-bold text-gray-800 text-center">
            {t('parent.admin_redeem_title') || '选择兑换成员'}
          </h3>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {/* 奖励信息卡片 */}
          <div className="bg-orange-50 rounded-2xl p-4 flex items-center gap-4 mb-6 border border-orange-100">
            <span className="text-4xl">{reward.icon}</span>
            <div>
              <p className="font-bold text-gray-800">{reward.name}</p>
              <p className="text-orange-500 font-bold text-sm">-{reward.points} 积分</p>
            </div>
          </div>

          <p className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">
            将此奖励发给：
          </p>

          {fetching ? (
            <div className="text-center py-10 text-gray-400">加载成员中...</div>
          ) : (
            <div className="space-y-3">
              {/* 🌟 显式指定 (child: Child) 消除隐式 Any 报错 */}
              {childrenList.map((child: Child) => {
                const isSelected = selectedChildId === child.id;
                const canAfford = child.balance >= reward.points;

                return (
                  <button
                    key={child.id}
                    disabled={!canAfford}
                    onClick={() => setSelectedChildId(child.id)}
                    className={`w-full p-4 rounded-2xl flex items-center gap-4 border-2 text-left transition-all ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50' 
                        : canAfford 
                          ? 'border-gray-100 bg-white hover:border-blue-200' 
                          : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <span className="text-3xl bg-white w-12 h-12 flex items-center justify-center rounded-xl shadow-sm">
                      {child.avatar}
                    </span>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800 text-lg">{child.name}</p>
                      <p className={`text-sm ${canAfford ? 'text-gray-500' : 'text-red-400'}`}>
                        当前余额: {child.balance}
                        {!canAfford && ' (不足)'}
                      </p>
                    </div>
                    {/* 选中状态指示器 */}
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                    }`}>
                      {isSelected && <span className="text-white text-xs">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部悬浮操作区 */}
        <div className="p-5 border-t border-gray-100 bg-white">
          <button
            onClick={handleSubmit}
            disabled={!selectedChildId || loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-95 text-lg"
          >
            {loading ? '处理中...' : '确认兑换'}
          </button>
        </div>
      </div>
    </>
  );
}