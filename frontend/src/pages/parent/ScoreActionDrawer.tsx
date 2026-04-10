// frontend/src/pages/parent/ScoreActionDrawer.tsx
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  
  // 🌟 新增：存储从后端获取的规则列表
  const [rules, setRules] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      setActionType('add'); setPoints(''); setRemark('');
      document.body.style.overflow = 'hidden';

      // 🌟 请求后端的规则/任务列表
      service.get<any, ApiResponse>('/goals').then(res => {
        if (res.success && res.data) {
          setRules(res.data);
        }
      }).catch(() => {});
      
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!child) return;
    const numPoints = Number(points);
    if (!numPoints || numPoints <= 0) return appToast.warn('请输入有效的分数');

    setLoading(true);
    try {
      const finalPoints = actionType === 'add' ? numPoints : -Math.abs(numPoints);
      const res = await service.post<any, ApiResponse>('/scores/adjust', {
        childId: child.id, points: finalPoints, remark: remark || (actionType === 'add' ? '手动奖励' : '手动扣除')
      });
      if (res.success) {
        appToast.success(`已为 ${child.name} ${actionType === 'add' ? '增加' : '扣除'} ${numPoints} 分`);
        updateScoreLocal(child.id, finalPoints);
        onSuccess?.(); onClose();
      }
    } finally { setLoading(false); }
  };

  const avatar = child?.avatar || '👦';
  const name = child?.name || '';
  const balance = child?.balance || 0;

  // 根据当前动作 (加/减) 过滤显示的规则
  const displayRules = rules.filter(r => 
    actionType === 'add' ? r.points > 0 : r.points < 0
  );

  const drawerContent = (
    <div className={`fixed inset-0 z-[9999] ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      
      <div className={`absolute inset-x-0 bottom-0 bg-white rounded-t-[24px] flex flex-col transform transition-transform duration-300 ease-out max-h-[90vh] ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        
        <div className="w-full flex justify-center pt-3 pb-2">
          <div className="w-10 h-1.5 bg-gray-200 rounded-full" />
        </div>

        <div className="px-5 pb-4 relative flex items-center gap-4">
          <button onClick={onClose} className="absolute right-5 top-0 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 font-bold">✕</button>
          <span className="text-4xl bg-gray-100 w-14 h-14 flex items-center justify-center rounded-2xl">{avatar}</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">调整 {name}</h3>
            <p className="text-sm text-gray-500">余额: <span className="font-semibold text-gray-900">{balance}</span> {currentFamily?.point_name}</p>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={() => { setActionType('add'); setPoints(''); setRemark(''); }} className={`flex-1 py-2.5 font-semibold rounded-lg transition-colors ${actionType === 'add' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>奖励</button>
            <button onClick={() => { setActionType('deduct'); setPoints(''); setRemark(''); }} className={`flex-1 py-2.5 font-semibold rounded-lg transition-colors ${actionType === 'deduct' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>扣除</button>
          </div>

          {/* 🌟 新增：动态渲染规则列表 (横向滚动) */}
          {displayRules.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">选择家庭规则</label>
              <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                {displayRules.map(rule => (
                  <button
                    key={rule.id}
                    onClick={() => {
                      setPoints(Math.abs(rule.points));
                      setRemark(rule.name);
                    }}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-100 hover:bg-blue-50 hover:border-blue-200 rounded-xl transition-all active:scale-95"
                  >
                    <span>{rule.emoji || (actionType === 'add' ? '⭐' : '⚠️')}</span>
                    <span className="text-sm font-medium text-gray-700">{rule.name}</span>
                    <span className={`text-xs font-bold ${actionType === 'add' ? 'text-blue-500' : 'text-red-500'}`}>
                      {actionType === 'add' ? '+' : '-'}{Math.abs(rule.points)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">快捷选择</label>
            <div className="flex gap-2">
              {[1, 2, 5, 10].map(val => (
                <button key={val} onClick={() => setPoints(val)} className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${points === val ? (actionType === 'add' ? 'bg-blue-500 text-white' : 'bg-red-500 text-white') : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{val}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">输入额度与备注</label>
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-gray-100 p-1 pl-4 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white transition-colors">
                <span className="text-xl">{currentFamily?.point_emoji || '🪙'}</span>
                <input type="number" value={points} onChange={(e) => setPoints(parseInt(e.target.value) || '')} className="flex-1 bg-transparent py-3 font-semibold text-gray-900 outline-none" placeholder="自定义数值" />
              </div>
              <input type="text" value={remark} onChange={(e) => setRemark(e.target.value)} className="w-full bg-gray-100 p-4 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium transition-colors" placeholder="原因备注 (选填)" />
            </div>
          </div>
        </div>

        <div className="p-5 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 20px)' }}>
          <button onClick={handleSubmit} disabled={loading || !points || Number(points) <= 0} className={`w-full py-3.5 rounded-xl font-semibold text-white text-lg transition-colors ${actionType === 'add' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'} disabled:bg-gray-200 disabled:text-gray-400`}>
            {loading ? '处理中...' : `确认${actionType === 'add' ? '发放' : '扣除'}`}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}