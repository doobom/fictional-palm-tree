// frontend/src/pages/child/ChildAchievements.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Medal, Lock } from 'lucide-react';
import api from '../../api/request';

const BADGE_VISUALS: Record<string, { emoji: string; gradient: string }> = {
  'first_plus': { emoji: '🌱', gradient: 'from-green-400 to-emerald-500' },
  'points_100': { emoji: '⭐', gradient: 'from-yellow-400 to-orange-500' },
  'points_1000': { emoji: '👑', gradient: 'from-purple-500 to-indigo-600' },
  'redeem_first': { emoji: '🛍️', gradient: 'from-pink-400 to-rose-500' },
};

const DEFAULT_VISUAL = { emoji: '🎖️', gradient: 'from-blue-400 to-cyan-500' };

export default function ChildAchievements() {
  const { t } = useTranslation();
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        const meRes: any = await api.get('/me');
        const myId = meRes.data.internalId;
        const achRes: any = await api.get(`/achievements/${myId}`);
        setAchievements(achRes.data);
      } catch (err) {} finally { setLoading(false); }
    };
    fetchAchievements();
  }, []);

  if (loading) return <div className="p-4 text-center mt-20 font-bold text-blue-500 dark:text-blue-400 animate-pulse transition-colors">Loading Badges...</div>;

  return (
    // 🌟 全局容器加入暗色背景
    <div className="min-h-screen bg-[#F0F9FF] dark:bg-gray-900 pb-28 font-sans transition-colors duration-300">
      
      {/* 头部装饰区 */}
      <div className="bg-gradient-to-b from-blue-400 to-blue-600 dark:from-blue-800 dark:to-gray-900 rounded-b-[2.5rem] pt-12 pb-12 px-6 shadow-md relative overflow-hidden transition-colors duration-300">
        <div className="relative z-10 flex flex-col items-center text-white">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3">
            <Medal size={36} className="text-white" />
          </div>
          <h1 className="text-2xl font-black mb-1 text-center">
            {t('child.achievements_title', '我的成就墙')}
          </h1>
          <p className="text-blue-100 dark:text-blue-200 text-sm font-medium">{t('child.achievements_desc', '记录你成长的每一个脚印')}</p>
        </div>
        <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
      </div>

      {/* 徽章列表 */}
      <div className="px-4 -mt-6 relative z-20 space-y-4">
        {achievements.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 text-center shadow-sm transition-colors">
            <p className="text-gray-400 dark:text-gray-500 font-medium">还没有生成任何徽章记录哦</p>
          </div>
        ) : (
          achievements.map((ach) => {
            const isUnlocked = ach.unlocked === 1;
            const visual = BADGE_VISUALS[ach.achievement_key] || DEFAULT_VISUAL;

            return (
              <div 
                key={ach.achievement_key}
                className={`bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border-[3px] transition-colors flex items-center ${
                  isUnlocked 
                    ? 'border-transparent' 
                    : 'border-transparent opacity-80 grayscale-[20%]'
                }`}
              >
                <div className={`w-16 h-16 flex-shrink-0 rounded-2xl flex items-center justify-center text-3xl shadow-inner relative transition-colors ${
                  isUnlocked ? `bg-gradient-to-br ${visual.gradient}` : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  {isUnlocked ? (
                    <span className="drop-shadow-md animate-in zoom-in duration-500">{visual.emoji}</span>
                  ) : (
                    <Lock size={28} className="text-gray-400 dark:text-gray-500" />
                  )}
                  {isUnlocked && <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-300 rounded-full animate-ping"></div>}
                </div>

                <div className="ml-4 flex-1">
                  <h3 className={`font-bold text-base mb-0.5 transition-colors ${isUnlocked ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    {t(`child.badge_${ach.achievement_key}`)}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2 transition-colors">
                    {t(`child.badge_${ach.achievement_key}_desc`)}
                  </p>

                  {isUnlocked ? (
                    <div className="inline-block bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 text-[10px] font-bold px-2 py-1 rounded-full transition-colors">
                      {t('child.unlocked_at', { date: new Date(ach.unlocked_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) })}
                    </div>
                  ) : (
                    <div className="w-full">
                      <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mb-1 font-bold transition-colors">
                        <span>{t('child.locked', '未解锁')}</span>
                        <span>{t('child.progress', '进度')} {ach.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden transition-colors">
                        <div 
                          className="bg-gray-400 dark:bg-gray-500 h-2.5 rounded-full transition-all duration-1000 ease-out" 
                          style={{ width: `${Math.max(ach.progress, 5)}%` }} 
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}