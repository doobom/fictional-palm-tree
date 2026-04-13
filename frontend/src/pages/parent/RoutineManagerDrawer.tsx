// frontend/src/pages/parent/RoutineManagerDrawer.tsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CalendarClock, Plus, Trash2, Edit2 } from 'lucide-react';
import service, { ApiResponse } from '../../api/request';
import { useUserStore } from '../../store';
import { appToast } from '../../utils/toast';

const WEEKDAYS = [
  { label: '一', value: 1 }, { label: '二', value: 2 }, { label: '三', value: 3 },
  { label: '四', value: 4 }, { label: '五', value: 5 }, { label: '六', value: 6 }, { label: '日', value: 0 }
];

export default function RoutineManagerDrawer({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { childrenList } = useUserStore();
  const [routines, setRoutines] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: '', childId: '', name: '', points: 5, emoji: '📖', frequency: 'daily', repeatDays: [1,2,3,4,5], autoApprove: true });

  useEffect(() => { if (isOpen) fetchRoutines(); }, [isOpen]);

  const fetchRoutines = async () => {
    const res = await service.get<any, ApiResponse>('/routines');
    if (res.success) setRoutines(res.data.routines);
  };

  const handleEdit = (r: any) => {
    setForm({
      id: r.id, childId: r.child_id || '', name: r.name, points: r.points, emoji: r.emoji,
      frequency: r.frequency, repeatDays: JSON.parse(r.repeat_days || '[]'), autoApprove: !!r.auto_approve
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定要删除吗？历史打卡记录将保留。')) return;
    await service.delete(`/routines/manage/${id}`);
    appToast.success('已删除');
    fetchRoutines();
  };

  const handleSubmit = async () => {
    if (!form.name) return appToast.error('请输入任务名称');
    if (form.frequency === 'weekly' && form.repeatDays.length === 0) return appToast.error('请至少选择一天');
    
    await service.post('/routines/manage/upsert', form);
    setShowForm(false);
    appToast.success('保存成功！');
    fetchRoutines();
  };

  const toggleDay = (dayVal: number) => {
    setForm(prev => ({
      ...prev,
      repeatDays: prev.repeatDays.includes(dayVal) ? prev.repeatDays.filter(d => d !== dayVal) : [...prev.repeatDays, dayVal]
    }));
  };

  if (!isOpen) return null;

  /*
  return createPortal(
    <div className={`fixed inset-0 z-[9999] flex flex-col justify-end ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/40 dark:bg-black/60 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      
      <div className={`absolute inset-x-0 bottom-0 bg-gray-50 dark:bg-gray-900 shadow-2xl pb-safe rounded-t-[24px] transition-all duration-300 transform ${isOpen ? 'translate-y-0' : 'translate-y-full'} flex flex-col max-h-[85vh]`}>
        
        <div className="w-full flex justify-center py-3"><div className="w-10 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" /></div>
        
        <div className="px-5 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3 transition-colors">
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <CalendarClock size={22} className="text-blue-500" />
            <h3 className="text-lg font-bold">常规任务管理</h3>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full text-gray-500 active:scale-95 transition-colors"><X size={18} /></button>
        </div>*/

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-t-[32px] p-5 pb-safe max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2"><CalendarClock className="text-blue-500"/><h3 className="text-xl font-black dark:text-white">常规任务管理</h3></div>
          <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500"><X size={20}/></button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pb-10">
          {!showForm ? (
             <button onClick={() => {
               setForm({ id: '', childId: '', name: '', points: 5, emoji: '📖', frequency: 'daily', repeatDays: [1,2,3,4,5], autoApprove: true });
               setShowForm(true);
             }} className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl flex items-center justify-center gap-2 text-gray-500 font-bold"><Plus size={20}/> 添加新任务</button>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl space-y-4 border border-blue-100 dark:border-gray-700 shadow-inner">
               <div className="flex justify-between items-center">
                 <span className="font-bold text-gray-700 dark:text-gray-300">{form.id ? '编辑任务' : '新建任务'}</span>
                 <span onClick={() => setShowForm(false)} className="text-sm text-gray-400 cursor-pointer">取消</span>
               </div>
               
               <div className="flex gap-2">
                 <input type="text" value={form.emoji} onChange={e => setForm({...form, emoji: e.target.value})} className="w-12 text-center p-3 rounded-xl dark:bg-gray-700 dark:text-white outline-none" placeholder="✅" />
                 <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="任务名称 (如: 洗碗)" className="flex-1 p-3 rounded-xl dark:bg-gray-700 dark:text-white outline-none font-bold" />
               </div>

               <div className="flex gap-2">
                 <input type="number" value={form.points} onChange={e => setForm({...form, points: Number(e.target.value)})} placeholder="积分" className="flex-1 p-3 rounded-xl dark:bg-gray-700 dark:text-white outline-none" />
                 <select value={form.childId} onChange={e => setForm({...form, childId: e.target.value})} className="flex-1 p-3 rounded-xl dark:bg-gray-700 dark:text-white outline-none text-sm">
                    <option value="">全家通用</option>
                    {childrenList.map(c => <option key={c.id} value={c.id}>{c.name}专属</option>)}
                 </select>
               </div>

               {/* 🌟 周期设置区 */}
               <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                 <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-xl">
                    <button onClick={() => setForm({...form, frequency: 'daily'})} className={`flex-1 py-1.5 text-sm font-bold rounded-lg ${form.frequency === 'daily' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600' : 'text-gray-500'}`}>每天重复</button>
                    <button onClick={() => setForm({...form, frequency: 'weekly'})} className={`flex-1 py-1.5 text-sm font-bold rounded-lg ${form.frequency === 'weekly' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600' : 'text-gray-500'}`}>指定星期</button>
                 </div>
                 {form.frequency === 'weekly' && (
                   <div className="flex justify-between px-1">
                     {WEEKDAYS.map(day => (
                       <button key={day.value} onClick={() => toggleDay(day.value)} className={`w-8 h-8 rounded-full text-xs font-black transition-all ${form.repeatDays.includes(day.value) ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-200 dark:bg-gray-600 text-gray-500'}`}>{day.label}</button>
                     ))}
                   </div>
                 )}
               </div>

               <label className="flex items-center gap-2 pt-2 text-sm font-bold text-gray-600 dark:text-gray-300">
                 <input type="checkbox" checked={form.autoApprove} onChange={e => setForm({...form, autoApprove: e.target.checked})} className="w-5 h-5 accent-blue-500" />
                 打卡后免审批，自动发放积分
               </label>
               <button onClick={handleSubmit} className="w-full py-3 mt-2 bg-blue-600 text-white font-black rounded-xl active:scale-95 transition-all">保存发布</button>
            </div>
          )}

          {/* 任务列表 */}
          {!showForm && routines.map(r => (
            <div key={r.id} className="p-4 border border-gray-100 dark:border-gray-700 rounded-2xl flex justify-between items-center bg-white dark:bg-gray-800 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{r.emoji}</span>
                <div>
                   <h4 className="font-bold dark:text-white">{r.name} <span className="text-blue-500">+{r.points}</span></h4>
                   <p className="text-xs text-gray-500 mt-1 flex gap-2">
                     <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{r.child_id ? '专属' : '全家'}</span>
                     <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{r.auto_approve ? '免审批' : '需审核'}</span>
                     <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-500 px-2 py-0.5 rounded">{r.frequency === 'daily' ? '每天' : '部分星期'}</span>
                   </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleEdit(r)} className="p-2 text-gray-400 hover:text-blue-500 bg-gray-50 dark:bg-gray-700 rounded-xl"><Edit2 size={16}/></button>
                <button onClick={() => handleDelete(r.id)} className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-gray-700 rounded-xl"><Trash2 size={16}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}