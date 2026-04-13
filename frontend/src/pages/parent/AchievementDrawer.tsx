// frontend/src/pages/parent/AchievementDrawer.tsx
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trophy, Send, Plus } from 'lucide-react';
import AchievementWall from '../../components/AchievementWall';
import service from '../../api/request';
import { appToast } from '../../utils/toast';

export default function AchievementDrawer({ isOpen, onClose, child, onSuccess }: any) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', emoji: '🎉' });
  const [loading, setLoading] = useState(false);

  if (!isOpen || !child) return null;

  const handleIssue = async () => {
    if (!form.name.trim()) return appToast.error('请输入勋章名称');
    setLoading(true);
    try {
      await service.post('/achievements/manual-issue', {
        childId: child.id,
        ...form
      });
      appToast.success('勋章颁发成功！');
      setShowForm(false);
      setForm({ name: '', emoji: '🎉' });
      if (onSuccess) onSuccess(); // 刷新成就墙和首页状态
    } catch (e) {
      appToast.error('颁发失败');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className={`fixed inset-0 z-[9999] flex flex-col justify-end ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/40 dark:bg-black/60 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      
      <div className={`absolute inset-x-0 bottom-0 bg-gray-50 dark:bg-gray-900 shadow-2xl pb-safe rounded-t-[24px] transition-all duration-300 transform ${isOpen ? 'translate-y-0' : 'translate-y-full'} flex flex-col max-h-[85vh]`}>
        
        <div className="w-full flex justify-center py-3"><div className="w-10 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" /></div>
        
        <div className="px-5 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3 transition-colors">
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Trophy size={22} className="text-yellow-500" />
            <h3 className="text-lg font-bold">{child.name} 的成就墙</h3>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full text-gray-500 active:scale-95 transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 overscroll-contain">
          {/* 手动颁发入口 */}
          {!showForm ? (
            <button 
              onClick={() => setShowForm(true)}
              className="w-full py-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 font-bold hover:bg-white dark:hover:bg-gray-800 transition-all"
            >
              <Plus size={20} /> 颁发特别表现奖
            </button>
          ) : (
            <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-blue-100 dark:border-blue-900/30 space-y-4 shadow-sm animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-blue-600 dark:text-blue-400 text-sm">自定义新勋章</h4>
                <button onClick={() => setShowForm(false)} className="text-gray-400 text-xs font-bold underline">取消</button>
              </div>
              <div className="flex gap-3">
                <input 
                  type="text" 
                  value={form.emoji}
                  onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                  className="w-14 h-12 text-center text-2xl bg-gray-50 dark:bg-gray-700 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="🚀"
                />
                <input 
                  type="text" 
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="flex-1 px-4 h-12 bg-gray-50 dark:bg-gray-700 rounded-xl border-none font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="例如：进步神速奖"
                />
              </div>
              <button 
                onClick={handleIssue}
                disabled={loading}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-blue-200 dark:shadow-none"
              >
                {loading ? '颁发中...' : <><Send size={18} /> 确认颁发</>}
              </button>
            </div>
          )}

          {/* 成就墙内容 */}
          <AchievementWall childId={child.id} />
        </div>
      </div>
    </div>,
    document.body
  );
}