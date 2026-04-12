// frontend/src/pages/parent/HistoryDrawer.tsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ReceiptText, Clock, RotateCcw } from 'lucide-react';
import service, { ApiResponse } from '../../api/request';
import { appToast } from '../../utils/toast';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  childId?: string;
  onSuccess?: () => void;
}

export default function HistoryDrawer({ isOpen, onClose, childId, onSuccess }: HistoryDrawerProps) {
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [nowTime, setNowTime] = useState(Date.now()); // 用来触发 5 分钟超时重绘

  useEffect(() => {
    let timer: any;
    if (isOpen) {
      fetchHistory();
      document.body.style.overflow = 'hidden';
      // 每 30 秒更新一下当前时间，用来判断撤回按钮是否超时该消失了
      timer = setInterval(() => setNowTime(Date.now()), 30000);
    } else {
      document.body.style.overflow = '';
    }
    return () => { 
      document.body.style.overflow = ''; 
      clearInterval(timer);
    };
  }, [isOpen, childId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const url = childId ? `/scores/history?childId=${childId}&limit=50` : `/scores/history?limit=50`;
      const res = await service.get<any, ApiResponse>(url);
      if (res.success) setHistoryLogs(res.data || []);
    } catch (err) {} finally { setLoading(false); }
  };
  
  const handleUndo = async (historyId: string) => {
    if (!window.confirm('确定要撤回这条记录吗？分数将被退还。')) return;
    
    // 获取本地时区名传给后端
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    try {
      await service.post('/scores/undo', { historyId, timezone });
      appToast.success('撤回成功');
      fetchHistory(); // 刷新列表
      if (onSuccess) onSuccess(); // 通知父组件刷新数据
    } catch (error: any) {
      appToast.error(error.response?.data?.errorMessage || '撤回失败');
      fetchHistory(); // 如果超时了后端报错，顺便刷新一下列表
    }
  };

    // 🌟 1. 新增：将 SQLite 的 UTC 时间字符串安全转换为正确的本地时间
  const getSafeDate = (timeStr: string) => {
    if (!timeStr) return new Date();
    // 补齐 'T' 和 'Z'，强制 JS 识别为 UTC 时间
    const safeStr = timeStr.includes('T') ? timeStr : timeStr.replace(' ', 'T') + 'Z';
    return new Date(safeStr);
  };

  const formatTime = (timeStr: string) => {
    const date = getSafeDate(timeStr); // 使用安全时间
    const today = new Date();
    const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth();
    const timeStrFormat = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStrFormat = `${date.getMonth() + 1}-${date.getDate()}`;
    return isToday ? `今天 ${timeStrFormat}` : `${dateStrFormat} ${timeStrFormat}`;
  };

  if (typeof document === 'undefined') return null;

  const drawerContent = (
    <div className={`fixed inset-0 z-[9999] flex flex-col justify-end ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/40 dark:bg-black/60 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      
      <div className={`absolute inset-x-0 bottom-0 bg-gray-50 dark:bg-gray-900 shadow-2xl pb-safe rounded-t-[24px] transition-all duration-300 transform ${isOpen ? 'translate-y-0' : 'translate-y-full'} flex flex-col max-h-[85vh]`}>
        
        <div className="w-full flex justify-center py-3"><div className="w-10 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" /></div>
        
        <div className="px-5 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3 transition-colors">
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <ReceiptText size={22} className="text-blue-500" />
            <h3 className="text-lg font-bold">积分流水账单</h3>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full text-gray-500 active:scale-95 transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 overscroll-y-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
            <div className="text-center py-10 text-gray-400 font-medium">正在拉取账单...</div>
          ) : historyLogs.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center">
              <span className="text-5xl mb-4 opacity-50">📭</span>
              <p className="text-gray-400 font-medium">还没有任何积分流水记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyLogs.map((log) => {
                const isAdd = log.points > 0;
                const title = log.rule_name || log.remark || '手动调整';
                const emoji = log.rule_emoji || (isAdd ? '💰' : '📝');
                
                // 🌟 判断是否被撤回
                const isRevoked = log.is_revoked === 1;
                // 🌟 判断是否在 5 分钟内
                const logTime = getSafeDate(log.created_at).getTime();
                const isWithin5Mins = (nowTime - logTime) <= 5 * 60 * 1000;

                return (
                  <div key={log.id} className={`bg-white dark:bg-gray-800 p-4 rounded-2xl border ${isRevoked ? 'border-dashed border-gray-200 dark:border-gray-700 opacity-60' : 'border-gray-100 dark:border-gray-700 shadow-sm'} flex items-center gap-3 transition-colors relative`}>
                    
                    <div className="w-12 h-12 bg-gray-50 dark:bg-gray-700 rounded-xl flex items-center justify-center text-2xl shrink-0 grayscale-[20%]">
                      {log.child_avatar || '👦'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-sm font-bold truncate ${isRevoked ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
                          {emoji} {title}
                        </span>
                        {/* 作废印章 */}
                        {isRevoked && <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded-md font-bold">已撤回</span>}
                      </div>
                      <div className="flex items-center text-[11px] text-gray-400 dark:text-gray-500 gap-2">
                        <span className="flex items-center gap-0.5"><Clock size={10} /> {formatTime(log.created_at)}</span>
                        <span>•</span><span>{log.child_name}</span><span>•</span><span className="truncate">操作: {log.operator_name || '系统'}</span>
                      </div>
                    </div>

                    {/* 分数或者撤回按钮 */}
                    <div className="shrink-0 flex flex-col items-end justify-center">
                      <div className={`font-black text-lg ${isRevoked ? 'text-gray-400 line-through' : (isAdd ? 'text-blue-500' : 'text-red-500')}`}>
                        {isAdd ? '+' : ''}{log.points}
                      </div>
                      
                      {/* 🌟 只有未作废 且 在5分钟内，才显示撤回按钮 */}
                      {!isRevoked && isWithin5Mins && (
                        <button 
                          onClick={() => handleUndo(log.id)}
                          className="mt-1 flex items-center gap-0.5 text-[10px] text-red-500 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-md font-bold active:scale-95 transition-transform"
                        >
                          <RotateCcw size={10} /> 撤回
                        </button>
                      )}
                    </div>
                    
                  </div>
                );
              })}
            </div>
          )}
          <div className="h-6"></div>
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}