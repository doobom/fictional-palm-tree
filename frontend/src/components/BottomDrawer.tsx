// frontend/src/components/BottomDrawer.tsx
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
  // 自动管理底部滚动穿透
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // 为了保证 SSR 兼容性（如果未来有的话）
  if (typeof document === 'undefined') return null;

  const drawerContent = (
    <div className={`fixed inset-0 z-[9999] ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      {/* 遮罩层 */}
      <div 
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out ${isOpen ? 'opacity-100' : 'opacity-0'}`} 
        onClick={onClose} 
      />
      
      {/* 抽屉主体 */}
      <div className={`absolute inset-x-0 bottom-0 bg-gray-50 rounded-t-[24px] flex flex-col transform transition-transform duration-300 ease-out max-h-[90vh] ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        {/* 顶部指示条 */}
        <div className="w-full flex justify-center pt-3 pb-2">
          <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
        </div>
        
        {/* 标题栏 */}
        <div className="px-5 pb-4 relative flex items-center justify-center border-b border-gray-200 shrink-0">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <button 
            onClick={onClose} 
            className="absolute right-5 top-0 w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full text-gray-500 font-bold active:scale-95 transition-transform"
          >
            ✕
          </button>
        </div>
        
        {/* 内容区 */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {children}
        </div>
        
        {/* 底部固定按钮区 (如果传入了的话) */}
        {footer && (
          <div className="p-5 pt-2 bg-white border-t border-gray-100" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 20px)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
};

export default BottomDrawer;