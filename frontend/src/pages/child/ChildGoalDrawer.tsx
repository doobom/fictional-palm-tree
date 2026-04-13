// frontend/src/pages/child/ChildGoalDrawer.tsx
import React, { useState, useEffect } from 'react';
import { X, Target, Plus, Play, Pause, Send } from 'lucide-react';
import service, { ApiResponse } from '../../api/request';
import { appToast } from '../../utils/toast';

export default function ChildGoalDrawer({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [goals, setGoals] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', target_points: 100, emoji: '🎁' });

  useEffect(() => {
    if (isOpen) fetchGoals();
  }, [isOpen]);

  const fetchGoals = async () => {
    const res = await service.get<any, ApiResponse>('/goals');
    if (res.success) setGoals(res.data);
  };

  const handleActivate = async (goalId: string) => {
    await service.put('/goals/activate', { goalId });
    fetchGoals();
  };

  const handleRequest = async (goalId: string) => {
    await service.post('/goals/request-redemption', { goalId });
    appToast.success('申请成功！请等待家长确认 🎁');
    fetchGoals();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-t-[32px] max-h-[85vh] flex flex-col p-5 pb-10 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Target className="text-blue-500" />
            <h3 className="text-xl font-black dark:text-white">我的心愿单</h3>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* 添加按钮 */}
          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl flex items-center justify-center gap-2 text-gray-500 font-bold">
              <Plus size={20} /> 许下一个新愿望
            </button>
          ) : (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-3xl space-y-4">
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="想要什么？" className="w-full p-3 rounded-xl dark:bg-gray-800 dark:text-white outline-none font-bold" />
              <input type="number" value={form.target_points} onChange={e => setForm({...form, target_points: parseInt(e.target.value)})} placeholder="需要多少分？" className="w-full p-3 rounded-xl dark:bg-gray-800 dark:text-white outline-none font-bold" />
              <button onClick={async () => {
                await service.post('/goals', form);
                setShowForm(false);
                fetchGoals();
              }} className="w-full py-3 bg-blue-600 text-white font-black rounded-xl shadow-lg shadow-blue-200">添加愿望</button>
            </div>
          )}

          {goals.map(goal => {
            const percent = Math.min(100, Math.floor((goal.current_points / goal.target_points) * 100));
            return (
              <div key={goal.id} className={`p-5 rounded-3xl border-2 transition-all ${goal.status === 'active' ? 'border-blue-400 bg-white dark:bg-gray-800 shadow-md' : 'border-transparent bg-gray-50 dark:bg-gray-800/40 opacity-80'}`}>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{goal.emoji}</span>
                    <div>
                      <h4 className="font-black dark:text-white">{goal.name}</h4>
                      <p className="text-xs font-bold text-gray-500">{goal.current_points} / {goal.target_points} PTS</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {goal.status === 'completed' && (
                      <button onClick={() => handleRequest(goal.id)} className="bg-green-500 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-green-200">申请兑换</button>
                    )}
                    {goal.status === 'pending' && <span className="text-orange-500 text-xs font-black bg-orange-50 px-3 py-1.5 rounded-xl">等待家长核准...</span>}
                    {goal.status === 'paused' && <button onClick={() => handleActivate(goal.id)} className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-500"><Play size={16} /></button>}
                  </div>
                </div>
                <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-700 ${goal.status === 'active' ? 'bg-blue-500' : 'bg-green-500'}`} style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}