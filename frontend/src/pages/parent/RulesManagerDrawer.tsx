// frontend/src/pages/parent/RulesManagerDrawer.tsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Edit2, Check, Star, BookOpen, ChevronRight, CheckCircle2 } from 'lucide-react';
import service, { ApiResponse } from '../../api/request';
import { appToast } from '../../utils/toast';
import { useUserStore, Child } from '../../store';

export default function RuleManagerDrawer({ isOpen, onClose, onSuccess }: any) {
  const { childrenList } = useUserStore();
  const [activeTab, setActiveTab] = useState<'list' | 'templates'>('list');
  const [rules, setRules] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // 🌟 表单核心状态全部回归
  const [actionType, setActionType] = useState<'add' | 'deduct'>('add');
  const [newEmoji, setNewEmoji] = useState('⭐');
  const [newName, setNewName] = useState('');
  const [newPoints, setNewPoints] = useState<number | ''>('');
  const [newDailyLimit, setNewDailyLimit] = useState<number | ''>(''); // 🌟 新增：日限次数
  const [targetChildId, setTargetChildId] = useState<string>('');
  
  // 编辑状态
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchRules();
      fetchTemplates();
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const fetchRules = async () => {
    const res = await service.get<any, ApiResponse>('/rules');
    if (res.success) setRules(res.data || []);
  };

  const fetchTemplates = async () => {
    const res = await service.get<any, ApiResponse>('/rules/templates/all');
    if (res.success) setTemplates(res.data);
  };

  // 重置表单
  const resetForm = () => {
    setNewName(''); setNewEmoji('⭐'); setNewPoints(''); setNewDailyLimit('');
    setActionType('add'); setTargetChildId(''); setEditingId(null);
  };

  // 🌟 核心：触发编辑状态回显数据
  const startEdit = (rule: any) => {
    setActiveTab('list'); // 确保切换回列表页
    setEditingId(rule.id);
    setNewName(rule.name);
    setNewEmoji(rule.emoji || '⭐');
    setNewPoints(Math.abs(rule.points));
    setActionType(rule.points >= 0 ? 'add' : 'deduct');
    setTargetChildId(rule.child_id || '');
    setNewDailyLimit(rule.daily_limit === 0 ? '' : rule.daily_limit); // 0 转换为空白(不限)
  };

  const handleImport = async (stage: string) => {
    const stageTemplates = templates[stage];
    setLoading(true);
    try {
      await service.post('/rules/manage/batch-import', {
        childId: targetChildId || null,
        templates: stageTemplates
      });
      appToast.success('模板规则导入成功！');
      setActiveTab('list');
      fetchRules();
      onSuccess();
    } finally { setLoading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPoints) return;

    const finalPoints = actionType === 'add' ? Math.abs(Number(newPoints)) : -Math.abs(Number(newPoints));
    
    await service.post('/rules/manage/upsert', { 
      id: editingId, 
      name: newName.trim(), 
      emoji: newEmoji || '⭐', 
      points: finalPoints, 
      childId: targetChildId || null,
      dailyLimit: newDailyLimit ? parseInt(String(newDailyLimit), 10) : 0 // 🌟 发送给后端
    });
    
    appToast.success(editingId ? '修改成功' : '添加成功');
    resetForm();
    fetchRules(); 
    onSuccess();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定要删除这条规则吗？')) return;
    try {
      await service.delete(`/rules/manage/${id}`);
      appToast.success('删除成功');
      fetchRules(); onSuccess();
    } catch (err) { appToast.error('删除失败'); }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  const stageLabels: any = { kindergarten: '幼儿园', primary: '小学阶段', middle_high: '中学/高中' };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={onClose} />
      
      <div className="relative bg-gray-50 dark:bg-gray-900 rounded-t-[24px] flex flex-col max-h-[92vh] transition-colors duration-300">
        <div className="w-full flex justify-center py-3"><div className="w-10 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" /></div>

        <div className="px-5 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-2 transition-colors">
          <div className="flex gap-4">
            <button onClick={() => { setActiveTab('list'); resetForm(); }} className={`pb-2 text-lg font-bold transition-colors ${activeTab === 'list' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}>当前规则</button>
            <button onClick={() => setActiveTab('templates')} className={`pb-2 text-lg font-bold transition-colors ${activeTab === 'templates' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}>模板库</button>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full text-gray-500">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {activeTab === 'list' ? (
            <>
              {/* 🌟 恢复完美的表单结构：包含所有控制项 */}
              <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
                <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3">{editingId ? '✏️ 编辑规则' : '✨ 新增规则'}</h4>
                
                {/* 1. 奖惩切换 */}
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl mb-3 transition-colors">
                  <button type="button" onClick={() => setActionType('add')} className={`flex-1 py-2 font-bold rounded-lg text-sm transition-all ${actionType === 'add' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>奖励 (加分)</button>
                  <button type="button" onClick={() => setActionType('deduct')} className={`flex-1 py-2 font-bold rounded-lg text-sm transition-all ${actionType === 'deduct' ? 'bg-white dark:bg-gray-600 text-red-600 dark:text-red-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>约束 (扣分)</button>
                </div>

                {/* 2. 图标、名称、分值 */}
                <div className="flex gap-2 mb-3">
                  <input type="text" value={newEmoji} onChange={e => setNewEmoji(e.target.value)} placeholder="图标" maxLength={2} className="w-12 shrink-0 h-12 text-center text-xl rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
                  <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="名称 (如: 洗碗)" required className="flex-1 min-w-0 h-12 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
                  <input type="number" value={newPoints} onChange={e => setNewPoints(parseInt(e.target.value) || '')} placeholder="分值" required min="1" className="w-16 shrink-0 h-12 px-2 text-center font-bold rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
                </div>

                {/* 3. 日限次数与对象选择 */}
                <div className="flex gap-2 mb-4">
                  <div className="flex-1 flex items-center bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-2 focus-within:ring-2 focus-within:ring-blue-500 transition-colors">
                    <span className="text-xs font-bold text-gray-500 shrink-0">每日限</span>
                    <input type="number" value={newDailyLimit} onChange={e => setNewDailyLimit(parseInt(e.target.value) || '')} placeholder="不限" min="1" className="w-full h-10 px-2 bg-transparent outline-none text-center font-bold text-gray-900 dark:text-white placeholder-gray-400" />
                    <span className="text-xs font-bold text-gray-500 shrink-0">次</span>
                  </div>
                  <select value={targetChildId} onChange={e => setTargetChildId(e.target.value)} className="flex-[1.5] min-w-0 h-11 px-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
                    <option value="">👨‍👩‍👧‍👦 所有人 (通用)</option>
                    {childrenList.map((c: any) => <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>)}
                  </select>
                </div>

                {/* 4. 操作按钮 */}
                <div className="flex gap-2">
                  {editingId && (
                    <button type="button" onClick={resetForm} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl active:scale-95 transition-all">取消编辑</button>
                  )}
                  <button type="submit" className={`flex-[2] py-3 text-white font-bold rounded-xl active:scale-95 transition-transform flex items-center justify-center ${actionType === 'add' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-500 hover:bg-red-600'}`}>
                    {editingId ? <><Check size={18} className="mr-1" /> 保存修改</> : <><Plus size={18} className="mr-1" /> 添加规则</>}
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                {rules.map(r => (
                  <div key={r.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl flex items-center justify-between border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl bg-gray-50 dark:bg-gray-700 p-1 rounded-xl">{r.emoji || '⭐'}</span>
                      <div>
                        <p className="font-bold text-gray-800 dark:text-gray-100">{r.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-sm font-black ${r.points > 0 ? 'text-blue-500 dark:text-blue-400' : 'text-red-500 dark:text-red-400'}`}>
                            {r.points > 0 ? '+' : ''}{r.points}
                          </span>
                          {/* 🌟 列表展示日限标签 */}
                          {r.daily_limit > 0 && (
                            <span className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-md font-bold">每日 {r.daily_limit} 次</span>
                          )}
                          <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-md font-bold">
                            对 {r.child_id ? childrenList.find(c => c.id === r.child_id)?.name : '所有人'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* 🌟 编辑和删除按钮 */}
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(r)} className="p-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-gray-700 hover:bg-blue-100 rounded-xl transition-colors"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(r.id)} className="p-2 text-red-500 dark:text-red-400 bg-red-50 dark:bg-gray-700 hover:bg-red-100 rounded-xl transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            // 模板库逻辑保持不变
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/50">
                <p className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2">选择规则适用的孩子</p>
                <select value={targetChildId} onChange={e => setTargetChildId(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-white dark:bg-gray-800 border-none outline-none text-gray-800 dark:text-gray-200 shadow-sm transition-colors">
                  <option value="">👨‍👩‍👧‍👦 全体通用 (不限孩子)</option>
                  {childrenList.map((c: any) => <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>)}
                </select>
              </div>

              {templates && Object.keys(templates).map(stage => (
                <div key={stage} className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors shadow-sm">
                  <div className="p-4 flex items-center justify-between border-b border-gray-50 dark:border-gray-700/50">
                    <div className="flex items-center gap-2">
                      <BookOpen size={18} className="text-blue-500" />
                      <h4 className="font-bold text-gray-800 dark:text-gray-100">{stageLabels[stage]}</h4>
                    </div>
                    <button onClick={() => handleImport(stage)} disabled={loading} className="text-xs font-bold bg-blue-600 text-white px-3 py-1.5 rounded-full active:scale-95 disabled:bg-gray-300 transition-all flex items-center gap-1">
                      {loading ? '导入中' : <><CheckCircle2 size={12} /> 一键导入</>}
                    </button>
                  </div>
                  <div className="p-4 grid grid-cols-1 gap-2">
                    {templates[stage].map((t: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm py-1">
                        <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                          <span>{t.emoji}</span> {t.name}
                        </span>
                        <span className={`font-bold ${t.points > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                          {t.points > 0 ? '+' : ''}{t.points}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}