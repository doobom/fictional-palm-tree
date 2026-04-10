// frontend/src/pages/parent/CategoryManagerDrawer.tsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Plus, Trash2, Edit2, Check, Tags } from 'lucide-react';
import service from '../../api/request'; // 统一使用你封装的 request
import { appToast } from '../../utils/toast';

interface CategoryManagerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CategoryManagerDrawer({ isOpen, onClose }: CategoryManagerDrawerProps) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 新增分类
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('🏷️'); // 🌟 新增：图标状态
  
  // 编辑分类
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState(''); // 🌟 新增：编辑时的图标状态

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res: any = await service.get('/categories/list');
      if (res.success || res.data) {
        setCategories(res.data || res);
      }
    } catch (err) {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      setNewName('');
      setNewEmoji('🏷️');
      setEditingId(null);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await service.post('/categories/manage/upsert', { 
        name: newName.trim(), 
        emoji: newEmoji, // 🌟 保存图标
        sort_order: categories.length 
      });
      appToast.success(t('parent.settings_category_add_success', '添加成功'));
      setNewName('');
      setNewEmoji('🏷️');
      fetchCategories();
    } catch (err) {
      appToast.error('添加失败');
    }
  };

  const handleSaveEdit = async (id: string, sortOrder: number) => {
    if (!editName.trim()) return setEditingId(null);
    try {
      await service.post('/categories/manage/upsert', { 
        id, 
        name: editName.trim(), 
        emoji: editEmoji, // 🌟 核心修复 1：将修改后的图标一起提交给后端
        sort_order: sortOrder 
      });
      appToast.success(t('parent.settings_category_save_success', '修改成功'));
      setEditingId(null);
      fetchCategories();
    } catch (err) {
      appToast.error('修改失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('parent.settings_delete_category_confirm', '确定要删除该分类吗？'))) return;
    try {
      await service.delete(`/categories/manage/${id}`);
      appToast.success(t('parent.settings_category_delete_success', '删除成功'));
      fetchCategories();
    } catch (err) {
      appToast.error('删除失败');
    }
  };

  const drawerContent = (
    <div className={`fixed inset-0 z-[9999] ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      
      <div className={`absolute inset-x-0 bottom-0 bg-gray-50 rounded-t-[24px] shadow-2xl pb-safe transition-transform duration-300 ease-out transform ${isOpen ? 'translate-y-0' : 'translate-y-full'} flex flex-col max-h-[85vh]`}>
        
        <div className="w-full flex justify-center pt-3 pb-2">
          <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
        </div>

        <div className="px-6 pb-4 relative flex items-center justify-center border-b border-gray-200 shrink-0">
          <div className="flex items-center space-x-2 absolute left-6">
            <Tags className="text-blue-500" size={24} />
          </div>
          <h3 className="text-xl font-bold text-gray-900">{t('parent.settings_category_manage_title', '分类管理')}</h3>
          <button onClick={onClose} className="absolute right-5 w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full text-gray-500 font-bold active:scale-95">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 20px)' }}>
          {/* 添加分类表单 */}
          <form onSubmit={handleAdd} className="flex gap-2">
            <input 
              type="text" 
              value={newEmoji} 
              onChange={e => setNewEmoji(e.target.value)}
              placeholder="图标"
              maxLength={2}
              className="w-14 h-12 px-1 text-center text-xl rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
            />
            <input 
              type="text" 
              value={newName} 
              onChange={e => setNewName(e.target.value)}
              placeholder={t('parent.settings_category_add_ph', '输入新分类名称...')}
              className="flex-1 h-12 px-4 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-medium"
            />
            <button type="submit" disabled={!newName.trim()} className="h-12 px-4 bg-blue-600 text-white font-bold rounded-xl disabled:bg-blue-300 active:scale-95 transition-all flex items-center shrink-0 shadow-md">
              <Plus size={18} className="mr-1" /> {t('common.add', '添加')}
            </button>
          </form>

          {/* 分类列表 */}
          {loading ? (
            <div className="text-center py-8 text-gray-400 font-medium">{t('common.loading', '加载中...')}</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-2xl border-gray-300">
              {t('parent.settings_category_none', '暂无分类，请在上方添加')}
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-2xl shadow-sm">
                  {editingId === cat.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      {/* 🌟 核心修复 2：编辑时可以修改图标 */}
                      <input 
                        type="text" 
                        value={editEmoji} 
                        onChange={e => setEditEmoji(e.target.value)}
                        maxLength={2}
                        className="w-12 h-10 text-center rounded-lg border border-blue-300 bg-blue-50 focus:outline-none text-lg"
                      />
                      <input 
                        type="text" 
                        autoFocus
                        value={editName} 
                        onChange={e => setEditName(e.target.value)}
                        className="flex-1 h-10 px-3 rounded-lg border border-blue-300 bg-blue-50 focus:outline-none font-medium"
                      />
                      <button onClick={() => handleSaveEdit(cat.id, cat.sort_order)} className="p-2.5 text-white bg-green-500 rounded-lg active:scale-95">
                        <Check size={16} strokeWidth={3} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 pl-2">
                        <span className="text-2xl">{cat.emoji || '🏷️'}</span>
                        <span className="font-bold text-gray-800 text-base">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2 pr-1">
                        <button 
                          onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditEmoji(cat.emoji || '🏷️'); }} 
                          className="p-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(cat.id)} 
                          className="p-2.5 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
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