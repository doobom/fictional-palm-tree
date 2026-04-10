import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface BottomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const BottomDrawer: React.FC<BottomDrawerProps> = ({ isOpen, onClose, title, children, footer }) => {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (typeof document === 'undefined') return null;

  const drawerContent = (
    <div className={`fixed inset-0 z-[9999] ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div 
        className={`absolute inset-0 bg-black/40 dark:bg-black/60 transition-opacity duration-300 ease-out ${isOpen ? 'opacity-100' : 'opacity-0'}`} 
        onClick={onClose} 
      />
      
      <div className={`absolute inset-x-0 bottom-0 bg-gray-50 dark:bg-gray-900 rounded-t-[24px] flex flex-col transform transition-transform duration-300 ease-out max-h-[90vh] ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        
        <div className="w-full flex justify-center pt-3 pb-2">
          <div className="w-10 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
        </div>
        
        <div className="px-5 pb-4 relative flex items-center justify-center border-b border-gray-200 dark:border-gray-800 shrink-0 transition-colors">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h3>
          <button 
            onClick={onClose} 
            className="absolute right-5 top-0 w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400 font-bold active:scale-95 transition-all"
          >
            ✕
          </button>
        </div>
        
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {children}
        </div>
        
        {footer && (
          <div className="p-5 pt-2 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 transition-colors" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 20px)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
};

export default BottomDrawer;