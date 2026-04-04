// src/pages/child/ChildRewards.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Store, Sparkles, X, LayoutGrid, List as ListIcon, Search } from 'lucide-react';
import api from '../../api/request';
import { appToast } from '../../utils/toast';
import { useViewMode } from '../../hooks/useViewMode';

export default function ChildRewards() {
  const { t } = useTranslation();
  
  const [rewards, setRewards] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [myCoins, setMyCoins] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // 搜索、分类与视图状态
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [viewMode, setViewMode] = useViewMode('child_reward_view', 'grid');

  // 选中的奖品（用于控制兑换弹窗）
  const [selectedReward, setSelectedReward] = useState<any | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);

  // 获取数据 (包含搜索和分类过滤)
  const fetchStoreData = async () => {
    setLoading(true);
    try {
      const [rewardsRes, catRes, meRes, childListRes]: any = await Promise.all([
        api.get(`/rewards/list?keyword=${keyword}&categoryId=${categoryId}`),
        api.get('/categories/list'),
        api.get('/me'),
        api.get('/children/list')
      ]);

      setRewards(rewardsRes.data);
      setCategories(catRes.data);

      const myId = meRes.data.internalId;
      const profile = childListRes.data.find((c: any) => c.id === myId);
      if (profile) {
        setMyCoins(profile.score_gained - profile.score_spent);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 当搜索词或分类改变时重新拉取 (带简单防抖)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStoreData();
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword, categoryId]);

  const handleRedeem = async () => {
    if (!selectedReward) return;
    setIsRedeeming(true);
    try {
      const res: any = await api.post('/rewards/redeem', { rewardId: selectedReward.id });
      if (res.status === 'pending') {
        appToast.success(t('child.redeem_pending'));
      } else {
        appToast.success(t('child.redeem_success'));
      }
      setSelectedReward(null);
      fetchStoreData(); // 刷新余额和库存
    } catch (err) {
      // 错误由 request.ts 的拦截器统一弹出 Toast
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div className="p-4 pb-safe min-h-screen relative">
      {/* 顶部标题 */}
      <div className="flex items-center space-x-2 mb-4">
        <Store className="text-pink-500" size={24} />
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">
          {t('child.store_title', '心愿商店')}
        </h1>
      </div>
      
      <p className="text-gray-500 dark:text-gray-400 mb-6 flex items-center font-medium">
        <Sparkles size={16} className="mr-1 text-yellow-500" />
        {t('child.store_desc', '努力赚取金币，兑换你想要的奖励吧！')}
      </p>

      {/* 搜索与控制栏 */}
      <div className="flex space-x-2 mb-6">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
          <input 
            type="text" 
            placeholder={t('parent.search_ph', '搜索奖品名称...')} 
            value={keyword} 
            onChange={e => setKeyword(e.target.value)}
            className="w-full h-11 pl-9 pr-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-pink-500 outline-none transition-all" 
          />
        </div>
        
        <select 
          value={categoryId} 
          onChange={e => setCategoryId(e.target.value)}
          className="h-11 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium outline-none focus:ring-2 focus:ring-pink-500 max-w-[110px] truncate"
        >
          <option value="">{t('parent.all_categories', '全部分类')}</option>
          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>

        <div className="flex border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 overflow-hidden shrink-0">
          <button onClick={() => setViewMode('grid')} className={`px-2.5 flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-pink-100 dark:bg-pink-900/40 text-pink-600' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            <LayoutGrid size={18} />
          </button>
          <button onClick={() => setViewMode('list')} className={`px-2.5 flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-pink-100 dark:bg-pink-900/40 text-pink-600' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            <ListIcon size={18} />
          </button>
        </div>
      </div>

      {/* 列表渲染区 */}
      {loading ? (
        <div className="text-center py-20 text-gray-400 font-medium animate-pulse">{t('common.loading', '加载中...')}</div>
      ) : rewards.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
          <div className="text-5xl mb-4 opacity-50">🛒</div>
          <p className="text-gray-500 font-medium">{t('child.empty_store', '商店里还没有上架奖品呢')}</p>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? "grid grid-cols-2 gap-3" : "flex flex-col space-y-3"}>
          {rewards.map(reward => {
            const canAfford = myCoins >= reward.cost;
            const hasStock = reward.stock === -1 || reward.stock > 0;
            const isAvailable = canAfford && hasStock;

            return (
              <div 
                key={reward.id} 
                onClick={() => isAvailable && setSelectedReward(reward)}
                className={`
                  bg-white dark:bg-gray-800 rounded-2xl border transition-all relative overflow-hidden
                  ${viewMode === 'list' ? 'flex p-3 items-center' : 'p-4 flex flex-col'}
                  ${isAvailable 
                    ? 'border-gray-100 dark:border-gray-700 shadow-sm hover:border-pink-200 hover:shadow-md active:scale-95 cursor-pointer' 
                    : 'border-gray-100 dark:border-gray-700 opacity-60 grayscale-[50%]'}
                `}
              >
                <div className={`${viewMode === 'list' ? 'text-4xl mr-4' : 'text-5xl mb-3 text-center pt-2'}`}>
                  {reward.emoji || '🎁'}
                </div>
                
                <div className="flex-1 flex flex-col justify-center">
                  <h3 className={`font-bold text-gray-900 dark:text-white truncate ${viewMode === 'grid' ? 'text-center mb-1' : ''}`}>
                    {reward.name}
                  </h3>
                  <div className={`flex items-center justify-between ${viewMode === 'grid' ? 'mt-2' : 'mt-1'}`}>
                    <span className={`font-extrabold text-sm ${canAfford ? 'text-pink-500' : 'text-red-500'}`}>
                      {reward.cost} 🪙
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md">
                      {reward.stock === -1 ? t('child.stock_infinite', '不限量') : t('child.stock_left', { stock: reward.stock, defaultValue: `剩 ${reward.stock}` })}
                    </span>
                  </div>
                </div>

                {/* 遮罩提示层 (钱不够或没库存) */}
                {!isAvailable && (
                  <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center backdrop-blur-[1px]">
                    <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                      {!hasStock ? t('api.ERR_OUT_OF_STOCK', '库存不足') : t('child.locked', '积分不够')}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 🌟 兑换确认抽屉 (Bottom Sheet) */}
      <div className={`fixed inset-0 z-[100] ${selectedReward ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        {/* 背景遮罩 (毛玻璃效果) */}
        <div 
          className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${selectedReward ? 'opacity-100' : 'opacity-0'}`} 
          onClick={() => !isRedeeming && setSelectedReward(null)} 
        />
        
        {/* 底部弹窗 */}
        <div className={`absolute inset-x-0 bottom-0 bg-white dark:bg-gray-800 rounded-t-[32px] shadow-2xl transition-transform duration-300 ease-out transform pb-safe ${selectedReward ? 'translate-y-0' : 'translate-y-full'}`}>
          
          {/* 顶部小横条指示器 */}
          <div className="w-full flex justify-center pt-3 pb-2">
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full" />
          </div>

          {selectedReward && (
            <div className="px-6 pb-8 pt-2 flex flex-col relative">
              <button 
                onClick={() => setSelectedReward(null)}
                className="absolute top-2 right-6 p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <X size={20} />
              </button>

              <div className="text-7xl text-center mb-2 mt-4 animate-[bounce_2s_infinite]">
                {selectedReward.emoji || '🎁'}
              </div>
              
              <h3 className="text-2xl font-black text-center text-gray-900 dark:text-white mb-2">
                {t('child.confirm_title', '确认兑换？')}
              </h3>
              
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4 mb-6 mt-2 border border-gray-100 dark:border-gray-700">
                <p className="text-center text-gray-600 dark:text-gray-300 font-medium text-sm leading-relaxed">
                  {t('child.confirm_desc', { name: selectedReward.name, cost: selectedReward.cost, defaultValue: `兑换「{{name}}」将消耗你 {{cost}} 个金币哦！` })}
                </p>
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 flex justify-between text-sm font-bold">
                  <span className="text-gray-500">{t('child.current_balance', '当前余额：')}</span>
                  <span className="text-blue-500">{myCoins} 🪙</span>
                </div>
              </div>

              <div className="flex space-x-3">
                <button 
                  disabled={isRedeeming}
                  onClick={() => setSelectedReward(null)}
                  className="flex-1 py-4 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-200 active:scale-95 transition-all"
                >
                  {t('child.btn_cancel', '我再想想')}
                </button>
                <button 
                  disabled={isRedeeming}
                  onClick={handleRedeem}
                  className="flex-1 py-4 rounded-2xl bg-pink-500 text-white font-bold active:bg-pink-600 active:scale-95 transition-all shadow-lg shadow-pink-200 dark:shadow-none flex justify-center items-center relative overflow-hidden"
                >
                  {isRedeeming ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span className="relative z-10">{t('child.btn_confirm_redeem', '确定兑换')}</span>
                      <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}