// src/pages/parent/AdminRedeemDrawer.tsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, CheckCircle2 } from 'lucide-react';
import api from '../../api/request';
import { useAppStore } from '../../store';
import { appToast } from '../../utils/toast';

interface AdminRedeemDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reward: any; // 当前要兑换的商品
}

export default function AdminRedeemDrawer({ isOpen, onClose, onSuccess, reward }: AdminRedeemDrawerProps) {
  const { t } = useTranslation();
  const { childrenList } = useAppStore();
  
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);

  // 打开时初始化状态
  useEffect(() => {
    if (isOpen) {
      setSelectedChildId(childrenList.length > 0 ? childrenList[0].id : '');
      setRemark(t('parent.admin_redeem_title', '管理员代兑换')); // 默认备注
    }
  }, [isOpen, childrenList]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChildId || !reward) return;

    setLoading(true);
    try {
      await api.post('/rewards/admin-redeem', {
        childId: selectedChildId,
        rewardId: reward.id,
        remark: remark.trim(),
        status: 'approved' // 管理员代换，直接标记为已发放
      });
      appToast.success(t('parent.admin_redeem_success', '代兑换成功，已扣除积分并减库存'));
      onSuccess();
      onClose();
    } catch (err) {
      // 错误已经由 request.ts 拦截器统一提示
    } finally {
      setLoading(false);
    }
  };

  if (!reward) return null;

  return (
    <div className={`fixed inset-0 z-[110] ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      {/* 遮罩层 */}
      <div className={`absolute inset-0 bg-black/40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      
      {/* 底部抽屉主体 */}
      <div className={`absolute inset-x-0 bottom-0 bg-white dark:bg-gray-800 rounded-t-[32px] shadow-2xl pb-safe transition-transform duration-300 ease-out transform ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="px-6 pb-6 pt-5">
          {/* 标题栏 */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">{t('parent.admin_redeem_title', '管理员代兑换')}</h3>
            <button type="button" onClick={onClose} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500">
              <X size={20}/>
            </button>
          </div>
          
          {/* 商品信息展示卡片 */}
          <div className="flex items-center space-x-4 mb-6 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-600">
            <div className="text-4xl">{reward.emoji || '🎁'}</div>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white">{reward.name}</h4>
              <p className="text-blue-600 dark:text-blue-400 font-bold text-sm mt-1">
                 {reward.cost} {t('parent.points')}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 孩子选择网格 */}
            <div>
              <label className="block text-sm font-medium mb-2">{t('parent.select_child', '选择兑换给谁')}</label>
              <div className="grid grid-cols-2 gap-3">
                {childrenList.map(child => (
                  <div 
                    key={child.id} 
                    onClick={() => setSelectedChildId(child.id)}
                    className={`flex items-center p-3 rounded-2xl border cursor-pointer transition-all active:scale-95 ${selectedChildId === child.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'}`}
                  >
                    <div className="text-2xl mr-2">{child.avatar || '👦'}</div>
                    <div className="flex-1 font-medium text-gray-900 dark:text-white truncate text-sm">{child.name}</div>
                    {selectedChildId === child.id && <CheckCircle2 size={18} className="text-blue-500" />}
                  </div>
                ))}
              </div>
            </div>
            
            {/* 备注输入 */}
            <div>
              <label className="block text-sm font-medium mb-1">{t('parent.batch_remark', '操作备注 (选填)')}</label>
              <input type="text" value={remark} onChange={e => setRemark(e.target.value)} placeholder={t('parent.admin_redeem_remark_ph', '例如：期末考试奖励')}
                className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            
            <button type="submit" disabled={loading || !selectedChildId} className="w-full py-3.5 mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold active:scale-95 transition-all shadow-lg shadow-blue-200 dark:shadow-none disabled:bg-gray-400 disabled:active:scale-100 disabled:shadow-none">
              {loading ? '...' : t('parent.btn_confirm', '确定')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}