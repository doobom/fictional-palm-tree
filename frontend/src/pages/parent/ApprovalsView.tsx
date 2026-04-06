// frontend/src/pages/parent/ApprovalsView.tsx
import React, { useEffect, useState } from 'react';
import { useUserStore, Child } from '../../store'; // 🌟 导入完整的 Store 和 Child 接口
import service, { ApiResponse } from '../../api/request'; // 🌟 导入标准响应接口
import { appToast } from '../../utils/toast'; // 根据你的实际路径调整

// 1. 定义审批项的数据结构
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
  // 2. 从 Store 中获取当前家庭状态与孩子列表
  const { currentFamilyId, childrenList, setChildrenList } = useUserStore();
  
  const [requests, setRequests] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 3. 监听家庭切换，自动拉取数据
  useEffect(() => {
    if (currentFamilyId) {
      fetchInitialData();
    }
  }, [currentFamilyId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 并行请求：同时获取孩子列表（用于显示头像）和待审批列表
      // 🌟 严格使用泛型，消除 res.success 报错
      const [childRes, appRes] = await Promise.all([
        service.get<any, ApiResponse<Child[]>>('/children'),
        service.get<any, ApiResponse<ApprovalItem[]>>('/approvals/pending')
      ]);

      if (childRes.success) {
        setChildrenList(childRes.data); // 🌟 setChildrenList 不再报错
      }
      if (appRes.success) {
        setRequests(appRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 4. 处理审批操作 (同意/拒绝)
   */
  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      // 🌟 严格指定提交泛型
      const res = await service.post<any, ApiResponse>(`/approvals/${id}/${action}`, {});

      if (res.success) {
        appToast.success(action === 'approve' ? '已同意申请' : '已拒绝申请');
        // 乐观更新 UI：将处理过的项从列表中移除
        setRequests(prev => prev.filter(req => req.id !== id));
      }
    } catch (err) {
      // 错误已由拦截器自动提示
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-500 animate-pulse">正在加载审批事项...</div>;
  }

  return (
    <div className="approvals-container p-4 pb-24">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <span>✅</span> 待处理审批
      </h2>

      {requests.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
          <span className="text-4xl mb-3 block">🎉</span>
          <p className="text-gray-500 font-medium">太棒了，当前没有任何待审批事项！</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 🌟 显式声明 req 的类型，消除 TS7006 隐式 any 报错 */}
          {requests.map((req: ApprovalItem) => {
            // 从 Store 的孩子列表中匹配头像和名字
            const childInfo = childrenList.find(c => c.id === req.child_id);
            
            return (
              <div key={req.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-start gap-4 mb-4">
                  <div className="text-3xl bg-gray-50 p-2 rounded-xl">
                    {childInfo?.avatar || '👤'}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800 text-lg">
                      {childInfo?.name || '未知成员'} 
                      <span className="text-sm font-normal text-gray-500 ml-2">发起了申请</span>
                    </p>
                    <p className="text-gray-600 mt-1">{req.title}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {new Date(req.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className={`font-bold text-xl ${req.type === 'reward_redemption' ? 'text-orange-500' : 'text-blue-500'}`}>
                    {req.type === 'reward_redemption' ? '-' : '+'}{req.points}
                  </div>
                </div>

                <div className="flex gap-3 mt-2">
                  <button 
                    onClick={() => handleAction(req.id, 'reject')}
                    className="flex-1 py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors"
                  >
                    拒绝
                  </button>
                  <button 
                    onClick={() => handleAction(req.id, 'approve')}
                    className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md shadow-blue-200 transition-all"
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