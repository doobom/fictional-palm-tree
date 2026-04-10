// frontend/src/components/Section.tsx
import React from 'react';
import { ChevronDown, ChevronUp, Check, Plus, X } from 'lucide-react';

export interface SectionProps {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, icon, isOpen, onToggle, children }) => {
  return (
    /* 🌟 外层卡片：bg-white -> dark:bg-gray-800 */
    <section className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mb-4 transition-colors duration-300">
      {/* 🌟 按钮点击反馈：active:bg-gray-50 -> dark:active:bg-gray-700 */}
      <button 
        onClick={onToggle} 
        className="w-full flex justify-between items-center p-5 bg-white dark:bg-gray-800 active:bg-gray-50 dark:active:bg-gray-700 outline-none transition-colors duration-300"
      >
        <div className="flex items-center gap-3">
          {/* 🌟 图标和标题颜色 */}
          <div className="text-gray-600 dark:text-gray-400">{icon}</div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{title}</h3>
        </div>
        <ChevronDown className={`text-gray-400 dark:text-gray-500 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        {/* 🌟 分割线颜色 */}
        <div className="p-5 pt-0 border-t border-gray-50 dark:border-gray-700/50 transition-colors duration-300">
          {children}
        </div>
      </div>
    </section>
  );
};

export default Section;