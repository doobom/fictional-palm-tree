// frontend/src/pages/child/ChildRewards.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Store, Sparkles, X, LayoutGrid, List as ListIcon, Search, MessageSquare } from 'lucide-react';
import api from '../../api/request';
import { appToast } from '../../utils/toast';
import { useViewMode } from '../../hooks/useViewMode';
import { useUserStore } from '../../store'; // 🌟 引入全局状态

export default function ChildRewards() {
  const { t } = useTranslation();
  const { childrenList, user } = useUserStore(); // 🌟 引入全局孩子列表和当前用户
  
  const [rewards, setRewards] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [viewMode, setViewMode] = useViewMode('child_reward_view', 'grid');

  const [selectedReward, setSelectedReward] = useState<any | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [evidenceText, setEvidenceText] = useState('');

  // 🌟 核心优化：直接根据全局内存状态实时计算金币
  // 当家长审批通过，SSE 触发全局 childrenList 更新时，这里的 myCoins 会在毫秒级自动重算并刷新 UI
  const myProfile = childrenList.find(c => c.id === user?.id);
  const myCoins = myProfile ? (myProfile.balance || 0) : 0;

  const fetchStoreData = async () => {
    setLoading(true);
    try {
      // 🌟 删除了冗余的 /me 和 /children/list 请求，只拉取商店商品和分类，速度更快！
      const [rewardsRes, catRes]: any = await Promise.all([
        api.get(`/rewards/list?keyword=${keyword}&categoryId=${categoryId}`),
        api.get('/categories/list')
      ]);

      setRewards(rewardsRes.data);
      setCategories(catRes.data);
    } catch (err) {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchStoreData(), 300);
    return () => clearTimeout(timer);
  }, [keyword, categoryId]);

  const openRedeemDrawer = (reward: any) => {
    setSelectedReward(reward);
    setEvidenceText(''); 
  };

  const handleRedeem = async () => {
    if (!selectedReward) return;
    setIsRedeeming(true);
    try {
      const res: any = await api.post('/approvals', {
        type: 'reward',                      
        rewardId: selectedReward.id,         
        title: selectedReward.name,          
        requestedPoints: selectedReward.cost,
        evidenceText: evidenceText || '我想兑换这个商品！' 
      });
      
      // request.ts 拦截器只在报错时走 catch，成功时会返回 payload
      if (res && res.success) {
        appToast.success('兑换申请已发送！请等待家长同意 🎁');
        setSelectedReward(null);
      }
    } catch (err) {
      // 这里的网络错误提示由 request.ts 的 catch 兜底
      console.error(err);
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div className="p-4 pt-8 pb-safe min-h-screen relative bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="flex items-center space-x-2 mb-4">
        <Store className="text-pink-500" size={24} />
        <h1 className="text-2xl font-black text-gray-900 dark:text-white transition-colors">
          {t('child.store_title', '心愿商店')}
        </h1>
      </div>
      
      <p className="text-gray-500 dark:text-gray-400 mb-6 flex items-center font-medium transition-colors">
        <Sparkles size={16} className="mr-1 text-yellow-500" />
        {t('child.store_desc', '努力赚取金币，兑换你想要的奖励吧！')}
      </p>

      {/* 搜索与控制栏 */}
      <div className="flex space-x-2 mb-6">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400 dark:text-gray-500" />
          </div>
          <input 
            type="text" placeholder={t('parent.search_ph', '搜索奖品名称...')} value={keyword} onChange={e => setKeyword(e.target.value)}
            className="w-full h-11 pl-9 pr-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-pink-500 outline-none transition-colors" 
          />
        </div>
        
        <select 
          value={categoryId} onChange={e => setCategoryId(e.target.value)}
          className="h-11 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-medium outline-none focus:ring-2 focus:ring-pink-500 max-w-[110px] truncate transition-colors"
        >
          <option value="">{t('parent.all_categories', '全部分类')}</option>
          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>

        <div className="flex border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 overflow-hidden shrink-0 transition-colors">
          <button onClick={() => setViewMode('grid')} className={`px-2.5 flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}><LayoutGrid size={18} /></button>
          <button onClick={() => setViewMode('list')} className={`px-2.5 flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}><ListIcon size={18} /></button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-500 font-medium animate-pulse">{t('common.loading', '加载中...')}</div>
      ) : rewards.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 transition-colors">
          <div className="text-5xl mb-4 opacity-50">🛒</div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">{t('child.empty_store', '商店里还没有上架奖品呢')}</p>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? "grid grid-cols-2 gap-3" : "flex flex-col space-y-3"}>
          {rewards.map(reward => {
            const canAfford = myCoins >= reward.cost;
            const hasStock = reward.stock === -1 || reward.stock > 0;
            const isAvailable = canAfford && hasStock;

            return (
              <div 
                key={reward.id} onClick={() => isAvailable && openRedeemDrawer(reward)}
                className={`bg-white dark:bg-gray-800 rounded-2xl border transition-colors relative overflow-hidden ${viewMode === 'list' ? 'flex p-3 items-center' : 'p-4 flex flex-col'} ${isAvailable ? 'border-gray-100 dark:border-gray-700 shadow-sm hover:border-pink-200 dark:hover:border-pink-800 hover:shadow-md active:scale-95 cursor-pointer' : 'border-gray-100 dark:border-gray-700 opacity-60 grayscale-[50%]'}`}
              >
                <div className={`${viewMode === 'list' ? 'text-4xl mr-4' : 'text-5xl mb-3 text-center pt-2'}`}>{reward.emoji || '🎁'}</div>
                
                <div className="flex-1 flex flex-col justify-center">
                  <h3 className={`font-bold text-gray-900 dark:text-gray-100 truncate transition-colors ${viewMode === 'grid' ? 'text-center mb-1' : ''}`}>{reward.name}</h3>
                  <div className={`flex items-center justify-between ${viewMode === 'grid' ? 'mt-2' : 'mt-1'}`}>
                    <span className={`font-extrabold text-sm transition-colors ${canAfford ? 'text-pink-500 dark:text-pink-400' : 'text-red-500 dark:text-red-400'}`}>{reward.cost} 🪙</span>
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md transition-colors">
                      {reward.stock === -1 ? t('child.stock_infinite', '不限量') : t('child.stock_left', { stock: reward.stock, defaultValue: `剩 ${reward.stock}` })}
                    </span>
                  </div>
                </div>

                {!isAvailable && (
                  <div className="absolute inset-0 bg-white/50 dark:bg-black/40 flex items-center justify-center backdrop-blur-[1px] transition-colors">
                    <span className="bg-gray-800 dark:bg-gray-700 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                      {!hasStock ? t('api.ERR_OUT_OF_STOCK', '库存不足') : t('child.locked', '积分不够')}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 兑换确认抽屉 */}
      <div className={`fixed inset-0 z-[100] ${selectedReward ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div className={`absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${selectedReward ? 'opacity-100' : 'opacity-0'}`} onClick={() => !isRedeeming && setSelectedReward(null)} />
        
        <div className={`absolute inset-x-0 bottom-0 bg-white dark:bg-gray-900 rounded-t-[32px] shadow-2xl transition-transform duration-300 ease-out transform pb-safe ${selectedReward ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="w-full flex justify-center pt-3 pb-2"><div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full" /></div>

          {selectedReward && (
            <div className="px-6 pb-8 pt-2 flex flex-col relative">
              <button onClick={() => setSelectedReward(null)} className="absolute top-2 right-6 p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                <X size={20} />
              </button>

              <div className="text-7xl text-center mb-2 mt-4 animate-[bounce_2s_infinite]">{selectedReward.emoji || '🎁'}</div>
              <h3 className="text-2xl font-black text-center text-gray-900 dark:text-white mb-2 transition-colors">想要这个奖励吗？</h3>
              
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 mt-2 border border-gray-100 dark:border-gray-700 transition-colors">
                <p className="text-center text-gray-600 dark:text-gray-300 font-medium text-sm leading-relaxed transition-colors mb-3">
                  向家长发送「{selectedReward.name}」的兑换申请，审核通过后将扣除 <span className="text-pink-500 font-black">{selectedReward.cost} 🪙</span>
                </p>
                
                {/* 留言文本框 */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 pt-3 pointer-events-none text-gray-400">
                    <MessageSquare size={16} />
                  </div>
                  <textarea 
                    value={evidenceText}
                    onChange={e => setEvidenceText(e.target.value)}
                    placeholder="给家长留个言吧（选填）"
                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-500 resize-none h-14 transition-colors dark:text-white"
                  />
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between text-sm font-bold transition-colors">
                  <span className="text-gray-500 dark:text-gray-400">{t('child.current_balance', '当前余额：')}</span>
                  <span className="text-blue-500 dark:text-blue-400">{myCoins} 🪙</span>
                </div>
              </div>

              <div className="flex space-x-3 mt-4">
                <button disabled={isRedeeming} onClick={() => setSelectedReward(null)} className="flex-1 py-4 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all">
                  {t('child.btn_cancel', '我再想想')}
                </button>
                <button disabled={isRedeeming} onClick={handleRedeem} className="flex-1 py-4 rounded-2xl bg-pink-500 text-white font-bold active:bg-pink-600 active:scale-95 transition-all shadow-lg shadow-pink-200 dark:shadow-none flex justify-center items-center relative overflow-hidden">
                  {isRedeeming ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><span className="relative z-10">发送申请</span><div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full" /></>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}