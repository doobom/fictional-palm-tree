// frontend/src/pages/parent/BatchActionDrawer.tsx
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUserStore, Child } from '../../store';
import service, { ApiResponse } from '../../api/request';
import { appToast } from '../../utils/toast';

export interface BatchActionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BatchActionDrawer({ isOpen, onClose }: BatchActionDrawerProps) {
  const { updateScoreLocal, childrenList, families, currentFamilyId } = useUserStore();
  const currentFamily = families.find(f => f.id === currentFamilyId);

  const [selectedChildIds, setSelectedChildIds] = useState<Set<string>>(new Set());
  const [actionType, setActionType] = useState<'add' | 'deduct'>('add');
  const [points, setPoints] = useState<number | ''>('');
  const [remark, setRemark] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedChildIds(new Set(childrenList.map((c: Child) => c.id)));
      setActionType('add'); setPoints(''); setRemark('');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, childrenList]);

  const toggleChild = (id: string) => {
    const newSet = new Set(selectedChildIds);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedChildIds(newSet);
  };

  const handleSubmit = async () => {
    const numPoints = Number(points);
    if (selectedChildIds.size === 0) return appToast.warn('请至少选择一个孩子');
    if (!numPoints || numPoints <= 0) return appToast.warn('请输入有效的分数');

    setLoading(true);
    try {
      const finalPoints = actionType === 'add' ? numPoints : -Math.abs(numPoints);
      const promises = Array.from(selectedChildIds).map(childId => 
        service.post<any, ApiResponse>('/scores/adjust', {
          childId, points: finalPoints, remark: remark || (actionType === 'add' ? '批量奖励' : '批量扣除')
        })
      );
      
      await Promise.all(promises);
      
      appToast.success(`已为 ${selectedChildIds.size} 个孩子完成${actionType === 'add' ? '发放' : '扣除'}`);
      Array.from(selectedChildIds).forEach(childId => updateScoreLocal(childId, finalPoints));
      onClose();
    } finally { setLoading(false); }
  };

  // 🌟 核心修复 4：移除 return null 让它长留 DOM 等待唤醒动画

  const drawerContent = (
    <div className={`fixed inset-0 z-[9999] ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      
      <div className={`absolute inset-x-0 bottom-0 bg-white rounded-t-[24px] flex flex-col transform transition-transform duration-300 ease-out max-h-[90vh] ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="w-full flex justify-center pt-3 pb-2"><div className="w-10 h-1.5 bg-gray-200 rounded-full" /></div>

        <div className="px-5 pb-2 relative">
          <button onClick={onClose} className="absolute right-5 top-0 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 font-bold">✕</button>
          <h3 className="text-xl font-semibold text-gray-900">批量调整积分</h3>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">选择应用对象</label>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {childrenList.map((child: Child) => {
                const isSelected = selectedChildIds.has(child.id);
                return (
                  <button key={child.id} onClick={() => toggleChild(child.id)} className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors shrink-0 ${isSelected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500'}`}>
                    <span>{child.avatar}</span>
                    <span className="font-semibold text-sm">{child.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={() => { setActionType('add'); setPoints(''); }} className={`flex-1 py-2.5 font-semibold rounded-lg transition-colors ${actionType === 'add' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>奖励</button>
            <button onClick={() => { setActionType('deduct'); setPoints(''); }} className={`flex-1 py-2.5 font-semibold rounded-lg transition-colors ${actionType === 'deduct' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>扣除</button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-gray-100 p-1 pl-4 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white transition-colors">
              <span className="text-xl">{currentFamily?.point_emoji || '🪙'}</span>
              <input type="number" min="1" value={points} onChange={(e) => setPoints(parseInt(e.target.value) || '')} className="flex-1 bg-transparent py-3 font-semibold text-gray-900 outline-none" placeholder="输入统一额度" />
            </div>
            <input type="text" value={remark} onChange={(e) => setRemark(e.target.value)} className="w-full bg-gray-100 p-4 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium transition-colors" placeholder="批量原因 (选填)" />
          </div>
        </div>

        <div className="p-5 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 20px)' }}>
          <button onClick={handleSubmit} disabled={loading || !points || Number(points) <= 0 || selectedChildIds.size === 0} className={`w-full py-3.5 rounded-xl font-semibold text-white text-lg transition-colors ${actionType === 'add' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'} disabled:bg-gray-200 disabled:text-gray-400`}>
            {loading ? '处理中...' : `确认批量${actionType === 'add' ? '发放' : '扣除'}`}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}