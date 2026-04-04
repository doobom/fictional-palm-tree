import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, Gift, Trophy } from 'lucide-react';
import api from '../../api/request';

// 🌟 引入真实的业务组件
import ChildRewards from './ChildRewards';
import ChildAchievements from './ChildAchievements';

export default function ChildDashboard() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'home' | 'rewards' | 'achievements'>('home');
  
  const [myProfile, setMyProfile] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const meRes: any = await api.get('/me');
        const myId = meRes.data.internalId;

        const childRes: any = await api.get('/children/list');
        const profile = childRes.data.find((c: any) => c.id === myId);
        setMyProfile(profile);

        const historyRes: any = await api.get(`/scores/history?childId=${myId}&limit=20`);
        setHistory(historyRes.data);
      } catch (err) {
        // 全局拦截器处理
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // 🌟 替换为多语言加载提示
  if (loading) return <div className="flex h-screen items-center justify-center font-bold text-blue-500 animate-pulse">{t('child.loading')}</div>;
  if (!myProfile) return <div className="text-center mt-20 text-red-500">{t('child.load_failed')}</div>;

  const currentCoins = myProfile.score_gained - myProfile.score_spent;

  return (
    <div className="min-h-screen bg-[#F6F8FA] dark:bg-gray-900 pb-24 font-sans">
      
      {/* 顶部个人信息 */}
      {/* pt-tg-safe-content = var(--tg-safe-top) + 16px 舒适间距，一次解决遮挡+间距 */}
      <div className="pt-tg-safe-content px-6 pb-2 flex items-center space-x-3"
        // 顶部标题栏 / 头像区域
        style={{ 
          paddingTop: 'calc(max(var(--tg-safe-top, 0px), var(--app-fallback-top, 0px)) + 16px)' 
        }}
      >
        <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-full shadow-sm flex items-center justify-center text-2xl border-2 border-yellow-400">
          {myProfile.avatar || '👦'}
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
            {/* 🌟 替换为多语言问候语 */}
            {t('child.greeting', { name: myProfile.name })}
          </h1>
          <p className="text-xs text-gray-500 font-medium">
            {/* 🌟 替换为多语言激励语 */}
            {t('child.motivation')}
          </p>
        </div>
      </div>

      {/* 核心内容区 */}
      {activeTab === 'home' && (
        <div className="p-4 space-y-6">
          
          {/* 1. 绚丽的金币余额卡片 */}
          <div className="bg-gradient-to-tr from-orange-400 via-yellow-400 to-yellow-300 rounded-[2rem] p-6 shadow-xl shadow-orange-200 dark:shadow-none relative overflow-hidden">
            <div className="relative z-10 text-center mt-2">
              <p className="text-yellow-900/80 font-bold mb-1">{t('child.my_coins')}</p>
              <div className="text-6xl font-black text-white drop-shadow-md flex justify-center items-center">
                <span className="text-4xl mr-2">🪙</span>
                {currentCoins}
              </div>
            </div>
            
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white opacity-30 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-orange-500 opacity-20 rounded-full blur-2xl"></div>
          </div>

          {/* 2. 积分明细列表 (Timeline) */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <span className="w-1 h-4 bg-yellow-400 rounded-full mr-2"></span>
              {t('child.history')}
            </h2>
            
            {history.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                {t('child.empty_history')}
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((record) => (
                  <div key={record.id} className="flex items-center justify-between border-b border-gray-50 dark:border-gray-700/50 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                        record.points > 0 ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {record.points > 0 ? '📈' : '📉'}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">
                          {/* 🌟 替换默认原因为多语言 */}
                          {record.rule_name || record.description || t('child.default_reason')}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(record.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className={`font-black text-lg ${record.points > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {record.points > 0 ? '+' : ''}{record.points}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* 🌟 挂载真实的视图组件 */}
      {activeTab === 'rewards' && <ChildRewards />}
      {activeTab === 'achievements' && <ChildAchievements />}

      {/* 孩子端专属底部导航栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-t z-50 pb-tg-safe"
        // 底部导航栏
        style={{ 
          paddingBottom: 'calc(max(var(--tg-safe-bottom, 0px), var(--app-fallback-bottom, 0px)) + 8px)' 
        }}
      >
        <div className="flex justify-around items-center h-20 px-2">
          <NavItem icon={<Wallet />} label={t('child.tab_home')} isActive={activeTab === 'home'} onClick={() => setActiveTab('home')} activeColor="text-yellow-500" />
          <NavItem icon={<Gift />} label={t('child.tab_rewards')} isActive={activeTab === 'rewards'} onClick={() => setActiveTab('rewards')} activeColor="text-pink-500" />
          <NavItem icon={<Trophy />} label={t('child.tab_achievements')} isActive={activeTab === 'achievements'} onClick={() => setActiveTab('achievements')} activeColor="text-blue-500" />
        </div>
      </div>

    </div>
  );
}

// 底部导航项子组件
function NavItem({ icon, label, isActive, onClick, activeColor }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void, activeColor: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-all duration-300 ${
        isActive ? activeColor : 'text-gray-400 hover:text-gray-500'
      }`}
    >
      <div className={`transition-transform duration-300 ${isActive ? 'scale-125 -translate-y-1' : 'scale-100'}`}>
        {React.cloneElement(icon as React.ReactElement, { size: 24, strokeWidth: isActive ? 2.5 : 2 })}
      </div>
      <span className={`text-[11px] font-bold transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
        {label}
      </span>
    </button>
  );
}