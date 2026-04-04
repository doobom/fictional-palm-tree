// src/components/CollapsibleSection.tsx
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export default function CollapsibleSection({ title, icon, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl mb-5 shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* 标题栏 (点击热区) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 bg-transparent focus:outline-none active:bg-gray-50 dark:active:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          {icon && (
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-500 rounded-xl">
              {icon}
            </div>
          )}
          <h3 className="font-bold text-gray-800 dark:text-gray-200">{title}</h3>
        </div>
        
        {/* 旋转箭头动画 */}
        <ChevronDown
          size={20}
          className={`text-gray-400 transform transition-transform duration-300 ease-in-out ${
            isOpen ? 'rotate-180' : 'rotate-0'
          }`}
        />
      </button>

      {/* 内容区域 (丝滑高度展开动画) */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          {/* 这里加 border-t 画一条细线分割标题和内容 */}
          <div className="p-5 pt-0 border-t border-gray-50 dark:border-gray-700/50 mt-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}