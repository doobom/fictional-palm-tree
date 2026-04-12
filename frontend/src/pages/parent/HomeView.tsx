// frontend/src/pages/parent/HomeView.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Minus, CheckSquare, RefreshCw, Star, ArrowRightLeft, ReceiptText, TrendingUp, BarChart3 } from 'lucide-react';
import { useUserStore, Child, Family } from '../../store';
import service, { ApiResponse } from '../../api/request';
import ScoreActionDrawer from './ScoreActionDrawer';
import BatchActionDrawer from './BatchActionDrawer';
import RulesManagerDrawer from './RulesManagerDrawer';
import HistoryDrawer from './HistoryDrawer';
import StatisticsDrawer from './StatisticsDrawer';
import FamilyStatsDrawer from './FamilyStatsDrawer';

export default function HomeView() {
  const { t } = useTranslation();
  const { currentFamilyId, families, childrenList, setChildrenList } = useUserStore();
  const currentFamily = families.find((f: Family) => f.id === currentFamilyId);
  const myRole = currentFamily?.role || 'viewer';

  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 抽屉控制状态
  const [activeChild, setActiveChild] = useState<Child | null>(null);
  // 🌟 1. 增加控制积分调整抽屉的 State
  const [scoreDrawerOpen, setScoreDrawerOpen] = useState(false);
  const [initialScoreAction, setInitialScoreAction] = useState<'add' | 'deduct'>('add'); // 🌟 新增：记录点的是加分还是减分
  // 🌟 2. 增加控制批量操作抽屉的 State
  const [batchDrawerOpen, setBatchDrawerOpen] = useState(false);
  // 🌟 3. 增加控制规则管理抽屉的 State
  const [rulesManagerOpen, setRulesManagerOpen] = useState(false);
  // 🌟 4. 增加控制流水抽屉的 State
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  // 🌟 5. 增加控制统计抽屉的 State
  const [statsDrawerOpen, setStatsDrawerOpen] = useState(false);
  const [selectedChildForStats, setSelectedChildForStats] = useState<any>(null);

  const openStats = (child: any) => {
    setSelectedChildForStats(child);
    setStatsDrawerOpen(true);
  };
  
  // 🌟 6. 增加控制家庭统计抽屉的 State
  const [familyStatsOpen, setFamilyStatsOpen] = useState(false);

  const fetchDashboardData = async () => {
    if (!currentFamilyId) return;
    setLoading(true);
    try {
      const [childRes, ruleRes]: any = await Promise.all([
        service.get('/children'),
        service.get('/rules')
      ]);
      setChildrenList(childRes.data);
      setRules(ruleRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [currentFamilyId]);

  const openScoreAction = (child: Child, action: 'add' | 'deduct') => {
    setActiveChild(child);
    setInitialScoreAction(action);
    setScoreDrawerOpen(true);
  };

  const openBatchAction = () => {
    setBatchDrawerOpen(true);
  };

  if (!currentFamilyId) {
    return <div className="p-10 text-center text-gray-500 dark:text-gray-400 font-bold transition-colors">请先选择家庭</div>;
  }

  return (
    <div className="p-4 pb-24 space-y-6 transition-colors duration-300">
      
      {/* =======================
          1. 孩子积分卡片区
      ======================= */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white transition-colors">{t('parent.title_home')}</h2>
          <button 
            onClick={() => setHistoryDrawerOpen(true)}
            className="flex items-center gap-1 text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all"
          >
            <ReceiptText size={16} />
            <span>历史明细</span>
          </button>
          <button 
             onClick={() => setFamilyStatsOpen(true)}
             className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl transition-all active:scale-95"
           >
             <BarChart3 size={20} />
           </button>
          <button onClick={fetchDashboardData} className="p-2 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 active:rotate-180 transition-all">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {childrenList.length === 0 && !loading ? (
          <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border-2 border-dashed border-gray-200 dark:border-gray-700 transition-colors">
            <p className="text-gray-500 dark:text-gray-400 font-bold transition-colors">{t('parent.empty_children')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {childrenList.map((child: Child) => (
              /* 🌟 卡片颜色适配 */
              <div key={child.id} className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden transition-colors duration-300">
                <button 
                    onClick={() => openStats(child)}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-blue-500 transition-colors"
                    >
                    <TrendingUp size={20} />
                </button>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-4xl bg-gray-50 dark:bg-gray-700 p-2 rounded-2xl shadow-sm transition-colors">{child.avatar}</span>
                </div>
                <h3 className="font-extrabold text-gray-800 dark:text-gray-100 text-lg truncate transition-colors">{child.name}</h3>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight transition-colors">{child.balance}</span>
                  <span className="text-sm font-bold text-gray-400 dark:text-gray-500 transition-colors">{currentFamily?.point_emoji}</span>
                </div>
                
                {myRole !== 'viewer' && (
                  <div className="mt-4 flex gap-2">
                    {/* 🌟 卡片内按钮适配 */}
                    <button onClick={() => openScoreAction(child, 'add')} className="flex-1 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                      <Plus size={20} strokeWidth={3} />
                    </button>
                    <button onClick={() => openScoreAction(child, 'deduct')} className="flex-1 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                      <Minus size={20} strokeWidth={3} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* 🌟 批量操作按钮适配 */}
        {myRole !== 'viewer' && childrenList.length > 1 && (
          <button onClick={openBatchAction} className="w-full mt-4 py-4 bg-gray-900 dark:bg-gray-800 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all">
            <ArrowRightLeft size={20} />
            批量调整积分
          </button>
        )}
      </section>

      {/* =======================
          2. 家庭规则/任务看板
      ======================= */}
      <section className="pt-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2 transition-colors"><Star className="text-yellow-400" /> 家庭规则</h2>
          {myRole !== 'viewer' && (
            /* 🌟 绑定 onClick 事件 */
            <button 
              onClick={() => setRulesManagerOpen(true)} 
              className="text-blue-600 dark:text-blue-400 font-bold text-sm bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full transition-colors active:scale-95"
            >
              管理规则
            </button>
          )}
        </div>

        {rules.length === 0 && !loading ? (
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 transition-colors">
            <p className="text-gray-400 dark:text-gray-500 font-bold text-sm transition-colors">暂无设立的家庭规则</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map(rule => (
              /* 🌟 列表卡片适配 */
              <div key={rule.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{rule.emoji || '⭐'}</span>
                  <div>
                    <p className="font-bold text-gray-800 dark:text-gray-100 transition-colors">{rule.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium transition-colors">适用于: {rule.child_id ? childrenList.find(c => c.id === rule.child_id)?.name : '所有人'}</p>
                  </div>
                </div>
                <div className={`font-black text-lg transition-colors ${rule.points > 0 ? 'text-blue-500 dark:text-blue-400' : 'text-red-500 dark:text-red-400'}`}>
                  {rule.points > 0 ? '+' : ''}{rule.points}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 🌟 1. 挂载操作抽屉 */}
      <ScoreActionDrawer 
        isOpen={scoreDrawerOpen} 
        onClose={() => setScoreDrawerOpen(false)} 
        onSuccess={fetchDashboardData}
        child={activeChild} 
        initialAction={initialScoreAction} // 🌟 传递初始操作类型到抽屉组件
      />
      {/* 🌟 2. 挂载批量操作抽屉 */}
      <BatchActionDrawer 
        isOpen={batchDrawerOpen} 
        onClose={() => setBatchDrawerOpen(false)} 
      />
      {/* 🌟 3. 挂载规则管理抽屉 */}
      <RulesManagerDrawer 
        isOpen={rulesManagerOpen}
        onClose={() => setRulesManagerOpen(false)}
        onSuccess={fetchDashboardData}
      />
      {/* 🌟 4. 挂载流水抽屉 */}
      <HistoryDrawer 
        isOpen={historyDrawerOpen} 
        onClose={() => setHistoryDrawerOpen(false)} 
        onSuccess={fetchDashboardData}
      />
      {/* 🌟 5. 挂载统计抽屉 */}
      <StatisticsDrawer 
        isOpen={statsDrawerOpen} 
        onClose={() => setStatsDrawerOpen(false)} 
        child={selectedChildForStats}
      />
      {/* 🌟 6. 挂载家庭统计抽屉 */}
      <FamilyStatsDrawer 
        isOpen={familyStatsOpen} 
        onClose={() => setFamilyStatsOpen(false)} 
      />
    </div>
  );
}