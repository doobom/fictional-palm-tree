// frontend/src/pages/parent/ScoreActionDrawer.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserStore, Child } from '../../store'; // 🌟 导入正确的 Store 和 Child 接口
import service, { ApiResponse } from '../../api/request'; // 🌟 导入通用响应接口
import { appToast } from '../../utils/toast'; // 🌟 统一使用 appToast

export interface ScoreActionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  child: Child | null; // 明确传入的 child 类型
}

export default function ScoreActionDrawer({ isOpen, onClose, onSuccess, child }: ScoreActionDrawerProps) {
  const { t } = useTranslation();
  
  // 1. 获取全局状态和方法
  const { updateScoreLocal, families, currentFamilyId } = useUserStore();
  
  // 获取当前家庭配置（为了显示特定的积分 Emoji 和名称）
  const currentFamily = families.find(f => f.id === currentFamilyId);

  // 2. 本地表单状态
  const [actionType, setActionType] = useState<'add' | 'deduct'>('add');
  const [points, setPoints] = useState<number | ''>(''); // 允许为空以便用户自由输入
  const [remark, setRemark] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // 快捷分数预设
  const quickPoints = actionType === 'add' ? [1, 2, 5, 10] : [1, 5, 10, 20];

  // 3. 抽屉打开时重置状态
  useEffect(() => {
    if (isOpen) {
      setActionType('add');
      setPoints('');
      setRemark('');
    }
  }, [isOpen, child]);

  // 4. 提交积分变动
  const handleSubmit = async () => {
    if (!child) return;
    
    const numPoints = Number(points);
    if (!numPoints || numPoints <= 0) {
      appToast.warn('请输入有效的分数');
      return;
    }

    setLoading(true);
    try {
      // 计算最终分值（正数或负数）
      const finalPoints = actionType === 'add' ? numPoints : -Math.abs(numPoints);

      // 🌟 严格使用泛型，消除 res.success 报错
      const res = await service.post<any, ApiResponse>('/scores/adjust', {
        childId: child.id,
        points: finalPoints,
        remark: remark || (actionType === 'add' ? '手动奖励' : '手动扣除')
      });

      if (res.success) {
        appToast.success(`成功为 ${child.name} ${actionType === 'add' ? '增加' : '扣除'}了 ${numPoints} 分`);
        
        // 乐观更新 UI：触发本地 Store 更新，使 Dashboard 数字实时跳动
        updateScoreLocal(child.id, finalPoints);

        onSuccess?.();
        onClose();
      }
    } catch (err) {
      // 报错已由 request.ts 拦截器统一处理
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !child) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div 
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* 底部抽屉 */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-50 rounded-t-3xl z-50 transform transition-transform duration-300 max-h-[90vh] flex flex-col shadow-2xl">
        
        {/* 头部：展示目标成员信息 */}
        <div className="p-5 bg-white rounded-t-3xl border-b border-gray-100 relative">
          <button 
            onClick={onClose}
            className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"
          >
            ✕
          </button>
          <div className="flex flex-col items-center">
            <span className="text-4xl bg-gray-50 w-16 h-16 flex items-center justify-center rounded-2xl mb-2 shadow-sm">
              {child.avatar}
            </span>
            <h3 className="text-xl font-bold text-gray-800">
              调整 {child.name} 的积分
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              当前余额: <strong className="text-gray-800">{child.balance}</strong> {currentFamily?.point_name}
            </p>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-6">
          {/* 操作类型切换 */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => { setActionType('add'); setPoints(''); }}
              className={`flex-1 py-3 font-bold rounded-lg transition-all ${
                actionType === 'add' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              ➕ 奖励
            </button>
            <button
              onClick={() => { setActionType('deduct'); setPoints(''); }}
              className={`flex-1 py-3 font-bold rounded-lg transition-all ${
                actionType === 'deduct' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-500'
              }`}
            >
              ➖ 扣除
            </button>
          </div>

          {/* 表单输入区 */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-5">
            {/* 快捷按钮 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">快捷选择</label>
              <div className="flex gap-2">
                {quickPoints.map(val => (
                  <button
                    key={val}
                    onClick={() => setPoints(val)}
                    className={`flex-1 py-2 rounded-xl font-bold border-2 transition-all ${
                      points === val 
                        ? (actionType === 'add' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-red-500 bg-red-50 text-red-600')
                        : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {/* 手动输入 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                输入额度 ({currentFamily?.point_name || '积分'})
              </label>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{currentFamily?.point_emoji || '🪙'}</span>
                <input
                  type="number"
                  min="1"
                  value={points}
                  onChange={(e) => setPoints(parseInt(e.target.value) || '')}
                  className="flex-1 bg-gray-50 p-3 rounded-xl font-bold text-lg text-gray-800 border-none focus:ring-2 focus:ring-blue-100"
                  placeholder="自定义数值"
                />
              </div>
            </div>
            
            {/* 备注信息 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">操作原因 (选填)</label>
              <input
                type="text"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                className="w-full bg-gray-50 p-3 rounded-xl border-none focus:ring-2 focus:ring-blue-100"
                placeholder={actionType === 'add' ? '例如：主动洗碗' : '例如：没有按时完成作业'}
                maxLength={50}
              />
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="p-5 bg-white border-t border-gray-100">
          <button
            onClick={handleSubmit}
            disabled={loading || !points || Number(points) <= 0}
            className={`w-full py-4 rounded-2xl font-bold text-white text-lg transition-all active:scale-95 shadow-lg ${
              actionType === 'add' 
                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' 
                : 'bg-red-500 hover:bg-red-600 shadow-red-200'
            } disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed`}
          >
            {loading ? '处理中...' : `确认${actionType === 'add' ? '发放' : '扣除'}`}
          </button>
        </div>
      </div>
    </>
  );
}