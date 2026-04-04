// src/pages/parent/ApprovalsView.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import api from '../../api/request';
import { useAppStore } from '../../store';
import { appToast } from '../../utils/toast'; // 🌟 引入

export default function ApprovalsView() {
  const { t } = useTranslation();
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { setChildrenList } = useAppStore();

  const fetchPending = async () => {
    try {
      const res: any = await api.get('/rewards/pending');
      setPendingList(res.data);
    } catch (err) {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (redemptionId: string, action: 'approved' | 'rejected') => {
    try {
      await api.post('/rewards/approve', { redemptionId, action });
      setPendingList(prev => prev.filter(item => item.id !== redemptionId));
      
      const childRes: any = await api.get('/children/list');
      setChildrenList(childRes.data);

      // 🌟 动态判断是同意还是拒绝的 Toast
      if (action === 'approved') {
        appToast.success(t('parent.approve_success', '已同意兑换！'));
      } else {
        appToast.success(t('parent.reject_success', '已拒绝兑换'));
      }
    } catch (err) {}
  };

  if (loading) return <div className="p-4 text-center text-gray-400">...</div>;

  if (pendingList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <CheckCircle2 size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
        <p>{t('parent.empty_approvals')}</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {pendingList.map((item) => {
        const snapshot = JSON.parse(item.reward_snapshot || '{}');
        
        return (
          <div key={item.id} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-bottom-2">
            
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-xl">
                  {item.avatar || '👦'}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    {t('parent.approval_request', { name: item.child_name })}
                  </h3>
                  <div className="flex items-center text-xs text-gray-500 mt-1">
                    <Clock size={12} className="mr-1" />
                    {new Date(item.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 flex justify-between items-center mb-5">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{snapshot.emoji}</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{snapshot.name}</span>
              </div>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {snapshot.cost}
              </span>
            </div>

            <div className="flex space-x-3">
              <button 
                onClick={() => handleApprove(item.id, 'rejected')}
                className="flex-1 flex items-center justify-center py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400 font-medium active:scale-95 transition-all"
              >
                <XCircle size={18} className="mr-1.5" />
                {t('parent.btn_reject')}
              </button>
              <button 
                onClick={() => handleApprove(item.id, 'approved')}
                className="flex-1 flex items-center justify-center py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 active:scale-95 transition-all shadow-sm"
              >
                <CheckCircle2 size={18} className="mr-1.5" />
                {t('parent.btn_approve_deduct')}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}