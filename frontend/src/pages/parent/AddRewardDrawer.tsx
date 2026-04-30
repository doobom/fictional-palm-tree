// frontend/src/pages/parent/AddRewardDrawer.tsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import api from '../../api/request';
import { appToast } from '../../utils/toast';

interface AddRewardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingData?: any;
}

export default function AddRewardDrawer({ isOpen, onClose, onSuccess, existingData }: AddRewardDrawerProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  
  const [emoji, setEmoji] = useState('🎁');
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('');
  const [requireApproval, setRequireApproval] = useState(true);
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      api.get('/categories/list').then((res: any) => setCategories(res.data)).catch(()=>{});
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (existingData) {
        setEmoji(existingData.emoji || '🎁'); setName(existingData.name || ''); setCost(existingData.cost?.toString() || '');
        setStock(existingData.stock === -1 ? '' : existingData.stock?.toString() || '');
        setRequireApproval(existingData.require_approval === 1); setCategoryId(existingData.category_id || '');
      } else {
        setEmoji('🎁'); setName(''); setCost(''); setStock(''); setRequireApproval(true); setCategoryId('');
      }
    }
  }, [isOpen, existingData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !cost) return;

    setLoading(true);
    try {
      await api.post('/rewards/manage/upsert', {
        id: existingData?.id,
        name, emoji, cost: parseInt(cost, 10), stock: stock === '' ? -1 : parseInt(stock, 10),
        require_approval: requireApproval ? 1 : 0, categoryId: categoryId || null
      });
      onSuccess(); onClose();
      appToast.success(t('parent.reward_add_success', '奖品上架成功！'));
    } finally { setLoading(false); }
  };

  const drawerContent = (
    <div className={`fixed inset-0 z-[9999] ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/40 dark:bg-black/60 transition-opacity duration-300 ease-out ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      
      <div className={`absolute inset-x-0 bottom-0 bg-white dark:bg-gray-900 rounded-t-[24px] flex flex-col transform transition-transform duration-300 ease-out max-h-[90vh] ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="w-full flex justify-center pt-3 pb-2"><div className="w-10 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full" /></div>

        <div className="px-5 pb-2 relative transition-colors">
          <button onClick={onClose} className="absolute right-5 top-0 w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400 font-bold">✕</button>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{existingData ? t('parent.reward_edit') : t('parent.reward_add')}</h3>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <form id="rewardForm" onSubmit={handleSubmit} className="space-y-4">
            <div className="flex space-x-3">
              <div className="w-1/4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.emoji')}</label>
                <input type="text" maxLength={2} value={emoji} onChange={(e) => setEmoji(e.target.value)} className="h-12 w-full px-2 text-center text-2xl rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-colors" />
              </div>
              <div className="w-3/4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.name')}</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder={t('parent.reward_name_placeholder')} className="h-12 w-full px-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-colors font-medium" />
              </div>
            </div>

            <div className="flex space-x-3">
              <div className="w-1/2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('parent.reward_cost_label')}</label>
                <input type="number" required min="1" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" className="h-12 w-full px-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-colors font-medium" />
              </div>
              <div className="w-1/2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('parent.reward_stock_label')}</label>
                <input type="number" min="1" value={stock} onChange={(e) => setStock(e.target.value)} placeholder={t('parent.reward_stock_placeholder')} className="h-12 w-full px-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-colors font-medium" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('parent.reward_category_label')}</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="h-12 w-full px-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none border-none transition-colors">
                <option value="">{t('parent.reward_category_none')}</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl mt-2 transition-colors">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100 text-sm transition-colors">{t('parent.reward_require_approval')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">{t('parent.reward_require_approval_desc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>
          </form>
        </div>

        <div className="p-5 pt-2 bg-white dark:bg-gray-900 transition-colors" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 20px)' }}>
          <button type="submit" form="rewardForm" disabled={loading} className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 text-white rounded-xl font-semibold text-lg transition-colors">
            {loading ? t('common.submitting') : t('parent.reward_save_btn', 'Save Reward')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}