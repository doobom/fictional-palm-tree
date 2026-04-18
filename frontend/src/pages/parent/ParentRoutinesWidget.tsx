// frontend/src/pages/parent/ParentRoutinesWidget.tsx
import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, CalendarClock, Loader2 } from 'lucide-react';
import service, { ApiResponse } from '../../api/request';
import { useUserStore } from '../../store';
import { appToast } from '../../utils/toast';

export default function ParentRoutinesWidget() {
  const [loading, setLoading] = useState(true);

  // 🌟 引入 routineLogs，去掉本地的 [logs, setLogs]
  //const { childrenList, routinesList, routineLogs, fetchRoutinesAction, currentFamilyId } = useUserStore();
  const { childrenList, setChildrenList, routinesList, routineLogs, fetchRoutinesAction, currentFamilyId } = useUserStore();
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const todayStr = new Date().toLocaleDateString('en-CA');
  const todayDayOfWeek = new Date().getDay();

  const routines = routinesList.filter((r: any) => {
    if (r.frequency === 'daily') return true;
    try { return JSON.parse(r.repeat_days || '[]').includes(todayDayOfWeek); } catch { return false; }
  });

  useEffect(() => {
    if (currentFamilyId) {
      setLoading(true); // 开始拉取前设置为 loading
      // 🌟 修复：拉取完成后，关闭 loading 状态
      fetchRoutinesAction(currentFamilyId).finally(() => {
        setLoading(false);
      });
    }
  }, [currentFamilyId, fetchRoutinesAction]);

  const handleAdminCheckin = async (routineId: string, childId: string, childName: string) => {
    setCheckingId(`${routineId}-${childId}`);
    try {
      const res = await service.post<any, ApiResponse>('/routines/admin-checkin', { routineId, childId, dateStr: todayStr });
      if (res.success) {
        appToast.success(`已帮 ${childName} 完成打卡！`);
        // 1. 刷新习惯打卡板的 UI 状态 (变绿)
        await fetchRoutinesAction(currentFamilyId!);
        
        // 🌟 2. 新增：重新拉取孩子列表，实时刷新首页顶部的积分卡片！
        const childRes = await service.get<any, ApiResponse>('/children');
        if (childRes.success || childRes.data) {
          setChildrenList(childRes.data || childRes);
        }
      }
    } catch (e) {} finally { setCheckingId(null); }
  };

  if (loading) return <div className="animate-pulse h-24 bg-white dark:bg-gray-800 rounded-3xl" />;
  if (routines.length === 0 || childrenList.length === 0) return null;

  return (
    <section className="bg-white dark:bg-gray-800 rounded-[32px] p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="text-blue-500" size={20} />
          <h2 className="text-lg font-black text-gray-900 dark:text-white">今日习惯打卡板</h2>
        </div>
        <span className="text-xs font-bold text-gray-400">家长代签</span>
      </div>

      <div className="space-y-4">
        {routines.map(routine => (
          <div key={routine.id} className="pt-2 border-t border-gray-100 dark:border-gray-700 first:border-0 first:pt-0">
            <div className="flex items-center gap-2 mb-2">
               <span className="text-lg">{routine.emoji}</span>
               <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{routine.name}</span>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {childrenList
                .filter(c => !routine.child_id || routine.child_id === c.id) // 过滤该任务的适用人员
                .map(child => {
                  const log = routineLogs.find(l => l.routine_id === routine.id && l.child_id === child.id);
                  const isDone = log?.status === 'completed';
                  const isPending = log?.status === 'pending';
                  const isWorking = checkingId === `${routine.id}-${child.id}`;

                  return (
                    <button 
                      key={child.id}
                      onClick={() => !isDone && !isWorking && handleAdminCheckin(routine.id, child.id, child.name)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                        isDone 
                          ? 'border-green-200 bg-green-50 text-green-600 dark:bg-green-900/20 dark:border-green-800' 
                          : isPending 
                            ? 'border-orange-200 bg-orange-50 text-orange-600 dark:bg-orange-900/20'
                            : 'border-gray-200 bg-white text-gray-500 hover:border-blue-300 dark:bg-gray-700 dark:border-gray-600'
                      }`}
                    >
                      <span className="text-xs">{child.avatar} {child.name}</span>
                      {isWorking ? <Loader2 size={14} className="animate-spin" /> 
                       : isDone ? <CheckCircle2 size={14} /> 
                       : <Circle size={14} className={isPending ? 'text-orange-400' : 'text-gray-300'} />}
                    </button>
                  );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}