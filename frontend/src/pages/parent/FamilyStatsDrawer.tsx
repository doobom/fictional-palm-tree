// frontend/src/pages/parent/FamilyStatsDrawer.tsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, BarChart3, Trophy, PieChart as PieChartIcon } from 'lucide-react';
// 🌟 新增引入了 PieChart, Pie, Legend 等饼图和多维图表组件
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import service, { ApiResponse } from '../../api/request';

// 为饼图定义一套好看的颜色池
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function FamilyStatsDrawer({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      service.get<any, ApiResponse>('/analytics/family-comparison?days=7').then(res => {
        if (res.success) setData(res.data);
        setLoading(false);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className={`fixed inset-0 z-[9999] flex flex-col justify-end ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/40 dark:bg-black/60 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      
      <div className={`absolute inset-x-0 bottom-0 bg-gray-50 dark:bg-gray-900 shadow-2xl pb-safe rounded-t-[24px] transition-all duration-300 transform ${isOpen ? 'translate-y-0' : 'translate-y-full'} flex flex-col max-h-[85vh]`}>
        
        <div className="w-full flex justify-center py-3"><div className="w-10 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" /></div>
        
        <div className="px-5 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3 transition-colors">
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <BarChart3 size={22} className="text-blue-500" />
            <h3 className="text-lg font-bold">家庭数据中心</h3>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full text-gray-500 active:scale-95 transition-colors"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400 font-bold animate-pulse">正在生成家庭数据报表...</div>
        ) : data.length === 0 ? (
          <div className="py-20 text-center text-gray-400 font-bold">本周暂无积分变动数据</div>
        ) : (
          <div className="flex-1 space-y-6 overflow-y-auto p-4 overscroll-y-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
            
            {/* =========================================
                1. 本周荣誉榜 (Leaderboard) - 自动高亮净增长第一名
            ========================================= */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-500 flex items-center gap-1.5"><Trophy size={16}/> 本周之星与净分排行</h3>
              {data.map((item, index) => (
                <div key={item.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl flex items-center justify-between border border-gray-100 dark:border-gray-700 shadow-sm transition-colors relative overflow-hidden">
                  {/* 第一名发光背景特效 */}
                  {index === 0 && <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 to-transparent pointer-events-none" />}
                  
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="relative">
                       <span className="text-3xl bg-gray-50 dark:bg-gray-700 p-1 rounded-xl block">{item.avatar}</span>
                       {index === 0 && <Trophy className="absolute -top-3 -right-3 text-yellow-400 fill-yellow-400 drop-shadow-md" size={22} />}
                    </div>
                    <div>
                      <p className={`font-black text-lg ${index === 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'}`}>
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-500 font-medium">净增长: {item.net_score} 分</p>
                    </div>
                  </div>
                  <div className="text-right relative z-10">
                    <p className="text-blue-500 font-black">+{item.total_earned}</p>
                    <p className="text-red-400 text-xs font-bold">-{item.total_spent}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* =========================================
                2. 多维对比 (Earned vs Spent) - 分组柱状图
            ========================================= */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl border border-gray-100 dark:border-gray-700 h-[280px] shadow-sm transition-colors">
               <h3 className="text-sm font-bold text-gray-500 mb-4 flex items-center gap-1.5"><BarChart3 size={16}/> 赚取 vs 消费对比</h3>
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={data} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-gray-200 dark:text-gray-700" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#9ca3af', fontSize:12, fontWeight: 'bold'}} dy={10} />
                   <YAxis axisLine={false} tickLine={false} tick={{fill:'#9ca3af', fontSize:12}} />
                   <Tooltip 
                     cursor={{fill: 'rgba(156, 163, 175, 0.1)'}} 
                     contentStyle={{borderRadius: '16px', border: 'none', backgroundColor: 'var(--tw-prose-body)'}} 
                   />
                   <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', paddingTop: '10px' }} />
                   {/* 🌟 核心：两个 Bar 并排，直观对比大户 */}
                   <Bar dataKey="total_earned" name="赚取 (积极行为)" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={35} />
                   <Bar dataKey="total_spent" name="消费 (惩罚/兑换)" fill="#f87171" radius={[6, 6, 0, 0]} maxBarSize={35} />
                 </BarChart>
               </ResponsiveContainer>
            </div>

            {/* =========================================
                3. 积分贡献占比 (Pie Chart) - 饼图
            ========================================= */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl border border-gray-100 dark:border-gray-700 h-[280px] shadow-sm transition-colors mb-4">
               <h3 className="text-sm font-bold text-gray-500 mb-2 flex items-center gap-1.5"><PieChartIcon size={16}/> 家庭正向行为贡献度</h3>
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={data.filter(d => d.total_earned > 0)} // 过滤掉没有赚取分数的孩子，避免图表报错
                     dataKey="total_earned"
                     nameKey="name"
                     cx="50%"
                     cy="45%"
                     innerRadius={50} // 环形图设计，更现代
                     outerRadius={80}
                     paddingAngle={5}
                     label={({ name, percent = 0 }: any) => `${name} ${(percent * 100).toFixed(0)}%`} // 直接在图上显示百分比
                     labelLine={false}
                   >
                     {data.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                     ))}
                   </Pie>
                   <Tooltip contentStyle={{borderRadius: '12px', border: 'none'}} />
                 </PieChart>
               </ResponsiveContainer>
            </div>

          </div>
        )}
      </div>
    </div>,
    document.body
  );
}