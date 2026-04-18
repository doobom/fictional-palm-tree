// frontend/src/pages/child/ChildRoutinesWidget.tsx
import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Clock, Loader2, Sparkles } from 'lucide-react';
import service, { ApiResponse } from '../../api/request';
import { useUserStore } from '../../store';
import { appToast } from '../../utils/toast';

export default function ChildRoutinesWidget() {
  const [loading, setLoading] = useState(true);

  const { user, setChildrenList, currentFamilyId, routinesList, routineLogs, fetchRoutinesAction } = useUserStore();
  const [checkingId, setCheckingId] = useState<string | null>(null);

  // 获取本地今天的 YYYY-MM-DD 格式
  const todayStr = new Date().toLocaleDateString('en-CA'); 
  const todayDayOfWeek = new Date().getDay(); // 0 是周日, 1-6 是周一到周六

  useEffect(() => {
    if (currentFamilyId && user?.id) {
      setLoading(true);
      fetchRoutinesAction(currentFamilyId, user.id).finally(() => {
        setLoading(false);
      });
    }
  }, [currentFamilyId, user?.id, fetchRoutinesAction]);

  // 🌟 在渲染前过滤：只看全家的或我自己的，并且包含今天
  const routines = routinesList.filter((r: any) => {
    const isForMe = !r.child_id || r.child_id === user?.id;
    let isToday = true;
    if (r.frequency === 'weekly' && r.repeat_days) {
      try {
        const days = JSON.parse(r.repeat_days);
        isToday = days.includes(todayDayOfWeek);
      } catch (e) {}
    }
    return isForMe && isToday;
  });

  const handleCheckIn = async (routine: any) => {
    setCheckingId(routine.id);
    try {
      const res = await service.post<any, ApiResponse>('/routines/checkin', {
        routineId: routine.id,
        childId: user?.id,
        dateStr: todayStr
      });
      
      if (res && res.success) {
        if (routine.auto_approve) {
          appToast.success(`打卡成功！+${routine.points} 积分 🪙`);
        } else {
          appToast.success('已提交！等待家长审核 🎁');
        }
        // 🌟 关键：打卡成功后触发全局刷新
        // fetchRoutinesAction(currentFamilyId!, user?.id); 
        // 1. 刷新习惯打卡板的 UI 状态 (变绿)
        await fetchRoutinesAction(currentFamilyId!, user?.id); 
        
        // 🌟 2. 新增：重新拉取孩子列表，实时刷新首页顶部的积分卡片！
        const childRes = await service.get<any, ApiResponse>('/children');
        if (childRes.success && childRes.data) {
          setChildrenList(childRes.data);
        }
      }
    } catch (e) {} finally {
      setCheckingId(null);
    }
  };

  if (loading) return <div className="animate-pulse h-24 bg-gray-100 dark:bg-gray-800 rounded-3xl" />;
  if (routines.length === 0) return null; // 今天没有任务就不显示

  return (
    <section className="bg-white dark:bg-gray-800 rounded-[32px] p-5 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="text-yellow-500" size={20} />
        <h2 className="text-lg font-black text-gray-900 dark:text-white">今日习惯打卡</h2>
      </div>

      <div className="space-y-3">
        {routines.map(routine => {
          const log = routineLogs.find(l => l.routine_id === routine.id);
          const isCompleted = log?.status === 'completed';
          const isPending = log?.status === 'pending';
          const isChecked = isCompleted || isPending;

          return (
            <div 
              key={routine.id}
              onClick={() => !isChecked && !checkingId && handleCheckIn(routine)}
              className={`p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${
                isChecked 
                  ? 'border-transparent bg-gray-50 dark:bg-gray-800/50 opacity-60' 
                  : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-200 dark:hover:border-blue-800 cursor-pointer active:scale-98 shadow-sm'
              }`}
            >
              <div className="text-3xl">{routine.emoji}</div>
              
              <div className="flex-1 min-w-0">
                <h4 className={`font-bold truncate transition-colors ${isChecked ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
                  {routine.name}
                </h4>
                <p className={`text-sm font-bold ${isChecked ? 'text-gray-400' : 'text-blue-500'}`}>
                  +{routine.points} PTS {routine.auto_approve ? '' : '(需审核)'}
                </p>
              </div>

              {/* 状态图标 */}
              <div className="shrink-0">
                {checkingId === routine.id ? (
                  <Loader2 className="animate-spin text-blue-500" size={24} />
                ) : isCompleted ? (
                  <CheckCircle2 className="text-green-500" size={28} />
                ) : isPending ? (
                  <Clock className="text-orange-400" size={28} />
                ) : (
                  <Circle className="text-gray-300 dark:text-gray-600" size={28} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}