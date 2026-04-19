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
  initialAction?: 'add' | 'deduct'; // 🌟 新增：接收外部传来的初始操作类型
  prefillRule?: any; // 🌟 新增：接收预填充规则
}

export default function ScoreActionDrawer({ isOpen, onClose, onSuccess, child, initialAction = 'add', prefillRule }: ScoreActionDrawerProps) {
  const { t } = useTranslation();
  const { updateScoreLocal, families, currentFamilyId } = useUserStore();
  const currentFamily = families.find(f => f.id === currentFamilyId);

  const [actionType, setActionType] = useState<'add' | 'deduct'>(initialAction);
  const [points, setPoints] = useState<number | ''>('');
  const [remark, setRemark] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<any[]>([]);
  const [ruleId, setRuleId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && child) {
      document.body.style.overflow = 'hidden';

      // 🌟 自动填充逻辑
      if (prefillRule) {
        setActionType(prefillRule.points > 0 ? 'add' : 'deduct');
        setPoints(Math.abs(prefillRule.points));
        setRemark(prefillRule.name);
        setRuleId(prefillRule.id); // 绑定规则ID，这样发分后可以统计到今天用了几次
      } else {
        setActionType(initialAction);
        setPoints('');
        setRemark('');
        setRuleId(null);
      }

      service.get<any, ApiResponse>(`/rules?childId=${child.id}`).then(res => {
        if (res.success && res.data) {
          setRules(res.data);
        }
      }).catch(() => {});
      
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, child, prefillRule, initialAction]); // 🌟 依赖项加上 prefillRule

  const handleSubmit = async () => {
    if (!child) return;
    const numPoints = Number(points);
    if (!numPoints || numPoints <= 0) return appToast.warn('请输入有效的分数');

    setLoading(true);
    try {
      const finalPoints = actionType === 'add' ? numPoints : -Math.abs(numPoints);
      const res = await service.post<any, ApiResponse>('/scores/adjust', {
        childId: child.id, points: finalPoints, remark: remark || (actionType === 'add' ? '手动奖励' : '手动扣除'), ruleId: ruleId
      });
      if (res.success) {
        appToast.success(`已为 ${child.name} ${actionType === 'add' ? '增加' : '扣除'} ${numPoints} 分`);
        setPoints('');
        setRemark('');
        setRuleId(null);
        updateScoreLocal(child.id, finalPoints);
        onSuccess?.(); onClose();
      }
    } finally { setLoading(false); }
  };

  const avatar = child?.avatar || '👦';
  const name = child?.name || '';
  const balance = child?.balance || 0;

  const displayRules = rules.filter(r => actionType === 'add' ? r.points > 0 : r.points < 0);

  const drawerContent = (
    <div className={`fixed inset-0 z-[9999] ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/40 dark:bg-black/60 transition-opacity duration-300 ease-out ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      
      <div className={`absolute inset-x-0 bottom-0 bg-white dark:bg-gray-900 rounded-t-[24px] flex flex-col transform transition-transform duration-300 ease-out max-h-[90vh] ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        
        <div className="w-full flex justify-center pt-3 pb-2">
          <div className="w-10 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>

        <div className="px-5 pb-4 relative flex items-center gap-4 transition-colors">
          <button onClick={onClose} className="absolute right-5 top-0 w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400 font-bold transition-colors">✕</button>
          <span className="text-4xl bg-gray-100 dark:bg-gray-800 w-14 h-14 flex items-center justify-center rounded-2xl transition-colors">{avatar}</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 transition-colors">调整 {name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors">余额: <span className="font-semibold text-gray-900 dark:text-gray-100">{balance}</span> {currentFamily?.point_name}</p>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl transition-colors">
            <button onClick={() => { setActionType('add'); setPoints(''); setRemark(''); }} className={`flex-1 py-2.5 font-semibold rounded-lg transition-colors ${actionType === 'add' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>奖励</button>
            <button onClick={() => { setActionType('deduct'); setPoints(''); setRemark(''); }} className={`flex-1 py-2.5 font-semibold rounded-lg transition-colors ${actionType === 'deduct' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>扣除</button>
          </div>

          {displayRules.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">选择家庭规则</label>
              <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                {displayRules.map(rule => {
                  // 🌟 计算逻辑
                  const limit = rule.daily_limit || 0;
                  const used = rule.today_usage || 0;
                  const remaining = limit > 0 ? limit - used : -1; // -1 表示无限
                  const isExceeded = limit > 0 && remaining <= 0;

                  return (
                    <button
                      key={rule.id}
                      disabled={isExceeded} // 🌟 核心：超限禁用
                      onClick={() => {
                        setPoints(Math.abs(rule.points));
                        setRemark(rule.name);
                        setRuleId(rule.id);
                      }}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all active:scale-95 ${
                        isExceeded 
                          ? 'bg-gray-100 dark:bg-gray-800 border-transparent opacity-50 grayscale' 
                          : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:bg-blue-50'
                      }`}
                    >
                      <span>{rule.emoji}</span>
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{rule.name}</span>
                        {/* 🌟 显示剩余次数标签 */}
                        {limit > 0 && (
                          <span className={`text-[10px] font-black ${isExceeded ? 'text-red-500' : 'text-blue-500'}`}>
                            {isExceeded ? '已达上限' : `剩 ${remaining} 次`}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">快捷选择</label>
            <div className="flex gap-2">
              {[1, 2, 5, 10].map(val => (
                <button key={val} onClick={() => setPoints(val)} className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${points === val ? (actionType === 'add' ? 'bg-blue-500 dark:bg-blue-600 text-white' : 'bg-red-500 dark:bg-red-600 text-white') : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>{val}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">输入额度与备注</label>
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 p-1 pl-4 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white dark:focus-within:bg-gray-700 transition-colors">
                <span className="text-xl">{currentFamily?.point_emoji || '🪙'}</span>
                <input type="number" value={points} onChange={(e) => setPoints(parseInt(e.target.value) || '')} className="flex-1 bg-transparent py-3 font-semibold text-gray-900 dark:text-white outline-none placeholder-gray-400 dark:placeholder-gray-500" placeholder="自定义数值" />
              </div>
              <input type="text" value={remark} onChange={(e) => { setRemark(e.target.value); setRuleId(null); }} className="w-full bg-gray-100 dark:bg-gray-800 p-4 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-700 font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors" placeholder="原因备注 (选填)" />
            </div>
          </div>
        </div>

        <div className="p-5 pt-2 bg-white dark:bg-gray-900 transition-colors" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 20px)' }}>
          <button onClick={handleSubmit} disabled={loading || !points || Number(points) <= 0} className={`w-full py-3.5 rounded-xl font-semibold text-white text-lg transition-colors ${actionType === 'add' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'} disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600`}>
            {loading ? '处理中...' : `确认${actionType === 'add' ? '发放' : '扣除'}`}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}