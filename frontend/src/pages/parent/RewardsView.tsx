// frontend/src/pages/parent/RewardsView.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, PackageOpen, LayoutGrid, List as ListIcon, Edit2, Trash2, Send } from 'lucide-react';
import api from '../../api/request';
import { appToast } from '../../utils/toast';
import { useViewMode } from '../../hooks/useViewMode';
import { useUserStore } from '../../store'; // 🌟 引入 Store
import AddRewardDrawer from './AddRewardDrawer'; 
import AdminRedeemDrawer from './AdminRedeemDrawer';

export default function RewardsView() {
  const { t } = useTranslation();
  
  // 🌟 从 Store 获取家庭设置里的自定义代币图标
  const { currentFamilyId, families } = useUserStore();
  const currentFamily = families.find((f: any) => f.id === currentFamilyId);
  const pointEmoji = currentFamily?.point_emoji || '🪙';

  const [rewards, setRewards] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [viewMode, setViewMode] = useViewMode('parent_reward_view', 'grid');
  
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<any>(null);
  const [redeemDrawerOpen, setRedeemDrawerOpen] = useState(false);
  const [redeemTargetReward, setRedeemTargetReward] = useState<any>(null);

  const fetchInitData = async () => {
    setLoading(true);
    try {
      const [rewardRes, catRes]: any = await Promise.all([
        api.get(`/rewards/list?keyword=${keyword}&categoryId=${categoryId}`),
        api.get('/categories/list')
      ]);
      setRewards(rewardRes.data);
      setCategories(catRes.data);
    } catch (err) {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchInitData(), 300);
    return () => clearTimeout(timer);
  }, [keyword, categoryId]);

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('parent.reward_delete_confirm', '确定要删除吗？'))) return;
    try {
      await api.delete(`/rewards/manage/${id}`);
      appToast.success(t('parent.reward_delete_success', '删除成功'));
      fetchInitData();
    } catch (err) {}
  };

  const handleAdminRedeem = (reward: any) => {
    setRedeemTargetReward(reward);
    setRedeemDrawerOpen(true);
  };

  const openEdit = (reward: any) => {
    setEditingReward(reward);
    setIsAddDrawerOpen(true);
  };

  return (
    <div className="p-4 pb-24 relative space-y-5 transition-colors duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white transition-colors">{t('parent.title_rewards', '心愿商店')}</h2>
        <button onClick={() => { setEditingReward(null); setIsAddDrawerOpen(true); }}
          className="flex items-center text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-full font-bold active:scale-95 transition-colors shadow-sm">
          <Plus size={18} className="mr-1" />{t('parent.reward_add_btn', '上架商品')}
        </button>
      </div>

      {/* 🌟 优化：搜索与控制栏防挤压布局 */}
      <div className="flex items-center gap-2">
        <input type="text" placeholder={t('parent.reward_search_ph', '搜索商品...')} value={keyword} onChange={e => setKeyword(e.target.value)}
          className="flex-1 min-w-0 h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-colors placeholder-gray-400" />
        
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
          className="w-24 shrink-0 h-11 px-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm outline-none transition-colors appearance-none font-medium text-center">
          <option value="">{t('parent.all_categories', '全部分类')}</option>
          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>

        {/* 🌟 优化：固定的分段控制器，绝不被挤压 */}
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl shrink-0 border border-gray-200 dark:border-gray-700">
          <button onClick={() => setViewMode('grid')} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
            <LayoutGrid size={18} />
          </button>
          <button onClick={() => setViewMode('list')} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
            <ListIcon size={18} />
          </button>
        </div>
      </div>

      {/* 列表渲染区 */}
      {loading ? <div className="text-center py-10 text-gray-400 dark:text-gray-500 transition-colors animate-pulse">{t('common.loading', '加载中...')}</div> : rewards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500 transition-colors">
          <PackageOpen size={48} className="text-gray-300 dark:text-gray-600 mb-4 transition-colors" />
          <p className="font-medium">{t('parent.reward_empty', '奖品库空空如也，快去添加吧！')}</p>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? "grid grid-cols-2 gap-3" : "flex flex-col space-y-3"}>
          {rewards.map(reward => (
            viewMode === 'grid' ? (
              /* --- 🌟 优化：网格视图 (Grid) --- */
              <div key={reward.id} className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden hover:shadow-md transition-all group">
                <div className="p-4 flex-1 flex flex-col items-center text-center">
                  <div className={`text-5xl mb-3 w-20 h-20 flex items-center justify-center rounded-2xl transition-colors ${reward.stock === 0 ? 'bg-gray-100 dark:bg-gray-700/50 grayscale opacity-50' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                    {reward.emoji || '🎁'}
                  </div>
                  <h3 className={`font-bold line-clamp-2 mb-1 ${reward.stock === 0 ? 'text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>{reward.name}</h3>
                  <div className="flex items-center gap-1 mt-auto pt-2">
                    <span className={`font-black text-lg ${reward.stock === 0 ? 'text-gray-400' : 'text-blue-600 dark:text-blue-400'}`}>{reward.cost}</span>
                    <span className="text-sm">{pointEmoji}</span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{reward.stock === -1 ? t('parent.stock_infinite', '不限量') : `剩余: ${reward.stock}`}</p>
                </div>
                {/* 底部等宽操作栏 */}
                <div className="flex border-t border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                  <button onClick={() => openEdit(reward)} className="flex-1 py-3 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 flex justify-center transition-colors"><Edit2 size={18}/></button>
                  <div className="w-[1px] bg-gray-100 dark:bg-gray-700"></div>
                  <button onClick={() => handleDelete(reward.id)} className="flex-1 py-3 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-gray-700 flex justify-center transition-colors"><Trash2 size={18}/></button>
                  <div className="w-[1px] bg-gray-100 dark:bg-gray-700"></div>
                  <button onClick={() => handleAdminRedeem(reward)} disabled={reward.stock === 0} className="flex-1 py-3 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-gray-700 flex justify-center disabled:opacity-30 transition-colors" title="后台直接核销"><Send size={18}/></button>
                </div>
              </div>
            ) : (
              /* --- 🌟 优化：列表视图 (List) --- */
              <div key={reward.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-3 flex items-center gap-4 hover:border-blue-200 dark:hover:border-blue-800 transition-all">
                <div className={`text-4xl w-14 h-14 flex items-center justify-center rounded-xl shrink-0 ${reward.stock === 0 ? 'bg-gray-100 dark:bg-gray-700/50 grayscale opacity-50' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                  {reward.emoji || '🎁'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold truncate ${reward.stock === 0 ? 'text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>{reward.name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`font-black flex items-center gap-1 ${reward.stock === 0 ? 'text-gray-400' : 'text-blue-600 dark:text-blue-400'}`}>
                      {reward.cost} <span className="text-xs font-normal">{pointEmoji}</span>
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-nowrap">
                      {reward.stock === -1 ? t('parent.stock_infinite', '不限量') : t('parent.stock_left', '剩余: {{stock}}', { stock: reward.stock })}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                   <button onClick={() => openEdit(reward)} className="p-2.5 text-gray-400 hover:text-blue-500 bg-gray-50 dark:bg-gray-700 rounded-xl transition-colors"><Edit2 size={18}/></button>
                   <button onClick={() => handleDelete(reward.id)} className="p-2.5 text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-gray-700 rounded-xl transition-colors"><Trash2 size={18}/></button>
                   <button onClick={() => handleAdminRedeem(reward)} disabled={reward.stock === 0} className="p-2.5 text-gray-400 hover:text-green-500 bg-gray-50 dark:bg-gray-700 rounded-xl disabled:opacity-30 transition-colors"><Send size={18}/></button>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      <AddRewardDrawer isOpen={isAddDrawerOpen} onClose={() => setIsAddDrawerOpen(false)} onSuccess={fetchInitData} existingData={editingReward} />
      <AdminRedeemDrawer isOpen={redeemDrawerOpen} onClose={() => setRedeemDrawerOpen(false)} onSuccess={fetchInitData} reward={redeemTargetReward} />
    </div>
  );
}