// frontend/src/pages/parent/StatisticsDrawer.tsx
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingUp, Calendar } from 'lucide-react';
import ScoreTrendChart from '../../components/ScoreTrendChart';

interface StatisticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  child: any;
}

export default function StatisticsDrawer({ isOpen, onClose, child }: StatisticsDrawerProps) {
  const [days, setDays] = useState(7);

  if (!isOpen || !child) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={onClose} />
      
      <div className="relative bg-gray-50 dark:bg-gray-900 rounded-t-[24px] flex flex-col max-h-[90vh] transition-colors">
        <div className="w-full flex justify-center py-3">
          <div className="w-10 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
        </div>

        <div className="px-5 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{child.avatar}</span>
            <div>
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">{child.name}的成长曲线</h3>
              <p className="text-xs text-gray-500">记录每一分的变化</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full text-gray-500">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* 时间维度切换 */}
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
            {[7, 30].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  days === d ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-500'
                }`}
              >
                {d}天
              </button>
            ))}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 border border-gray-100 dark:border-gray-700">
             {/* 🌟 复用之前创建的图表组件 */}
             <ScoreTrendChart childId={child.id} />
          </div>

          {/* 额外的数据总结卡片 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mb-1">本周表现</p>
              <p className="text-xl font-black text-blue-700 dark:text-blue-300">稳定增长</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-2xl">
              <p className="text-xs text-green-600 dark:text-green-400 font-bold mb-1">最高记录</p>
              <p className="text-xl font-black text-green-700 dark:text-green-300">+25 Pts</p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}