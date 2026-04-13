// frontend/src/pages/parent/GoalManagerDrawer.tsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Target, Play, Pause, Gift, Plus, Loader2 } from 'lucide-react';
import service, { ApiResponse } from '../../api/request';
import { appToast } from '../../utils/toast';

export default function GoalManagerDrawer({ isOpen, onClose, child, onSuccess }: any) {
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', target_points: 100, emoji: '🚲' });

  // 🌟 核心修复 2：增加对 child.balance 的监听
  // 当 SSE 更新了全局 Store 里的余额时，这里会自动触发刷新，实现进度条“实时”变动
  useEffect(() => {
    if (isOpen && child?.id) {
      fetchGoals();
    }
  }, [isOpen, child?.id, child?.balance]); 

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const res = await service.get<any, ApiResponse>(`/goals?childId=${child.id}`);
      if (res.success) setGoals(res.data);
    } catch (e) {
      console.error("Fetch goals failed", e);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (goalId: string) => {
    try {
      await service.put('/goals/activate', { childId: child.id, goalId });
      fetchGoals();
    } catch (e) { appToast.error('切换失败'); }
  };

  const handleRedeem = async (goalId: string) => {
    if (!window.confirm('兑换将扣除对应积分，是否继续？')) return;
    try {
      await service.post('/goals/redeem', { childId: child.id, goalId });
      appToast.success('兑换成功，愿望达成！');
      fetchGoals();
      if (onSuccess) onSuccess(); 
    } catch (e) { appToast.error('兑换失败'); }
  };

  const handleCreate = async () => {
    if (!form.name.trim() || form.target_points <= 0) return appToast.error('信息不完整');
    try {
      await service.post('/goals', { childId: child.id, ...form });
      setShowForm(false);
      setForm({ name: '', target_points: 100, emoji: '🚲' });
      fetchGoals();
    } catch (e) { appToast.error('创建失败'); }
  };

  if (!isOpen || !child) return null;

  return createPortal(
    <div className={`fixed inset-0 z-[9999] flex flex-col justify-end ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/40 dark:bg-black/60 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      
      <div className={`absolute inset-x-0 bottom-0 bg-gray-50 dark:bg-gray-900 shadow-2xl pb-safe rounded-t-[24px] transition-all duration-300 transform ${isOpen ? 'translate-y-0' : 'translate-y-full'} flex flex-col max-h-[85vh]`}>
        
        <div className="w-full flex justify-center py-3"><div className="w-10 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" /></div>
        
        <div className="px-5 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3 transition-colors">
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Target size={22} className="text-blue-500" />
            <h3 className="text-lg font-bold">{child.name} 的愿望清单</h3>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full text-gray-500 active:scale-95 transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 创建目标表单 */}
          {!showForm ? (
            <button 
              onClick={() => setShowForm(true)} 
              className="w-full py-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl flex items-center justify-center gap-2 text-gray-500 font-bold hover:bg-white dark:hover:bg-gray-800 transition-all"
            >
              <Plus size={20} /> 添加新愿望
            </button>
          ) : (
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-900/30 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-gray-600 dark:text-gray-300">愿望详情</span>
                <span onClick={() => setShowForm(false)} className="text-gray-400 text-xs underline cursor-pointer">取消</span>
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={form.emoji} 
                  onChange={e => setForm({...form, emoji: e.target.value})} 
                  className="w-14 h-12 text-center text-2xl bg-gray-50 dark:bg-gray-700 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="🎁" 
                />
                <input 
                  type="text" 
                  value={form.name} 
                  onChange={e => setForm({...form, name: e.target.value})} 
                  className="flex-1 px-4 h-12 bg-gray-50 dark:bg-gray-700 rounded-xl border-none font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="愿望名称 (如：游乐园)" 
                />
              </div>
              <input 
                type="number" 
                value={form.target_points || ''} 
                onChange={e => setForm({...form, target_points: parseInt(e.target.value)})} 
                //className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-xl outline-none" 
                className="w-full px-4 h-12 bg-gray-50 dark:bg-gray-700 rounded-xl border-none font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="需要多少积分？" 
              />
              <button 
                onClick={handleCreate} 
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-blue-200 dark:shadow-none"
              >保存愿望</button>
            </div>
          )}

          {/* 目标列表 */}
          {loading && goals.length === 0 ? (
            <div className="py-10 flex flex-col items-center justify-center text-gray-400 gap-2">
              <Loader2 className="animate-spin" />
              <span className="text-sm font-bold">加载清单中...</span>
            </div>
          ) : goals.map(goal => {
            const percent = Math.min(100, Math.floor((goal.current_points / goal.target_points) * 100));
            const isActive = goal.status === 'active';
            const isCompleted = goal.status === 'completed';
            const isRedeemed = goal.status === 'redeemed';

            return (
              <div 
                key={goal.id} 
                className={`p-4 rounded-3xl border-2 transition-all ${
                  isActive 
                    ? 'bg-white dark:bg-gray-800 border-blue-400 dark:border-blue-500 shadow-md' 
                    : isCompleted 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-600' 
                    : 'bg-gray-50 dark:bg-gray-800/40 border-transparent opacity-70'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl bg-gray-100 dark:bg-gray-700 p-2 rounded-2xl">{goal.emoji}</span>
                    <div>
                      <h4 className="font-black text-gray-900 dark:text-white">{goal.name}</h4>
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{goal.current_points} / {goal.target_points} PTS</p>
                    </div>
                  </div>
                  
                  {/* 控制按钮区 */}
                  <div className="flex items-center gap-2">
                    {!isRedeemed && !isCompleted && (
                      <button 
                        onClick={() => handleActivate(goal.id)} 
                        className={`p-2 rounded-full transition-colors ${
                          isActive ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                        }`}
                      >
                        {isActive ? <Pause size={18} /> : <Play size={18} />}
                      </button>
                    )}
                    {isCompleted && (
                      <button 
                        onClick={() => handleRedeem(goal.id)} 
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-black text-xs rounded-xl shadow-sm flex items-center gap-1 active:scale-95 transition-all"
                      >
                        <Gift size={14} /> 立即兑换
                      </button>
                    )}
                    {isRedeemed && <span className="text-xs font-black text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-lg">已兑换</span>}
                  </div>
                </div>

                {/* 🌟 暗黑模式适配：进度条背景 */}
                <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-700 ease-out ${
                      isActive ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : isCompleted ? 'bg-green-500' : 'bg-gray-400'
                    }`} 
                    style={{ width: `${percent}%` }} 
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}