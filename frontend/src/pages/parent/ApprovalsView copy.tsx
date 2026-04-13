// frontend/src/pages/parent/ApprovalsView.tsx
import React, { useEffect, useState } from 'react';
import { useUserStore, Child } from '../../store'; 
import service, { ApiResponse } from '../../api/request';
import { appToast } from '../../utils/toast';

export interface ApprovalItem {
  id: string;
  child_id: string;
  type: 'reward_redemption' | 'score_adjustment';
  title: string;
  points: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

const ApprovalsView: React.FC = () => {
  const { currentFamilyId, childrenList, setChildrenList } = useUserStore();
  const [requests, setRequests] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentFamilyId) {
      fetchInitialData();
    }
  }, [currentFamilyId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [childRes, appRes] = await Promise.all([
        service.get<any, ApiResponse<Child[]>>('/children'),
        service.get<any, ApiResponse<ApprovalItem[]>>('/approvals/pending')
      ]);

      if (childRes.success) setChildrenList(childRes.data);
      if (appRes.success) setRequests(appRes.data);
    } catch (err) {
      console.error('Failed to fetch approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await service.post<any, ApiResponse>(`/approvals/${id}/${action}`, {});
      if (res.success) {
        appToast.success(action === 'approve' ? '已同意申请' : '已拒绝申请');
        setRequests(prev => prev.filter(req => req.id !== id));
      }
    } catch (err) {}
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-500 dark:text-gray-400 animate-pulse transition-colors">正在加载审批事项...</div>;
  }

  return (
    <div className="approvals-container p-4 pb-24 transition-colors duration-300">
      {/* 🌟 页面大标题 */}
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2 transition-colors">
        <span>✅</span> 待处理审批
      </h2>

      {requests.length === 0 ? (
        /* 🌟 空状态适配 */
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 transition-colors">
          <span className="text-4xl mb-3 block">🎉</span>
          <p className="text-gray-500 dark:text-gray-400 font-medium transition-colors">太棒了，当前没有任何待审批事项！</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req: ApprovalItem) => {
            const childInfo = childrenList.find(c => c.id === req.child_id);
            
            return (
              /* 🌟 卡片本体适配 */
              <div key={req.id} className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
                <div className="flex items-start gap-4 mb-4">
                  {/* 🌟 头像底色 */}
                  <div className="text-3xl bg-gray-50 dark:bg-gray-700 p-2 rounded-xl transition-colors">
                    {childInfo?.avatar || '👤'}
                  </div>
                  <div className="flex-1">
                    {/* 🌟 卡片文字信息颜色 */}
                    <p className="font-bold text-gray-800 dark:text-gray-100 text-lg transition-colors">
                      {childInfo?.name || '未知成员'} 
                      <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2 transition-colors">发起了申请</span>
                    </p>
                    <p className="text-gray-600 dark:text-gray-300 mt-1 transition-colors">{req.title}</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 transition-colors">
                      {new Date(req.created_at).toLocaleString()}
                    </p>
                  </div>
                  {/* 🌟 分数高亮颜色适配 */}
                  <div className={`font-bold text-xl transition-colors ${req.type === 'reward_redemption' ? 'text-orange-500 dark:text-orange-400' : 'text-blue-500 dark:text-blue-400'}`}>
                    {req.type === 'reward_redemption' ? '-' : '+'}{req.points}
                  </div>
                </div>

                <div className="flex gap-3 mt-2">
                  {/* 🌟 拒绝按钮适配：红 */}
                  <button 
                    onClick={() => handleAction(req.id, 'reject')}
                    className="flex-1 py-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                  >
                    拒绝
                  </button>
                  {/* 🌟 同意按钮适配：蓝 */}
                  <button 
                    onClick={() => handleAction(req.id, 'approve')}
                    className="flex-1 py-3 bg-blue-600 dark:bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 shadow-md shadow-blue-200 dark:shadow-none transition-all"
                  >
                    同意发放
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ApprovalsView;