import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import api from '../../api/request';
import { appToast } from '../../utils/toast'; // 🌟 引入全局 Toast

interface AddRewardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingData?: any; // 🌟 新增：用于编辑回显
}

export default function AddRewardDrawer({ isOpen, onClose, onSuccess, existingData }: AddRewardDrawerProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  
  // 表单状态
  const [emoji, setEmoji] = useState('🎁');
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('');
  const [requireApproval, setRequireApproval] = useState(true);
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<any[]>([]);

  // 当抽屉打开时，拉取分类列表
  // 获取分类列表
  useEffect(() => {
    if (isOpen) {
      api.get('/categories/list').then((res: any) => setCategories(res.data)).catch(()=>{});
    }
  }, [isOpen]);

  // 回显数据逻辑
  useEffect(() => {
    if (isOpen) {
      if (existingData) {
        setEmoji(existingData.emoji || '🎁');
        setName(existingData.name || '');
        setCost(existingData.cost?.toString() || '');
        setStock(existingData.stock === -1 ? '' : existingData.stock?.toString() || '');
        setRequireApproval(existingData.require_approval === 1);
        setCategoryId(existingData.category_id || '');
      } else {
        // 清空重置
        setEmoji('🎁'); setName(''); setCost(''); setStock(''); setRequireApproval(true); setCategoryId('');
      }
    }
  }, [isOpen, existingData]);

  // 🚨 绝对不要在这里写 if (!isOpen) return null; 否则退出动画会失效！

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !cost) return;

    setLoading(true);
    try {
      // 🌟 修改点 1：把 /rewards/add 换成你现在的 upsert 路由
      await api.post('/rewards/manage/upsert', {
        id: existingData?.id, // 如果是编辑，带上ID
        name, emoji,
        cost: parseInt(cost, 10),
        stock: stock === '' ? -1 : parseInt(stock, 10),
        require_approval: requireApproval ? 1 : 0,
        categoryId: categoryId || null // 🌟 传给后端
      });
      
      onSuccess();
      onClose();
      // 🌟 弹出成功提示
      appToast.success(t('parent.add_reward_success', '奖品上架成功！'));
    } catch (err) {
      // 错误由请求拦截器统一处理
    } finally {
      setLoading(false);
    }
  };

  return (
    /* 🌟 外层容器：控制点击穿透。
       isOpen 为 false 时，pointer-events-none 保证它不会挡住底部页面的点击 */
    <div className={`fixed inset-0 z-[110] ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      
      {/* 🌟 背景遮罩：纯粹负责透明度渐变 (Fade) */}
      <div 
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      
      {/* 🌟 抽屉面板：负责上下位移滑动 (Slide) 
          使用了 ease-out 让滑出时有减速的阻尼感，退出时滑出屏幕底部 translate-y-full */}
      <div 
        className={`absolute inset-x-0 bottom-0 bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl pb-safe transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* 顶部的原生拖拽把手 (纯视觉装饰，增加原生感) */}
        <div className="w-full flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        </div>

        <div className="px-6 pb-6 pt-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('parent.add_reward_title')}
            </h3>
            <button 
              onClick={onClose} 
              className="p-2 text-gray-400 hover:text-gray-600 bg-gray-100 dark:bg-gray-700 rounded-full active:scale-90 transition-transform"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 🌟 第一行：图标与名称 */}
            <div className="flex space-x-4">
              <div className="w-1/4 flex flex-col">
                {/* label 加上 truncate 防止多语言换行导致高度不一 */}
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 truncate">
                  {t('parent.reward_emoji')}
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  // 🌟 核心修复：移除 py-3，换成固定的 h-12
                  className="h-12 w-full px-2 text-center text-2xl rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
              
              <div className="w-3/4 flex flex-col">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 truncate">
                  {t('parent.reward_name')}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('parent.reward_name_placeholder')}
                  // 🌟 核心修复：移除 py-3，换成固定的 h-12
                  className="h-12 w-full px-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* 🌟 第二行：金币与库存 (为了视觉统一，也全部换成 h-12) */}
            <div className="flex space-x-4">
              <div className="w-1/2 flex flex-col">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 truncate">
                  {t('parent.reward_cost')}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder={t('parent.reward_cost_placeholder')}
                  className="h-12 w-full px-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div className="w-1/2 flex flex-col">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 truncate">
                  {t('parent.reward_stock')}
                </label>
                <input
                  type="number"
                  min="1"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="∞"
                  className="h-12 w-full px-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('parent.category_label')}</label>
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                className="h-12 w-full px-4 rounded-lg border bg-gray-50 focus:ring-2 focus:ring-blue-500">
                <option value="">{t('parent.unclassified')}</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl mt-2 border border-gray-100 dark:border-gray-600">
              <div>
                <p className="font-medium text-gray-900 dark:text-white text-sm">
                  {t('parent.reward_require_approval')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('parent.reward_require_approval_desc')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={requireApproval}
                  onChange={(e) => setRequireApproval(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-6 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white rounded-xl font-bold text-lg transition-all shadow-md active:scale-[0.98]"
            >
              {loading ? t('parent.btn_submitting') : t('parent.btn_confirm_add')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}