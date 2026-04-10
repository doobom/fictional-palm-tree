// frontend/src/pages/parent/CategoryManagerDrawer.tsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Plus, Trash2, Edit2, Check, Tags } from 'lucide-react';
import service from '../../api/request'; 
import { appToast } from '../../utils/toast';

interface CategoryManagerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CategoryManagerDrawer({ isOpen, onClose }: CategoryManagerDrawerProps) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('🏷️'); 
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState(''); 

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res: any = await service.get('/categories/list');
      if (res.success || res.data) setCategories(res.data || res);
    } catch (err) {} finally { setLoading(false); }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      setNewName(''); setNewEmoji('🏷️'); setEditingId(null);
      document.body.style.overflow = 'hidden';
    } else { document.body.style.overflow = ''; }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await service.post('/categories/manage/upsert', { name: newName.trim(), emoji: newEmoji, sort_order: categories.length });
      appToast.success(t('parent.settings_category_add_success', '添加成功'));
      setNewName(''); setNewEmoji('🏷️'); fetchCategories();
    } catch (err) {}
  };

  const handleSaveEdit = async (id: string, sortOrder: number) => {
    if (!editName.trim()) return setEditingId(null);
    try {
      await service.post('/categories/manage/upsert', { id, name: editName.trim(), emoji: editEmoji, sort_order: sortOrder });
      appToast.success(t('parent.settings_category_save_success', '修改成功'));
      setEditingId(null); fetchCategories();
    } catch (err) {}
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('parent.settings_delete_category_confirm', '确定要删除该分类吗？'))) return;
    try {
      await service.delete(`/categories/manage/${id}`);
      appToast.success(t('parent.settings_category_delete_success', '删除成功'));
      fetchCategories();
    } catch (err) {}
  };

  const drawerContent = (
    <div className={`fixed inset-0 z-[9999] ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/40 dark:bg-black/60 transition-opacity duration-300 ease-out ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      
      {/* 🌟 抽屉底色适配 */}
      <div className={`absolute inset-x-0 bottom-0 bg-gray-50 dark:bg-gray-900 shadow-2xl pb-safe rounded-t-[24px] transition-all duration-300 ease-out transform ${isOpen ? 'translate-y-0' : 'translate-y-full'} flex flex-col max-h-[85vh]`}>
        
        <div className="w-full flex justify-center pt-3 pb-2">
          <div className="w-10 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
        </div>

        <div className="px-6 pb-4 relative flex items-center justify-center border-b border-gray-200 dark:border-gray-800 shrink-0 transition-colors">
          <div className="flex items-center space-x-2 absolute left-6">
            <Tags className="text-blue-500 dark:text-blue-400" size={24} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">{t('parent.settings_category_manage_title', '分类管理')}</h3>
          <button onClick={onClose} className="absolute right-5 w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400 font-bold active:scale-95 transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 20px)' }}>
          {/* 添加分类表单 */}
          <form onSubmit={handleAdd} className="flex gap-2">
            {/* 🌟 输入框背景适配 */}
            <input 
              type="text" value={newEmoji} onChange={e => setNewEmoji(e.target.value)} placeholder="图标" maxLength={2}
              className="w-14 h-12 px-1 text-center text-xl rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-colors"
            />
            <input 
              type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('parent.settings_category_add_ph', '输入新分类名称...')}
              className="flex-1 h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-medium transition-colors"
            />
            {/* 🌟 添加按钮状态颜色适配 */}
            <button type="submit" disabled={!newName.trim()} className="h-12 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl disabled:bg-blue-300 dark:disabled:bg-gray-800 dark:disabled:text-gray-500 active:scale-95 transition-all flex items-center shrink-0 shadow-md dark:shadow-none">
              <Plus size={18} className="mr-1" /> {t('common.add', '添加')}
            </button>
          </form>

          {/* 分类列表 */}
          {loading ? (
            <div className="text-center py-8 text-gray-400 dark:text-gray-500 font-medium transition-colors">{t('common.loading', '加载中...')}</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-gray-500 border-2 border-dashed rounded-2xl border-gray-300 dark:border-gray-700 transition-colors">
              {t('parent.settings_category_none', '暂无分类，请在上方添加')}
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((cat) => (
                // 🌟 列表卡片颜色
                <div key={cat.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm transition-colors">
                  {editingId === cat.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input 
                        type="text" value={editEmoji} onChange={e => setEditEmoji(e.target.value)} maxLength={2}
                        className="w-12 h-10 text-center rounded-lg border border-blue-300 dark:border-gray-600 bg-blue-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-600 focus:outline-none text-lg transition-colors"
                      />
                      <input 
                        type="text" autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                        className="flex-1 h-10 px-3 rounded-lg border border-blue-300 dark:border-gray-600 bg-blue-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-600 focus:outline-none font-medium transition-colors"
                      />
                      <button onClick={() => handleSaveEdit(cat.id, cat.sort_order)} className="p-2.5 text-white bg-green-500 hover:bg-green-600 rounded-lg active:scale-95 transition-colors">
                        <Check size={16} strokeWidth={3} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 pl-2">
                        <span className="text-2xl">{cat.emoji || '🏷️'}</span>
                        <span className="font-bold text-gray-800 dark:text-gray-100 text-base transition-colors">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2 pr-1">
                        {/* 🌟 修改与删除按钮颜色 */}
                        <button 
                          onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditEmoji(cat.emoji || '🏷️'); }} 
                          className="p-2.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-xl transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(cat.id)} 
                          className="p-2.5 text-red-500 dark:text-red-400 bg-red-50 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}