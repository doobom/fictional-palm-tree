// frontend/src/pages/child/ChildSubmitTaskDrawer.tsx
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, Send, Loader2, Sparkles, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import service, { ApiResponse } from '../../api/request';
import { appToast } from '../../utils/toast';
import { useUserStore } from '../../store';

interface ChildSubmitTaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ChildSubmitTaskDrawer({ isOpen, onClose, onSuccess }: ChildSubmitTaskDrawerProps) {
  const { user } = useUserStore();
  const [rules, setRules] = useState<any[]>([]);
  
  // 表单状态
  const [mode, setMode] = useState<'rule' | 'free'>('rule');
  const [form, setForm] = useState({
    ruleId: '',
    title: '',
    evidenceText: '',
    evidenceImage: '',
    requestedPoints: 0
  });

  // 加载状态
  const [loadingRules, setLoadingRules] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchRules();
      // 重置表单
      setForm({ ruleId: '', title: '', evidenceText: '', evidenceImage: '', requestedPoints: 0 });
      setMode('rule');
    }
  }, [isOpen]);

  // 拉取家庭规则列表供孩子选择
  const fetchRules = async () => {
    setLoadingRules(true);
    try {
      const res = await service.get<any, ApiResponse>('/rules');
      if (res.success) {
        // 过滤出加分的规则
        const positiveRules = res.data.filter((r: any) => r.points > 0);
        setRules(positiveRules);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRules(false);
    }
  };

  // 处理规则选择自动填入分值
  const handleRuleSelect = (ruleId: string) => {
    const selected = rules.find(r => r.id === ruleId);
    if (selected) {
      setForm({
        ...form,
        ruleId: selected.id,
        title: selected.name,
        requestedPoints: selected.points
      });
    }
  };

  // 处理图片上传 (直连后端 R2 接口)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 限制图片大小为 5MB
    if (file.size > 5 * 1024 * 1024) {
      return appToast.error('图片太大了，请压缩后再传哦 (最大 5MB)');
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // 注意：axios 传 formData 时不需要手动设置 Content-Type，浏览器会自动处理 boundary
      const res = await service.post<any, ApiResponse>('/approvals/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.success) {
        setForm(prev => ({ ...prev, evidenceImage: res.data.url }));
        appToast.success('图片上传成功！');
      }
    } catch (err) {
      appToast.error('图片上传失败，请稍后再试');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // 清空 input 允许重复选同一张图
    }
  };

  // 提交任务申请
  const handleSubmit = async () => {
    if (!form.title.trim()) return appToast.error('请输入任务名称');
    if (form.requestedPoints <= 0) return appToast.error('申请的分数必须大于 0');

    setSubmitting(true);
    try {
      await service.post('/approvals', {
        childId: user?.id,
        ruleId: mode === 'rule' ? form.ruleId : null,
        title: form.title,
        evidenceText: form.evidenceText,
        evidenceImage: form.evidenceImage,
        requestedPoints: form.requestedPoints
      });
      
      appToast.success('提交成功！等待家长审核奖励 🎁');
      if (onSuccess) onSuccess();
      onClose();
    } catch (e) {
      appToast.error('提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex flex-col justify-end">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      {/* 抽屉主体 */}
      <div className="relative bg-gray-50 dark:bg-gray-900 rounded-t-[32px] max-h-[90vh] flex flex-col p-5 shadow-2xl transition-colors pb-safe">
        
        {/* 标题栏 */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="text-blue-500" size={24} />
            <h2 className="text-xl font-black text-gray-900 dark:text-white">申报任务奖励</h2>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full text-gray-500 active:scale-95 transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 pb-10 overscroll-contain">
          
          {/* 模式切换 */}
          <div className="flex bg-gray-200 dark:bg-gray-800 p-1.5 rounded-2xl">
            <button 
              onClick={() => setMode('rule')}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${mode === 'rule' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500'}`}
            >
              📋 选择已有任务
            </button>
            <button 
              onClick={() => {
                setMode('free');
                setForm(prev => ({ ...prev, ruleId: '', title: '', requestedPoints: 0 }));
              }}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${mode === 'free' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500'}`}
            >
              💡 自由提报好事
            </button>
          </div>

          {/* 任务内容区 */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
            
            {mode === 'rule' ? (
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-500">做完了哪项任务？</label>
                {loadingRules ? (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl animate-pulse h-12" />
                ) : (
                  <select 
                    value={form.ruleId}
                    onChange={(e) => handleRuleSelect(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl outline-none font-bold focus:ring-2 focus:ring-blue-500 appearance-none"
                  >
                    <option value="" disabled>请选择...</option>
                    {rules.map(r => (
                      <option key={r.id} value={r.id}>{r.emoji} {r.name} (+{r.points}分)</option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-500">做了什么好事？</label>
                  <input 
                    type="text" 
                    value={form.title}
                    onChange={e => setForm({...form, title: e.target.value})}
                    placeholder="例如：帮奶奶提菜"
                    className="w-full p-3 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl outline-none font-bold focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-500">想要多少分奖励？</label>
                  <input 
                    type="number" 
                    value={form.requestedPoints || ''}
                    onChange={e => setForm({...form, requestedPoints: Number(e.target.value)})}
                    placeholder="输入分数"
                    className="w-full p-3 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl outline-none font-bold focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 凭证区：照片与留言 */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
            <h3 className="font-bold text-gray-700 dark:text-gray-200">提交凭证 (证明一下吧)</h3>
            
            {/* 上传图片按钮 */}
            <div>
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" // 在手机上优先调用后置摄像头
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileChange} 
              />
              
              {form.evidenceImage ? (
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-green-400 group">
                  <img src={form.evidenceImage} alt="已上传" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => setForm({...form, evidenceImage: ''})} className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold">删除重传</button>
                  </div>
                  <div className="absolute top-2 right-2 bg-green-500 text-white p-1.5 rounded-full shadow-md">
                    <CheckCircle2 size={16} />
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full h-24 border-2 border-dashed border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex flex-col items-center justify-center text-blue-600 dark:text-blue-400 font-bold active:scale-[0.98] transition-all"
                >
                  {uploading ? <Loader2 className="animate-spin mb-1" size={24} /> : <Camera className="mb-1" size={24} />}
                  <span>{uploading ? '正在上传图片...' : '拍照 / 传照片'}</span>
                </button>
              )}
            </div>

            {/* 留言文本框 */}
            <textarea 
              value={form.evidenceText}
              onChange={e => setForm({...form, evidenceText: e.target.value})}
              placeholder="给爸爸妈妈留句话吧（选填）"
              className="w-full p-3 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl outline-none text-sm resize-none h-20 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 提交按钮 */}
          <button 
            onClick={handleSubmit}
            disabled={submitting || (mode === 'rule' && !form.ruleId)}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
          >
            {submitting ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            {submitting ? '正在提交...' : '提交给家长审核'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}