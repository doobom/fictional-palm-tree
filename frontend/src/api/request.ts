// frontend/src/api/request.ts
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { useUserStore } from '../store';
import { appToast } from '../utils/toast';

/**
 * 1. 定义后端标准响应结构
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  errorCode?: string;
  errorMessage?: string;
  errorParams?: Record<string, any>;
}

/**
 * 2. 创建 Axios 实例
 */
const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 3. 请求拦截器：注入身份凭证与家庭上下文
 */
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 从 Zustand Store 获取最新状态 (非 Hook 方式调用)
    const { currentFamilyId, token, telegramInitData } = useUserStore.getState();

    // 注入 Telegram 初始化数据
    if (telegramInitData) {
      config.headers['X-Telegram-Init-Data'] = telegramInitData;
    }

    // 注入 JWT Token
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // 注入当前活跃家庭上下文 (核心多租户逻辑)
    if (currentFamilyId) {
      config.headers['x-family-id'] = currentFamilyId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * 4. 响应拦截器：处理业务错误码与自动重定向
 */
service.interceptors.response.use(
  (response: AxiosResponse) => {
    // 强制转换为 ApiResponse 类型以适配后端结构
    const res = response.data as ApiResponse;

    // 如果后端显式返回 success: false，则视为业务错误
    if (res.success === false) {
      handleBusinessError(res);
      return Promise.reject(res);
    }

    // 返回经过拦截器剥离后的纯数据或标准响应对象
    // 注意：此处返回 res，后续调用处直接通过 res.success 访问
    return res as any; 
  },
  (error) => {
    const { response } = error;
    if (response) {
      const { status, data } = response as { status: number; data: ApiResponse };
      
      switch (status) {
        case 404: // 用户未注册 (ERR_USER_NOT_FOUND)
          if (data?.errorCode === 'ERR_USER_NOT_FOUND') {
            appToast.info('欢迎！请完成初始设置');
            // 使用 Hash 路由跳转
            window.location.hash = '#/onboarding';
          }
          break;
          
        case 400: // 缺失家庭上下文 (ERR_FAMILY_CONTEXT_MISSING)
          if (data?.errorCode === 'ERR_FAMILY_CONTEXT_MISSING') {
            appToast.warn('请先选择或创建一个家庭');
            window.location.hash = '#/onboarding';
          }
          break;

        case 401: // Token 过期
          appToast.error('登录失效，请重新进入');
          useUserStore.getState().logout();
          window.location.hash = '#/auth';
          break;

        case 403: // 权限不足
          appToast.error('您没有执行此操作的权限');
          break;

        default:
          appToast.error(data?.errorMessage || '系统繁忙，请稍后再试');
      }
    } else {
      appToast.error('网络连接异常，请检查网络');
    }
    return Promise.reject(error);
  }
);

/**
 * 辅助：处理具体的业务逻辑报错
 */
function handleBusinessError(res: ApiResponse) {
  switch (res.errorCode) {
    case 'ERR_DAILY_LIMIT_REACHED':
      appToast.warn(`今日加分已达上限 (限额: ${res.errorParams?.limit || '-'})`);
      break;
    case 'ERR_INSUFFICIENT_POINTS':
      appToast.error('积分不足，快去赚取更多吧！');
      break;
    default:
      appToast.error(res.errorMessage || '操作失败');
  }
}

export default service;