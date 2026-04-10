// frontend/src/pages/parent/HomeView.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Minus, CheckSquare, RefreshCw, Star, ArrowRightLeft } from 'lucide-react';
import { useUserStore, Child, Family } from '../../store';
import service, { ApiResponse } from '../../api/request';
import ScoreActionDrawer from './ScoreActionDrawer';
import BatchActionDrawer from './BatchActionDrawer';

export default function HomeView() {
  const { t } = useTranslation();
  const { currentFamilyId, families, childrenList, setChildrenList } = useUserStore();
  const currentFamily = families.find((f: Family) => f.id === currentFamilyId);
  const myRole = currentFamily?.role || 'viewer';

  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 抽屉控制状态
  const [activeChild, setActiveChild] = useState<Child | null>(null);
  const [scoreDrawerOpen, setScoreDrawerOpen] = useState(false);
  const [batchDrawerOpen, setBatchDrawerOpen] = useState(false);

  const [initialScoreAction, setInitialScoreAction] = useState<'add' | 'deduct'>('add'); // 🌟 新增：记录点的是加分还是减分

  const fetchDashboardData = async () => {
    if (!currentFamilyId) return;
    setLoading(true);
    try {
      const [childRes, goalRes]: any = await Promise.all([
        service.get('/children'),
        service.get('/goals')
      ]);
      setChildrenList(childRes.data);
      setGoals(goalRes.data);
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
            <button className="text-blue-600 dark:text-blue-400 font-bold text-sm bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full transition-colors">管理规则</button>
          )}
        </div>

        {goals.length === 0 && !loading ? (
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 transition-colors">
            <p className="text-gray-400 dark:text-gray-500 font-bold text-sm transition-colors">暂无设立的家庭规则</p>
          </div>
        ) : (
          <div className="space-y-3">
            {goals.map(goal => (
              /* 🌟 列表卡片适配 */
              <div key={goal.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{goal.emoji || '⭐'}</span>
                  <div>
                    <p className="font-bold text-gray-800 dark:text-gray-100 transition-colors">{goal.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium transition-colors">适用于: {goal.child_id ? childrenList.find(c => c.id === goal.child_id)?.name : '所有人'}</p>
                  </div>
                </div>
                <div className={`font-black text-lg transition-colors ${goal.points > 0 ? 'text-blue-500 dark:text-blue-400' : 'text-red-500 dark:text-red-400'}`}>
                  {goal.points > 0 ? '+' : ''}{goal.points}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 挂载操作抽屉 */}
      <ScoreActionDrawer 
        isOpen={scoreDrawerOpen} 
        onClose={() => setScoreDrawerOpen(false)} 
        onSuccess={fetchDashboardData}
        child={activeChild} 
        initialAction={initialScoreAction} // 🌟 传递初始操作类型到抽屉组件
      />
      <BatchActionDrawer 
        isOpen={batchDrawerOpen} 
        onClose={() => setBatchDrawerOpen(false)} 
      />
    </div>
  );
}