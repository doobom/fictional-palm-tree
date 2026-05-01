// frontend/src/pages/parent/ApprovalsView.tsx
import React, { useState, useEffect } from 'react';
import { Check, X, Image as ImageIcon, MessageSquare, ShieldCheck, ChevronRight, Gift, Sparkles } from 'lucide-react';
import service, { ApiResponse } from '../../api/request';
import { useUserStore } from '../../store';
import { appToast } from '../../utils/toast';
import { useTranslation } from 'react-i18next';

export default function ApprovalsView() {
  const { childrenList } = useUserStore();
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [finalPoints, setFinalPoints] = useState<number>(0);
  const [rejectReason, setRejectReason] = useState('');
  const { t } = useTranslation();

  useEffect(() => { fetchPendingApprovals(); }, []);

  const fetchPendingApprovals = async () => {
    setLoading(true);
    try {
      const res = await service.get<any, ApiResponse>('/approvals?status=pending');
      if (res.success) setApprovals(res.data);
    } catch (e) {} finally { setLoading(false); }
  };

  const handleReview = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !rejectReason.trim()) return appToast.error(t('parent.approval_reject_reason', '请输入驳回理由'));
    try {
      await service.put(`/approvals/${selectedTask.id}/review`, { action, finalPoints, rejectReason });
      appToast.success(action === 'approve' ? t('parent.approval_approved', '审批已通过！') : t('parent.approval_rejected', '已驳回申请'));
      setSelectedTask(null);
      fetchPendingApprovals();
    } catch (e) { appToast.error('操作失败'); }
  };

  const openReviewModal = (task: any) => {
    setSelectedTask(task);
    setFinalPoints(task.requested_points);
    setRejectReason('');
  };

  return (
    <div className="p-4 pb-24 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <ShieldCheck className="text-blue-500" size={24} />
        <h2 className="text-xl font-black text-gray-900 dark:text-white">{t('parent.title_approvals', '统一审核中心')}</h2>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 font-bold py-10 animate-pulse">{t('parent.approval_loading', '正在检索待办事项...')}</div>
      ) : approvals.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-[32px] p-8 text-center border border-gray-100 dark:border-gray-700">
          <Check size={32} className="text-green-500 mx-auto mb-4" />
          <h3 className="font-black text-gray-900 dark:text-white mb-2">{t('parent.approval_no_pending', '全部处理完毕')}</h3>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map(task => {
            const child = childrenList.find(c => c.id === task.child_id);
            const isReward = task.type === 'reward'; // 🌟 区分类型
            
            return (
              <div 
                key={task.id} onClick={() => openReviewModal(task)}
                className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md active:scale-[0.98] transition-all"
              >
                {/* 动态图标 */}
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${isReward ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-500' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-500'}`}>
                  {isReward ? <Gift size={24} /> : <Sparkles size={24} />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-black text-gray-900 dark:text-white truncate pr-2">
                      {task.title}
                      <span className="ml-2 text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md text-gray-500">{child?.name}</span>
                    </h4>
                    {/* 动态分值颜色 */}
                    <span className={`font-black whitespace-nowrap ${isReward ? 'text-orange-500' : 'text-blue-500'}`}>
                      {isReward ? '-' : '+'}{task.requested_points}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                    {task.evidence_image && <ImageIcon size={12} />}
                    {task.evidence_text || (isReward ? t('parent.approval_reward_request', '申请兑换奖励') : t('parent.approval_task_request', '申请任务加分'))}
                  </p>
                </div>
                <ChevronRight className="text-gray-300" size={20} />
              </div>
            );
          })}
        </div>
      )}

      {/* 审批弹窗 Modal (和之前基本一样，只需根据类型微调文案) */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTask(null)} />
          <div className="relative bg-white dark:bg-gray-800 w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95">
            
            <div className="flex items-center gap-2 mb-4">
               {selectedTask.type === 'reward' ? <Gift className="text-orange-500"/> : <Sparkles className="text-blue-500"/>}
               <h3 className="text-xl font-black text-gray-900 dark:text-white">
                 {selectedTask.type === 'reward' ? t('parent.approval_reward_request_title', '商品兑换审核') : t('parent.approval_task_request_title', '任务凭证审核')}
               </h3>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 mb-4 space-y-3">
              <p className="font-bold text-gray-800 dark:text-gray-200">{selectedTask.title}</p>
              {selectedTask.evidence_text && (
                <div className="flex gap-2 text-sm text-gray-600 bg-white p-3 rounded-xl"><MessageSquare size={16} /><p>{selectedTask.evidence_text}</p></div>
              )}
              {selectedTask.evidence_image && (
                <div className="w-full aspect-video rounded-xl overflow-hidden"><img src={selectedTask.evidence_image} className="w-full h-full object-cover" /></div>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-500 mb-2">
                {t('parent.approval_review_points', {type: selectedTask.type === 'reward' ? t('parent.approval_review_deduction', '核定扣除分数') : t('parent.approval_review_reward', '核定奖励分数')})}
              </label>
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 p-2 rounded-2xl">
                <button onClick={() => setFinalPoints(Math.max(0, finalPoints - 1))} className="w-10 h-10 bg-white rounded-xl shadow-sm font-bold">-</button>
                <input type="number" value={finalPoints} onChange={e => setFinalPoints(Number(e.target.value))} className={`flex-1 bg-transparent text-center text-xl font-black outline-none ${selectedTask.type === 'reward' ? 'text-orange-500' : 'text-blue-600'}`} />
                <button onClick={() => setFinalPoints(finalPoints + 1)} className="w-10 h-10 bg-white rounded-xl shadow-sm font-bold">+</button>
              </div>
            </div>

            <div className="flex gap-3">
              <input type="text" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder={t('parent.approval_reject_reason_placeholder', '驳回理由')} className="flex-1 p-3 bg-gray-100 rounded-2xl outline-none text-sm" />
              <button onClick={() => handleReview('reject')} className="px-4 bg-gray-200 hover:bg-red-100 text-gray-600 hover:text-red-500 font-bold rounded-2xl">{t('parent.approval_reject', '驳回')}</button>
            </div>
            <button onClick={() => handleReview('approve')} className="w-full mt-3 py-3.5 bg-blue-600 text-white font-black rounded-2xl shadow-lg flex items-center justify-center gap-2">
              <Check size={18} /> {t('parent.approval_approve', '同意并')} {selectedTask.type === 'reward' ? t('parent.approval_review_deduction', '扣分') : t('parent.approval_review_reward', '发放')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}