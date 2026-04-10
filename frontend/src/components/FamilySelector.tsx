// frontend/src/components/FamilySelector.tsx
import React, { useState, useEffect } from 'react';
import { useUserStore, Family } from '../store';
import { appToast } from '../utils/toast';
import { ChevronDown, ChevronUp, Check, Plus, X } from 'lucide-react'; // 🌟 引入标准化图标

const FamilySelector: React.FC = () => {
  const { families, currentFamilyId, setCurrentFamilyId } = useUserStore();
  const [isOpen, setIsOpen] = useState(false);

  const currentFamily = families.find((f: Family) => f.id === currentFamilyId);

  // 🌟 打开下拉菜单时，锁定底层页面不可滚动，防止背景跟着滑
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleSwitch = (id: string) => {
    if (id === currentFamilyId) { 
      setIsOpen(false); 
      return; 
    }
    setCurrentFamilyId(id);
    setIsOpen(false);
    appToast.success(`已切换至：${families.find((f: Family) => f.id === id)?.name || '未知家庭'}`);
  };

  return (
    <>
      {/* --- 主按钮与下拉面板区 --- */}
      <div className="relative bg-white transition-colors z-50">
        
        {/* 顶部主按钮 */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors active:bg-gray-100"
        >
          <div className="flex items-center gap-3 w-full overflow-hidden">
            <span className="text-3xl shrink-0 drop-shadow-sm">{currentFamily?.avatar || '🏠'}</span>
            <div className="text-left flex-1 overflow-hidden">
              <p className="text-base font-bold text-gray-900 truncate">{currentFamily?.name || '选择家庭'}</p>
              <p className="text-xs text-blue-500 font-bold uppercase tracking-wider mt-0.5 truncate">{currentFamily?.role || 'MEMBER'}</p>
            </div>
          </div>
          <span className={`shrink-0 ml-2 text-gray-400`}>
            {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </span>
        </button>

        {/* 下拉内容面板 */}
        {isOpen && (
          <div className="absolute top-full left-0 w-full bg-white shadow-2xl rounded-b-3xl border-t border-gray-100 overflow-hidden animate-fade-in z-50">
            <div className="p-2 max-h-[60vh] overflow-y-auto">
              
              <div className="px-3 py-2 flex justify-between items-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">切换家庭</p>
                {/* 🌟 核心修复：显式的关闭按钮 */}
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform"
                >
                  <X size={14} /> 关闭
                </button>
              </div>

              {families.map((f: Family) => (
                <button
                  key={f.id} 
                  onClick={() => handleSwitch(f.id)}
                  className={`w-full flex items-center gap-3 p-3 mt-1 rounded-2xl transition-all ${
                    f.id === currentFamilyId ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-gray-50 text-gray-700 font-medium'
                  }`}
                >
                  <span className="text-2xl">{f.avatar}</span>
                  <span className="flex-1 text-left truncate">{f.name}</span>
                  {f.id === currentFamilyId && <Check size={18} className="text-blue-500" strokeWidth={3} />}
                </button>
              ))}
              
              <div className="h-px bg-gray-100 my-2 mx-2" />
              
              <button 
                onClick={() => { setIsOpen(false); window.location.hash = '#/onboarding'; }}
                className="w-full flex items-center gap-3 p-3 mt-1 text-gray-600 hover:bg-gray-50 rounded-2xl font-bold transition-colors active:bg-gray-100"
              >
                <span className="text-2xl w-8 flex justify-center text-blue-500"><Plus size={20} strokeWidth={3} /></span>
                <span className="flex-1 text-left">创建或加入新家庭</span>
              </button>

            </div>
          </div>
        )}
      </div>

      {/* 🌟 核心修复：全屏防误触遮罩层 */}
      {/* 只要面板展开，这层背景就会出现，用户点击下方空白处也能直接关闭 */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default FamilySelector;