import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Medal, Lock } from 'lucide-react';
import api from '../../api/request';

// 定义前端的视觉配置映射表
const BADGE_VISUALS: Record<string, { emoji: string; gradient: string }> = {
  'first_plus': { emoji: '🌱', gradient: 'from-green-400 to-emerald-500' },
  'points_100': { emoji: '⭐', gradient: 'from-yellow-400 to-orange-500' },
  'points_1000': { emoji: '👑', gradient: 'from-purple-500 to-indigo-600' },
  'redeem_first': { emoji: '🛍️', gradient: 'from-pink-400 to-rose-500' },
};

// 兜底配置
const DEFAULT_VISUAL = { emoji: '🎖️', gradient: 'from-blue-400 to-cyan-500' };

export default function ChildAchievements() {
  const { t } = useTranslation();
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        // 先获取当前孩子的 internalId
        const meRes: any = await api.get('/me');
        const myId = meRes.data.internalId;
        
        // 拉取成就墙数据
        const achRes: any = await api.get(`/achievements/${myId}`);
        setAchievements(achRes.data);
      } catch (err) {
        // 错误由拦截器处理
      } finally {
        setLoading(false);
      }
    };
    fetchAchievements();
  }, []);

  if (loading) return <div className="p-4 text-center mt-20 font-bold text-blue-500 animate-pulse">Loading Badges...</div>;

  return (
    <div className="min-h-screen bg-[#F0F9FF] dark:bg-gray-900 pb-28 font-sans">
      
      {/* 头部装饰区 */}
      <div className="bg-gradient-to-b from-blue-400 to-blue-600 dark:from-blue-700 dark:to-blue-900 rounded-b-[2.5rem] pt-10 pb-12 px-6 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center text-white">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3">
            <Medal size={36} className="text-white" />
          </div>
          <h1 className="text-2xl font-black mb-1 text-center">
            {t('child.achievements_title')}
          </h1>
          <p className="text-blue-100 text-sm font-medium">{t('child.achievements_desc')}</p>
        </div>
        
        {/* 装饰性光晕 */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
      </div>

      {/* 徽章列表 */}
      <div className="px-4 -mt-6 relative z-20 space-y-4">
        {achievements.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 text-center shadow-sm">
            <p className="text-gray-400 font-medium">还没有生成任何徽章记录哦</p>
          </div>
        ) : (
          achievements.map((ach) => {
            const isUnlocked = ach.unlocked === 1;
            const visual = BADGE_VISUALS[ach.achievement_key] || DEFAULT_VISUAL;

            return (
              <div 
                key={ach.achievement_key}
                className={`bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border-[3px] transition-all flex items-center ${
                  isUnlocked 
                    ? 'border-transparent' 
                    : 'border-transparent opacity-80 grayscale-[20%]'
                }`}
              >
                {/* 左侧徽章图标 */}
                <div className={`w-16 h-16 flex-shrink-0 rounded-2xl flex items-center justify-center text-3xl shadow-inner relative ${
                  isUnlocked ? `bg-gradient-to-br ${visual.gradient}` : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  {isUnlocked ? (
                    <span className="drop-shadow-md animate-in zoom-in duration-500">{visual.emoji}</span>
                  ) : (
                    <Lock size={28} className="text-gray-400 dark:text-gray-500" />
                  )}
                  
                  {/* 已解锁的闪光小点缀 */}
                  {isUnlocked && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-300 rounded-full animate-ping"></div>
                  )}
                </div>

                {/* 右侧徽章信息 */}
                <div className="ml-4 flex-1">
                  <h3 className={`font-bold text-base mb-0.5 ${isUnlocked ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    {t(`child.badge_${ach.achievement_key}`)}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
                    {t(`child.badge_${ach.achievement_key}_desc`)}
                  </p>

                  {/* 进度条 或 解锁时间 */}
                  {isUnlocked ? (
                    <div className="inline-block bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[10px] font-bold px-2 py-1 rounded-full">
                      {t('child.unlocked_at', { 
                        date: new Date(ach.unlocked_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) 
                      })}
                    </div>
                  ) : (
                    <div className="w-full">
                      <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-bold">
                        <span>{t('child.locked')}</span>
                        <span>{t('child.progress')} {ach.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="bg-gray-400 dark:bg-gray-500 h-2.5 rounded-full transition-all duration-1000 ease-out" 
                          style={{ width: `${Math.max(ach.progress, 5)}%` }} // 最小给个 5% 避免全空不好看
                        ></div>
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