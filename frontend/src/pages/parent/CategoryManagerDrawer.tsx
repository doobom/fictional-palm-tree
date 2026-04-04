// src/pages/parent/CategoryManagerDrawer.tsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Trash2, Edit2, Check, Tags } from 'lucide-react';
import api from '../../api/request';
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
  
  // 编辑分类
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/categories/list');
      setCategories(res.data);
    } catch (err) {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      setNewName('');
      setEditingId(null);
    }
  }, [isOpen]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api.post('/categories/manage/upsert', { name: newName.trim(), sort_order: categories.length });
      appToast.success(t('parent.settings_category_add_success', '添加成功'));
      setNewName('');
      fetchCategories();
    } catch (err) {}
  };

  const handleSaveEdit = async (id: string, sortOrder: number) => {
    if (!editName.trim()) return setEditingId(null);
    try {
      await api.post('/categories/manage/upsert', { id, name: editName.trim(), sort_order: sortOrder });
      appToast.success(t('parent.settings_category_save_success', '修改成功'));
      setEditingId(null);
      fetchCategories();
    } catch (err) {}
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('parent.settings_delete_category_confirm', '确定要删除该分类吗？'))) return;
    try {
      await api.delete(`/categories/manage/${id}`);
      appToast.success(t('parent.settings_category_delete_success', '删除成功'));
      fetchCategories();
    } catch (err) {}
  };

  return (
    <div className={`fixed inset-0 z-[110] ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      
      <div className={`absolute inset-x-0 bottom-0 bg-white dark:bg-gray-800 rounded-t-[32px] shadow-2xl pb-safe transition-transform duration-300 ease-out transform ${isOpen ? 'translate-y-0' : 'translate-y-full'} flex flex-col max-h-[85vh]`}>
        
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-2">
            <Tags className="text-blue-500" size={24} />
            <h3 className="text-xl font-bold">{t('parent.settings_category_manage_title', '分类管理')}</h3>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500"><X size={20}/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* 添加分类表单 */}
          <form onSubmit={handleAdd} className="flex space-x-2 mb-6">
            <input 
              type="text" 
              value={newName} 
              onChange={e => setNewName(e.target.value)}
              placeholder={t('parent.settings_category_add_ph', '输入新分类名称...')}
              className="flex-1 h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button type="submit" disabled={!newName.trim()} className="h-12 px-6 bg-blue-600 text-white font-bold rounded-xl disabled:bg-blue-300 active:scale-95 transition-all flex items-center shrink-0">
              <Plus size={18} className="mr-1" /> {t('common.add', '添加')}
            </button>
          </form>

          {/* 分类列表 */}
          {loading ? (
            <div className="text-center py-4 text-gray-400">{t('common.loading', '加载中...')}</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-2xl border-gray-200 dark:border-gray-700">
              {t('parent.settings_category_none', '暂无分类')}
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-3.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm">
                  {editingId === cat.id ? (
                    // 编辑状态
                    <div className="flex-1 flex items-center space-x-2 mr-2">
                      <input 
                        type="text" 
                        autoFocus
                        value={editName} 
                        onChange={e => setEditName(e.target.value)}
                        className="flex-1 h-10 px-3 rounded-lg border border-blue-300 bg-blue-50 dark:bg-gray-700 focus:outline-none"
                      />
                      <button onClick={() => handleSaveEdit(cat.id, cat.sort_order)} className="p-2 text-green-600 bg-green-100 rounded-lg">
                        <Check size={18} />
                      </button>
                    </div>
                  ) : (
                    // 展示状态
                    <>
                      <span className="font-medium text-gray-800 dark:text-gray-200 pl-2">{cat.name}</span>
                      <div className="flex items-center space-x-1">
                        <button 
                          onClick={() => { setEditingId(cat.id); setEditName(cat.name); }} 
                          className="p-2 text-gray-400 hover:text-blue-500 bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(cat.id)} 
                          className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors"
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
}