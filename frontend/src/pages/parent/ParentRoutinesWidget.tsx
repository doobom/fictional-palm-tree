// frontend/src/pages/parent/ParentRoutinesWidget.tsx
import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, CalendarClock, Loader2 } from 'lucide-react';
import service, { ApiResponse } from '../../api/request';
import { useUserStore } from '../../store';
import { appToast } from '../../utils/toast';

export default function ParentRoutinesWidget() {
  const { childrenList } = useUserStore();
  const [routines, setRoutines] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const todayStr = new Date().toLocaleDateString('en-CA');
  const todayDayOfWeek = new Date().getDay();

  useEffect(() => { fetchTodayData(); }, []);

  const fetchTodayData = async () => {
    setLoading(true);
    try {
      // 不传 childId，拉取全家今日数据
      const res = await service.get<any, ApiResponse>(`/routines?dateStr=${todayStr}`);
      if (res.success) {
        // 过滤出今天应该执行的任务
        const todayRoutines = res.data.routines.filter((r: any) => {
          if (r.frequency === 'daily') return true;
          try { return JSON.parse(r.repeat_days || '[]').includes(todayDayOfWeek); } catch { return false; }
        });
        setRoutines(todayRoutines);
        setLogs(res.data.logs || []);
      }
    } catch (e) {} finally { setLoading(false); }
  };

  const handleAdminCheckin = async (routineId: string, childId: string, childName: string) => {
    setCheckingId(`${routineId}-${childId}`);
    try {
      const res = await service.post<any, ApiResponse>('/routines/admin-checkin', { routineId, childId, dateStr: todayStr });
      if (res.success) {
        appToast.success(`已帮 ${childName} 完成打卡！`);
        fetchTodayData(); // 刷新看板
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
                  const log = logs.find(l => l.routine_id === routine.id && l.child_id === child.id);
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