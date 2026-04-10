// frontend/src/pages/parent/RewardsView.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, PackageOpen, LayoutGrid, List as ListIcon, Edit2, Trash2, Send } from 'lucide-react';
import api from '../../api/request';
import { appToast } from '../../utils/toast';
import { useViewMode } from '../../hooks/useViewMode';
import AddRewardDrawer from './AddRewardDrawer'; 
import AdminRedeemDrawer from './AdminRedeemDrawer';

export default function RewardsView() {
  const { t } = useTranslation();
  const [rewards, setRewards] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 过滤与视图状态
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [viewMode, setViewMode] = useViewMode('parent_reward_view', 'grid');
  
  // 抽屉与弹窗状态
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
    if (!window.confirm(t('parent.delete_confirm'))) return;
    try {
      await api.delete(`/rewards/manage/${id}`);
      appToast.success(t('parent.delete_success', '删除成功'));
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
    <div className="p-4 relative space-y-4 transition-colors duration-300">
      <div className="flex justify-between items-center">
        {/* 🌟 标题颜色 */}
        <h2 className="text-lg font-bold text-gray-900 dark:text-white transition-colors">{t('parent.title_rewards')}</h2>
        {/* 🌟 添加按钮颜色 */}
        <button onClick={() => { setEditingReward(null); setIsAddDrawerOpen(true); }}
          className="flex items-center text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-full font-medium active:scale-95 transition-colors">
          <Plus size={16} className="mr-1" />{t('parent.btn_add_reward')}
        </button>
      </div>

      {/* 搜索与控制栏 */}
      <div className="flex space-x-2">
        {/* 🌟 搜索框适配 */}
        <input type="text" placeholder={t('parent.search_ph')} value={keyword} onChange={e => setKeyword(e.target.value)}
          className="flex-1 h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-1 transition-colors placeholder-gray-400 dark:placeholder-gray-500" />
        
        {/* 🌟 分类选择器适配 */}
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
          className="h-10 px-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm max-w-[120px] transition-colors">
          <option value="">{t('parent.all_categories')}</option>
          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>

        {/* 🌟 视图切换按钮适配 */}
        <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden transition-colors">
          <button onClick={() => setViewMode('grid')} className={`px-2 flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}>
            <LayoutGrid size={18} className="text-gray-600 dark:text-gray-400"/>
          </button>
          <button onClick={() => setViewMode('list')} className={`px-2 flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}>
            <ListIcon size={18} className="text-gray-600 dark:text-gray-400"/>
          </button>
        </div>
      </div>

      {/* 列表渲染区 */}
      {loading ? <div className="text-center py-10 text-gray-400 dark:text-gray-500 transition-colors">Loading...</div> : rewards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500 transition-colors">
          <PackageOpen size={48} className="text-gray-300 dark:text-gray-600 mb-4 transition-colors" />
          <p>{t('parent.empty_rewards')}</p>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? "grid grid-cols-2 gap-3" : "flex flex-col space-y-3"}>
          {rewards.map(reward => (
            /* 🌟 商品卡片背景和边框适配 */
            <div key={reward.id} className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden transition-colors duration-300 ${viewMode === 'list' ? 'flex p-3 items-center' : 'p-4 flex flex-col'}`}>
              
              <div className={`${viewMode === 'list' ? 'text-4xl mr-3' : 'text-4xl mb-3 text-center pt-2'}`}>{reward.emoji || '🎁'}</div>
              
              <div className="flex-1 flex flex-col justify-center">
                {/* 🌟 文字颜色适配 */}
                <h3 className={`font-bold text-gray-900 dark:text-gray-100 truncate transition-colors ${viewMode === 'grid' ? 'text-center mb-1' : ''}`}>{reward.name}</h3>
                <div className={`flex items-center justify-between ${viewMode === 'grid' ? 'mt-2' : 'mt-1'}`}>
                  <span className="text-blue-600 dark:text-blue-400 font-extrabold text-sm transition-colors">{reward.cost} 🪙</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 transition-colors">{reward.stock === -1 ? t('parent.stock_infinite') : `剩 ${reward.stock}`}</span>
                </div>
              </div>

              {/* 🌟 管理员操作悬浮按钮栏适配 */}
              <div className={`flex gap-1 ${viewMode === 'grid' ? 'mt-3 justify-center border-t border-gray-100 dark:border-gray-700 pt-3' : 'ml-2 flex-col space-y-1'} transition-colors`}>
                <button onClick={() => openEdit(reward)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors"><Edit2 size={14}/></button>
                <button onClick={() => handleDelete(reward.id)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors"><Trash2 size={14}/></button>
                <button onClick={() => handleAdminRedeem(reward)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-green-500 dark:hover:text-green-400 bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors" title={t('parent.btn_admin_redeem')}><Send size={14}/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 挂载抽屉 */}
      <AddRewardDrawer 
        isOpen={isAddDrawerOpen} 
        onClose={() => setIsAddDrawerOpen(false)} 
        onSuccess={fetchInitData} 
        existingData={editingReward}
      />
      <AdminRedeemDrawer 
        isOpen={redeemDrawerOpen}
        onClose={() => setRedeemDrawerOpen(false)}
        onSuccess={fetchInitData}
        reward={redeemTargetReward}
      />
    </div>
  );
}