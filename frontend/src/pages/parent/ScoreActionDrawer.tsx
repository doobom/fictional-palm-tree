// frontend/src/pages/parent/ScoreActionDrawer.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserStore, Child } from '../../store';
import service, { ApiResponse } from '../../api/request';
import { appToast } from '../../utils/toast';

export interface ScoreActionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  child: Child | null;
}

export default function ScoreActionDrawer({ isOpen, onClose, onSuccess, child }: ScoreActionDrawerProps) {
  const { t } = useTranslation();
  const { updateScoreLocal, families, currentFamilyId } = useUserStore();
  const currentFamily = families.find(f => f.id === currentFamilyId);

  const [actionType, setActionType] = useState<'add' | 'deduct'>('add');
  const [points, setPoints] = useState<number | ''>('');
  const [remark, setRemark] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActionType('add');
      setPoints('');
      setRemark('');
    }
  }, [isOpen, child]);

  const quickPoints = actionType === 'add' ? [1, 2, 5, 10] : [1, 5, 10, 20];

  const handleSubmit = async () => {
    if (!child) return;
    const numPoints = Number(points);
    if (!numPoints || numPoints <= 0) {
      appToast.warn('请输入有效的分数');
      return;
    }

    setLoading(true);
    try {
      const finalPoints = actionType === 'add' ? numPoints : -Math.abs(numPoints);
      const res = await service.post<any, ApiResponse>('/scores/adjust', {
        childId: child.id,
        points: finalPoints,
        remark: remark || (actionType === 'add' ? '手动奖励' : '手动扣除')
      });

      if (res.success) {
        appToast.success(`已为 ${child.name} ${actionType === 'add' ? '增加' : '扣除'} ${numPoints} 分`);
        updateScoreLocal(child.id, finalPoints);
        onSuccess?.();
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !child) return null;

  return (
    <>
      {/* 🌟 独立遮罩层，z-[100] 保证绝对盖住底部导航栏 */}
      <div 
        className="fixed inset-0 bg-black/40 z-[100] transition-opacity"
        onClick={onClose}
      />
      
      {/* 🌟 抽屉主体，结构与 AddRewardDrawer 完全一致 */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-50 rounded-t-[2rem] z-[101] transform transition-transform duration-300 max-h-[90vh] flex flex-col shadow-2xl pb-safe">
        
        {/* 顶部指示条 & 关闭按钮 */}
        <div className="bg-white rounded-t-[2rem] px-5 pt-3 pb-5 relative border-b border-gray-100">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />
          <button onClick={onClose} className="absolute right-5 top-5 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 font-bold active:scale-95">✕</button>
          
          <div className="flex flex-col items-center">
            <span className="text-4xl bg-gray-50 w-16 h-16 flex items-center justify-center rounded-2xl mb-2 shadow-sm border border-gray-100">
              {child.avatar}
            </span>
            <h3 className="text-xl font-bold text-gray-800">调整 {child.name} 的积分</h3>
            <p className="text-sm text-gray-500 mt-1">
              余额: <strong className="text-gray-800">{child.balance}</strong> {currentFamily?.point_name}
            </p>
          </div>
        </div>

        {/* 表单内容区 */}
        <div className="p-5 overflow-y-auto flex-1 space-y-6">
          <div className="flex bg-gray-200/50 p-1 rounded-xl">
            <button onClick={() => { setActionType('add'); setPoints(''); }} className={`flex-1 py-3 font-bold rounded-lg transition-all ${actionType === 'add' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>➕ 奖励</button>
            <button onClick={() => { setActionType('deduct'); setPoints(''); }} className={`flex-1 py-3 font-bold rounded-lg transition-all ${actionType === 'deduct' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-500'}`}>➖ 扣除</button>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">快捷选择</label>
              <div className="flex gap-2">
                {quickPoints.map(val => (
                  <button key={val} onClick={() => setPoints(val)} className={`flex-1 py-3 rounded-xl font-bold border-2 transition-all active:scale-95 ${points === val ? (actionType === 'add' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-red-500 bg-red-50 text-red-600') : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200'}`}>{val}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">输入额度</label>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{currentFamily?.point_emoji || '🪙'}</span>
                <input type="number" min="1" value={points} onChange={(e) => setPoints(parseInt(e.target.value) || '')} className="flex-1 bg-gray-50 p-4 rounded-xl font-bold text-lg text-gray-800 border-none focus:ring-2 focus:ring-blue-100" placeholder="自定义数值" />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">原因备注</label>
              <input type="text" value={remark} onChange={(e) => setRemark(e.target.value)} className="w-full bg-gray-50 p-4 rounded-xl border-none focus:ring-2 focus:ring-blue-100 font-medium" placeholder={actionType === 'add' ? '例如：主动洗碗' : '例如：没有按时完成作业'} />
            </div>
          </div>
        </div>

        {/* 底部确认按钮 */}
        <div className="p-5 bg-white border-t border-gray-100">
          <button onClick={handleSubmit} disabled={loading || !points || Number(points) <= 0} className={`w-full py-4 rounded-xl font-bold text-white text-lg transition-all active:scale-95 ${actionType === 'add' ? 'bg-blue-600 shadow-lg shadow-blue-200' : 'bg-red-500 shadow-lg shadow-red-200'} disabled:bg-gray-300 disabled:shadow-none`}>
            {loading ? '处理中...' : `确认${actionType === 'add' ? '发放' : '扣除'}`}
          </button>
        </div>
      </div>
    </>
  );
}