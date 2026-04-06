// frontend/src/pages/parent/BatchActionDrawer.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserStore, Child } from '../../store'; // 🌟 导入正确的 Store 和数据接口
import service, { ApiResponse } from '../../api/request'; // 🌟 导入通用响应接口
import { appToast } from '../../utils/toast'; // 🌟 使用统一的 appToast

export interface BatchActionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function BatchActionDrawer({ isOpen, onClose, onSuccess }: BatchActionDrawerProps) {
  const { t } = useTranslation();
  
  // 1. 获取全局状态和方法
  const { childrenList, updateScoreLocal, families, currentFamilyId } = useUserStore();
  
  // 获取当前家庭配置（为了显示特定的积分 Emoji 和名称）
  const currentFamily = families.find(f => f.id === currentFamilyId);

  // 2. 本地表单状态
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [points, setPoints] = useState<number>(10);
  const [remark, setRemark] = useState<string>('');
  const [actionType, setActionType] = useState<'add' | 'deduct'>('add');
  const [loading, setLoading] = useState(false);

  // 3. 当抽屉打开时，默认全选所有孩子，并重置表单
  useEffect(() => {
    if (isOpen) {
      // 🌟 明确参数类型为 (c: Child) 消除 TS7006 报错
      setSelectedIds(childrenList.map((c: Child) => c.id));
      setPoints(10);
      setRemark('');
      setActionType('add');
    }
  }, [isOpen, childrenList]);

  // 4. 勾选逻辑
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === childrenList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(childrenList.map((c: Child) => c.id));
    }
  };

  // 5. 提交批量操作
  const handleSubmit = async () => {
    if (selectedIds.length === 0) {
      appToast.warn('请至少选择一名成员');
      return;
    }
    if (points <= 0) {
      appToast.warn('操作分值必须大于 0');
      return;
    }

    setLoading(true);
    try {
      const finalPoints = actionType === 'add' ? points : -Math.abs(points);

      // 🌟 严格使用泛型，消除 res.success 报错
      const res = await service.post<any, ApiResponse>('/scores/batch', {
        childIds: selectedIds,
        points: finalPoints,
        remark: remark || (actionType === 'add' ? '批量奖励' : '批量扣除')
      });

      if (res.success) {
        appToast.success(`成功为 ${selectedIds.length} 名成员${actionType === 'add' ? '发放' : '扣除'}了积分`);
        
        // 乐观更新 UI：循环更新本地 Store，触发 Dashboard 动画跳动
        selectedIds.forEach(id => {
          updateScoreLocal(id, finalPoints);
        });

        onSuccess?.();
        onClose();
      }
    } catch (err) {
      // 报错已由 request.ts 拦截器统一处理
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed bottom-0 left-0 right-0 bg-gray-50 rounded-t-3xl z-50 transform transition-transform duration-300 max-h-[90vh] flex flex-col shadow-2xl">
        {/* 头部 */}
        <div className="p-5 bg-white rounded-t-3xl border-b border-gray-100 relative">
          <button 
            onClick={onClose}
            className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"
          >
            ✕
          </button>
          <h3 className="text-xl font-bold text-gray-800 text-center">批量操作</h3>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-6">
          {/* 操作类型切换 */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setActionType('add')}
              className={`flex-1 py-3 font-bold rounded-lg transition-all ${
                actionType === 'add' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              ➕ 批量奖励
            </button>
            <button
              onClick={() => setActionType('deduct')}
              className={`flex-1 py-3 font-bold rounded-lg transition-all ${
                actionType === 'deduct' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-500'
              }`}
            >
              ➖ 批量扣除
            </button>
          </div>

          {/* 表单输入区 */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                设置额度 ({currentFamily?.point_name || '积分'})
              </label>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{currentFamily?.point_emoji || '🪙'}</span>
                <input
                  type="number"
                  min="1"
                  value={points || ''}
                  onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
                  className="flex-1 bg-gray-50 p-3 rounded-xl font-bold text-lg text-gray-800 border-none focus:ring-2 focus:ring-blue-100"
                  placeholder="输入数值"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">操作备注 (选填)</label>
              <input
                type="text"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                className="w-full bg-gray-50 p-3 rounded-xl border-none focus:ring-2 focus:ring-blue-100"
                placeholder={actionType === 'add' ? '例如：一起打扫了卫生' : '例如：一起玩游戏超时'}
                maxLength={50}
              />
            </div>
          </div>

          {/* 成员多选列表 */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                选择作用对象
              </span>
              <button 
                onClick={toggleAll}
                className="text-blue-600 text-sm font-bold"
              >
                {selectedIds.length === childrenList.length ? '取消全选' : '全选'}
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {/* 🌟 显式指定 (child: Child) 消除隐式 Any 报错 */}
              {childrenList.map((child: Child) => {
                const isSelected = selectedIds.includes(child.id);
                return (
                  <button
                    key={child.id}
                    onClick={() => toggleSelection(child.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                      isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white'
                    }`}
                  >
                    <span className="text-2xl">{child.avatar}</span>
                    <span className="flex-1 text-left font-bold text-gray-800 truncate">
                      {child.name}
                    </span>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                    }`}>
                      {isSelected && <span className="text-white text-[10px]">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="p-5 bg-white border-t border-gray-100">
          <button
            onClick={handleSubmit}
            disabled={loading || selectedIds.length === 0}
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