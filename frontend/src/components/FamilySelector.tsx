// frontend/src/components/FamilySelector.tsx
import React, { useState, useEffect } from 'react';
import { useUserStore, Family } from '../store';
import { appToast } from '../utils/toast';
import { ChevronDown, ChevronUp, Check, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const FamilySelector: React.FC = () => {
  const { families, currentFamilyId, setCurrentFamilyId } = useUserStore();
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  const currentFamily = families.find((f: Family) => f.id === currentFamilyId);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleSwitch = (id: string) => {
    if (id === currentFamilyId) { setIsOpen(false); return; }
    setCurrentFamilyId(id);
    setIsOpen(false);
    appToast.success(t('parent.family_selector_switch_success', { familyName: families.find((f: Family) => f.id === id)?.name }) || t('parent.family_selector_unknown_family') );
  };

  return (
    <>
      {/* 🌟 主容器背景 */}
      <div className="relative bg-white dark:bg-gray-800 transition-colors duration-300 z-50">
        
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors active:bg-gray-100 dark:active:bg-gray-600"
        >
          <div className="flex items-center gap-3 w-full overflow-hidden">
            <span className="text-3xl shrink-0 drop-shadow-sm">{currentFamily?.avatar || '🏠'}</span>
            <div className="text-left flex-1 overflow-hidden">
              <p className="text-base font-bold text-gray-900 dark:text-gray-100 truncate transition-colors">{currentFamily?.name || t('parent.family_selector_choose_family')}</p>
              <p className="text-xs text-blue-500 dark:text-blue-400 font-bold uppercase tracking-wider mt-0.5 truncate transition-colors">{currentFamily?.role || 'MEMBER'}</p>
            </div>
          </div>
          <span className={`shrink-0 ml-2 text-gray-400 dark:text-gray-500`}>
            {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </span>
        </button>

        {isOpen && (
          /* 🌟 下拉面板背景和边框 */
          <div className="absolute top-full left-0 w-full bg-white dark:bg-gray-800 shadow-2xl rounded-b-3xl border-t border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in z-50 transition-colors duration-300">
            <div className="p-2 max-h-[60vh] overflow-y-auto">
              
              <div className="px-3 py-2 flex justify-between items-center">
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('parent.family_selector_switch_family')}</p>
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2.5 py-1.5 rounded-lg active:scale-95 transition-all"
                >
                  <X size={14} /> {t('common.close')}
                </button>
              </div>

              {families.map((f: Family) => (
                <button
                  key={f.id} 
                  onClick={() => handleSwitch(f.id)}
                  className={`w-full flex items-center gap-3 p-3 mt-1 rounded-2xl transition-all ${
                    f.id === currentFamilyId 
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold' 
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium'
                  }`}
                >
                  <span className="text-2xl">{f.avatar}</span>
                  <span className="flex-1 text-left truncate">{f.name}</span>
                  {f.id === currentFamilyId && <Check size={18} className="text-blue-500 dark:text-blue-400" strokeWidth={3} />}
                </button>
              ))}
              
              <div className="h-px bg-gray-100 dark:bg-gray-700 my-2 mx-2 transition-colors" />
              
              <button 
                onClick={() => { setIsOpen(false); window.location.hash = '#/onboarding'; }}
                className="w-full flex items-center gap-3 p-3 mt-1 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-2xl font-bold transition-all active:bg-gray-100 dark:active:bg-gray-600"
              >
                <span className="text-2xl w-8 flex justify-center text-blue-500 dark:text-blue-400"><Plus size={20} strokeWidth={3} /></span>
                <span className="flex-1 text-left">{t('parent.family_selector_create_join_family')}</span>
              </button>

            </div>
          </div>
        )}
      </div>

      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 dark:bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default FamilySelector;