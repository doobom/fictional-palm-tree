// frontend/src/components/FamilySelector.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useUserStore, Family } from '../store'; // 🌟 导入明确的 Family 接口
import { appToast } from '../utils/toast'; // 🌟 统一使用 appToast

const FamilySelector: React.FC = () => {
  // 1. 从最终版的 Store 获取状态和方法 (注意使用的是 setCurrentFamilyId)
  const { families, currentFamilyId, setCurrentFamilyId } = useUserStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 获取当前选中的家庭对象
  const currentFamily = families.find((f: Family) => f.id === currentFamilyId);

  // 2. 点击外部关闭下拉菜单的逻辑
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 3. 切换家庭逻辑
  const handleSwitch = (id: string) => {
    if (id === currentFamilyId) {
      setIsOpen(false);
      return;
    }
    
    setCurrentFamilyId(id);
    setIsOpen(false);
    
    const targetFamily = families.find((f: Family) => f.id === id);
    appToast.success(`已切换至家庭：${targetFamily?.name || '未知家庭'}`);
    
    // 注意：因为我们在 App.tsx 和各个页面（如 Dashboard）中
    // 都有 useEffect 监听 currentFamilyId，所以这里不需要 window.location.reload()
    // 数据和 SSE 连接都会自动平滑过渡。
  };

  // 如果用户还没加入任何家庭，或者只有一个家庭且未展开，显示精简版
  if (families.length <= 1 && !isOpen) {
    return (
      <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{currentFamily?.avatar || '🏠'}</span>
          <span className="font-bold text-gray-800 truncate">
            {currentFamily?.name || '我的家庭'}
          </span>
        </div>
        {/* 即使只有一个家庭，也保留一个微小的添加按钮，方便用户扩充 */}
        <button 
          onClick={() => window.location.hash = '#/onboarding'}
          className="text-xl text-gray-400 hover:text-blue-500 transition-colors"
        >
          ⊕
        </button>
      </div>
    );
  }

  return (
    <div className="relative border-t border-gray-100 bg-white" ref={dropdownRef}>
      {/* 当前选择展示区 (点击触发下拉) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors active:bg-gray-100"
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl drop-shadow-sm">{currentFamily?.avatar || '🏠'}</span>
          <div className="text-left">
            <p className="text-sm font-bold text-gray-900 truncate w-40">
              {currentFamily?.name || '选择家庭'}
            </p>
            <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mt-0.5">
              {currentFamily?.role || 'MEMBER'}
            </p>
          </div>
        </div>
        <span className={`text-gray-400 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* 下拉列表 (向上弹出) */}
      {isOpen && (
        <div className="absolute bottom-full left-0 w-full mb-1 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.08)] rounded-t-2xl border border-gray-100 overflow-hidden z-50 animate-fade-in-up">
          <div className="p-2 max-h-[60vh] overflow-y-auto">
            <p className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
              切换家庭上下文
            </p>
            
            {/* 🌟 显式指定 (f: Family) 类型 */}
            {families.map((f: Family) => {
              const isSelected = f.id === currentFamilyId;
              return (
                <button
                  key={f.id}
                  onClick={() => handleSwitch(f.id)}
                  className={`w-full flex items-center gap-3 p-3 mt-1 rounded-xl transition-all ${
                    isSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50 text-gray-700 font-medium'
                  }`}
                >
                  <span className="text-2xl">{f.avatar}</span>
                  <span className="flex-1 text-left truncate">{f.name}</span>
                  {isSelected && (
                    <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px] shadow-sm">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
            
            <div className="h-px bg-gray-100 my-2 mx-2" />
            
            {/* 快捷创建/加入入口 */}
            <button 
              onClick={() => {
                setIsOpen(false);
                window.location.hash = '#/onboarding';
              }}
              className="w-full flex items-center gap-3 p-3 mt-1 text-gray-600 hover:bg-gray-50 rounded-xl font-bold transition-colors"
            >
              <span className="text-2xl w-8 text-center text-blue-500">➕</span>
              <span className="flex-1 text-left">创建或加入新家庭</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FamilySelector;