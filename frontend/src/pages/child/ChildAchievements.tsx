// frontend/src/pages/child/ChildAchievements.tsx
import React, { useEffect, useState } from 'react';
import { Trophy, Lock, Star } from 'lucide-react';
import service, { ApiResponse } from '../../api/request';
import { useUserStore } from '../../store';

export default function ChildAchievements() {
  const { user } = useUserStore();
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 如果你有 childId 的绑定逻辑，这里根据你的实际结构取值
  const childId = user?.id; 

  useEffect(() => {
    if (childId) fetchAchievements();
  }, [childId]);

  const fetchAchievements = async () => {
    try {
      const res = await service.get<any, ApiResponse>(`/achievements?childId=${childId}`);
      if (res.success) setAchievements(res.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  if (loading) {
    return <div className="p-10 text-center text-gray-400 font-bold animate-pulse">正在进入荣誉室...</div>;
  }

  return (
    <div className="p-4 pb-24 space-y-6">
      
      {/* 头部统计卡片 */}
      <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl p-6 shadow-lg text-white relative overflow-hidden transition-all">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black mb-1 drop-shadow-sm">荣誉陈列室</h2>
            <p className="font-bold opacity-90 drop-shadow-sm">已点亮 {unlockedCount} / {achievements.length} 个徽章</p>
          </div>
          <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
            <Trophy size={32} className="text-white drop-shadow-md" />
          </div>
        </div>
        {/* 背景光晕装饰 */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-3xl pointer-events-none" />
        <Star className="absolute -bottom-2 -right-2 text-white/30" size={80} strokeWidth={1.5} />
      </div>

      {/* 徽章网格 */}
      <div className="grid grid-cols-2 gap-3">
        {achievements.map((ach) => {
          const isUnlocked = ach.unlocked;
          
          return (
            <div 
              key={ach.key} 
              className={`relative p-5 rounded-3xl border-2 transition-all duration-500 flex flex-col items-center text-center overflow-hidden ${
                isUnlocked 
                  ? 'bg-white dark:bg-gray-800 border-yellow-400 shadow-md' 
                  : 'bg-gray-50 dark:bg-gray-800/40 border-transparent grayscale opacity-60'
              }`}
            >
              {/* 解锁后的背景特效 */}
              {isUnlocked && <div className="absolute inset-0 bg-gradient-to-br from-yellow-100/50 to-transparent dark:from-yellow-900/20 rounded-3xl pointer-events-none" />}
              
              <div className={`text-5xl mb-3 z-10 ${isUnlocked ? 'drop-shadow-xl scale-110 transition-transform duration-500' : ''}`}>
                {ach.emoji}
              </div>
              
              <h3 className={`font-black text-sm mb-1 z-10 ${isUnlocked ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                {ach.name}
              </h3>
              
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold leading-tight h-8 flex items-center justify-center z-10">
                {ach.desc}
              </p>

              {/* 进度条展示 (如果数据库里记录了 progress 且未满 100) */}
              {!isUnlocked && ach.progress > 0 && ach.progress < 100 && (
                 <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mt-2 overflow-hidden z-10">
                   <div className="bg-blue-400 h-full rounded-full transition-all" style={{ width: `${ach.progress}%` }} />
                 </div>
              )}

              {/* 未解锁锁头图标 */}
              {!isUnlocked && (
                <div className="absolute top-3 right-3 text-gray-400 z-10">
                  <Lock size={14} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}