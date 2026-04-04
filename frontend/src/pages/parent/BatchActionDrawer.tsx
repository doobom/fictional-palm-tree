// src/pages/parent/BatchActionDrawer.tsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import api from '../../api/request';
import { useAppStore } from '../../store';
import { appToast } from '../../utils/toast';

export default function BatchActionDrawer({ isOpen, onClose, onSuccess }: any) {
  const { t } = useTranslation();
  const { childrenList } = useAppStore();
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [points, setPoints] = useState('');
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);

  // 打开时默认全选
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(childrenList.map(c => c.id));
      setPoints('');
      setRemark('');
    }
  }, [isOpen, childrenList]);

  const toggleChild = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0 || !points) return;

    setLoading(true);
    try {
      await api.post('/scores/batch', {
        childIds: selectedIds,
        pointsDelta: parseInt(points, 10),
        remark: remark.trim()
      });
      appToast.success(t('parent.success_adjusted'));
      onSuccess();
      onClose();
    } catch (err) {} finally {
      setLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[110] ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <div className={`absolute inset-x-0 bottom-0 bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl pb-safe transition-transform ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="px-6 pb-6 pt-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">{t('parent.batch_title')}</h3>
            <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full"><X size={20}/></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 选择孩子 */}
            <div>
              <label className="block text-sm font-medium mb-2">{t('parent.batch_select_children')}</label>
              <div className="flex flex-wrap gap-2">
                {childrenList.map(child => (
                  <button type="button" key={child.id} onClick={() => toggleChild(child.id)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition-all ${selectedIds.includes(child.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'}`}>
                    {child.name}
                  </button>
                ))}
              </div>
            </div>
            {/* 分数输入 */}
            <div>
              <label className="block text-sm font-medium mb-1">{t('parent.custom_points')} (正数为加分，负数为扣分)</label>
              <input type="number" required value={points} onChange={e => setPoints(e.target.value)} placeholder="+10 或 -5"
                className="w-full h-12 px-4 rounded-lg border bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500" />
            </div>
            {/* 备注 */}
            <div>
              <label className="block text-sm font-medium mb-1">{t('parent.batch_remark')}</label>
              <input type="text" value={remark} onChange={e => setRemark(e.target.value)} placeholder={t('parent.batch_remark_ph')}
                className="w-full h-12 px-4 rounded-lg border bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500" />
            </div>
            <button type="submit" disabled={loading || selectedIds.length === 0} className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold disabled:bg-gray-400">
              {t('parent.btn_confirm')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}