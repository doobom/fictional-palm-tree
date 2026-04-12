// frontend/src/components/AchievementWall.tsx
import React, { useEffect, useState } from 'react';
import { Trophy, Lock } from 'lucide-react';
import service, { ApiResponse } from '../api/request';

export default function AchievementWall({ childId }: { childId: string }) {
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (childId) fetchAchievements();
  }, [childId]);

  const fetchAchievements = async () => {
    setLoading(true);
    try {
      const res = await service.get<any, ApiResponse>(`/achievements?childId=${childId}`);
      if (res.success) setAchievements(res.data || []);
    } catch (err) {} finally { setLoading(false); }
  };

  if (loading) return <div className="p-10 text-center animate-pulse">勋章装填中...</div>;

  return (
    <div className="grid grid-cols-2 gap-3 p-1">
      {achievements.map((ach) => (
        <div key={ach.key} className={`relative p-4 rounded-3xl border-2 transition-all flex flex-col items-center text-center ${
          ach.unlocked ? 'bg-white dark:bg-gray-800 border-yellow-400' : 'bg-gray-50 dark:bg-gray-800/40 border-transparent opacity-60 grayscale'
        }`}>
          <div className="text-4xl mb-2">{ach.emoji}</div>
          <h4 className="font-black text-xs mb-1 text-gray-800 dark:text-gray-100">{ach.name}</h4>
          <p className="text-[10px] text-gray-500 leading-tight">{ach.desc}</p>
          {!ach.unlocked && <Lock size={12} className="absolute top-3 right-3 text-gray-400" />}
        </div>
      ))}
    </div>
  );
}