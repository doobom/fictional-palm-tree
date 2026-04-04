import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import api from '../../api/request';
import { useAppStore } from '../../store';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'plus' | 'minus';
  childId: string;
  childName: string;
  onSuccess: () => void; // 操作成功后的回调（用于刷新首页数据）
}

export default function ScoreActionDrawer({ isOpen, onClose, type, childId, childName, onSuccess }: DrawerProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'rules' | 'custom'>('rules');
  const [rules, setRules] = useState<any[]>([]);
  
  // 自定义表单状态
  const [customPoints, setCustomPoints] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);

  // 当抽屉打开时，拉取当前家庭的规则列表
  useEffect(() => {
    if (isOpen) {
      // 假设你后端有一个获取规则的接口，按类型(加分/扣分)过滤
      // 如果后端还没写这个接口，我稍后可以补给你
      api.get('/family/rules').then((res: any) => {
        // 前端简单过滤：加分拿正数规则，扣分拿负数规则
        const filtered = res.data.filter((r: any) => type === 'plus' ? r.points > 0 : r.points < 0);
        setRules(filtered);
      }).catch(() => {});
    }
  }, [isOpen, type]);

  // 重置状态
  useEffect(() => {
    if (!isOpen) {
      setCustomPoints('');
      setCustomReason('');
      setRules([]);
      setActiveTab('rules');
    }
  }, [isOpen]);

  // 核心：提交分数变动
  const handleSubmit = async (ruleId?: string, points?: number, desc?: string) => {
    setLoading(true);
    try {
      const payload = {
        childId,
        ruleId: ruleId || null,
        points: points || (type === 'minus' ? -Math.abs(Number(customPoints)) : Math.abs(Number(customPoints))),
        description: desc || customReason
      };

      await api.post('/scores/adjust', payload);
      onSuccess(); // 通知父组件刷新数据
      onClose();   // 关闭抽屉
    } catch (err) {
      // 错误已经由拦截器处理
    } finally {
      setLoading(false);
    }
  };

  // 动画控制：如果没打开，不渲染内容
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* 背景遮罩层 (点击可关闭) */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" 
        onClick={onClose}
      />

      {/* 抽屉面板本体 */}
      <div className="relative bg-white dark:bg-gray-800 w-full rounded-t-3xl shadow-2xl p-6 pb-safe animate-in slide-in-from-bottom duration-300 ease-out">
        
        {/* 顶部把手与标题 */}
        <div className="flex justify-between items-center mb-6">
          <h2 className={`text-lg font-bold ${type === 'plus' ? 'text-green-600' : 'text-red-500'}`}>
            {type === 'plus' ? t('parent.drawer_add_title', { name: childName }) : t('parent.drawer_minus_title', { name: childName })}
          </h2>
          <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* 选项卡切换 */}
        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl mb-6">
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'rules' ? 'bg-white dark:bg-gray-800 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {t('parent.tab_rules')}
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'custom' ? 'bg-white dark:bg-gray-800 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {t('parent.tab_custom')}
          </button>
        </div>

        {/* 视图 A：选择常规规则 */}
        {activeTab === 'rules' && (
          <div className="max-h-[50vh] overflow-y-auto space-y-3 pb-4 scrollbar-hide">
            {rules.length > 0 ? rules.map((rule) => (
              <button
                key={rule.id}
                disabled={loading}
                onClick={() => handleSubmit(rule.id, rule.points, rule.name)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-2xl transition border border-transparent active:border-blue-500"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{rule.emoji}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{rule.name}</span>
                </div>
                <span className={`font-bold ${rule.points > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {rule.points > 0 ? '+' : ''}{rule.points}
                </span>
              </button>
            )) : (
              <div className="text-center py-6 text-gray-400 text-sm">暂无对应的规则记录</div>
            )}
          </div>
        )}

        {/* 视图 B：自定义输入 */}
        {activeTab === 'custom' && (
          <div className="space-y-4 pb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('parent.custom_points')}
              </label>
              <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-bold text-lg ${type === 'plus' ? 'text-green-500' : 'text-red-500'}`}>
                  {type === 'plus' ? '+' : '-'}
                </span>
                <input
                  type="number"
                  value={customPoints}
                  onChange={(e) => setCustomPoints(e.target.value)}
                  placeholder={t('parent.custom_points_ph')}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('parent.custom_reason')}
              </label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder={t('parent.custom_reason_ph')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <button
              disabled={loading || !customPoints || Number(customPoints) <= 0}
              onClick={() => handleSubmit()}
              className={`w-full py-4 mt-4 rounded-xl font-bold text-white transition-colors ${
                type === 'plus' 
                  ? 'bg-green-500 hover:bg-green-600 disabled:bg-green-300' 
                  : 'bg-red-500 hover:bg-red-600 disabled:bg-red-300'
              }`}
            >
              {loading ? '...' : t('parent.btn_confirm')}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}