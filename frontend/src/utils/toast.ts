// src/utils/toast.ts
import toast from 'react-hot-toast';
import WebApp from '@twa-dev/sdk';

export const appToast = {
  // 成功提示 + 成功震动
  success: (msg: string) => {
    toast.success(msg);
    if (WebApp.initData) {
      WebApp.HapticFeedback.notificationOccurred('success');
    }
  },
  
  // 错误提示 + 错误震动 (带警告感)
  error: (msg: string) => {
    toast.error(msg);
    if (WebApp.initData) {
      WebApp.HapticFeedback.notificationOccurred('error');
    }
  },

  // 警告提示 + 警告震动 (带警告感)
  warn: (msg: string) => {
    toast.custom(msg, { icon: '⚠️' });
    if (WebApp.initData) {
      WebApp.HapticFeedback.notificationOccurred('warning');
    }
  },

  // 信息提示
  info: (msg: string) => {
    return toast.custom(msg, { icon: 'ℹ️' });
  },

  
  // 加载中提示 (无震动)
  loading: (msg: string) => {
    return toast.loading(msg);
  },
  
  // 关闭特定 Toast 或所有 Toast
  dismiss: (toastId?: string) => {
    toast.dismiss(toastId);
  }
};