// frontend/src/pages/auth/AuthPage.tsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api/request';
import { appToast } from '../../utils/toast';
import { useUserStore } from '../../store';
// 🌟 核心点：这里已经去掉了 import Onboarding

// 🌟 核心点：这里移除了 'onboarding' 状态
type AuthStep = 'checking_env' | 'telegram_login' | 'email_login' | 'verify_otp';

export default function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setAuth } = useUserStore(); 
  
  const [step, setStep] = useState<AuthStep>('checking_env'); 
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [tgUser, setTgUser] = useState<any>(null);

  useEffect(() => {
    const twa = (window as any).Telegram?.WebApp;
    if (twa && twa.initData) {
      twa.ready(); 
      if (twa.initDataUnsafe?.user) {
        setTgUser(twa.initDataUnsafe.user);
      }
      setStep('telegram_login'); 
    } else {
      setStep('email_login'); 
    }
  }, []);

  const handleTelegramLogin = async () => {
    setLoading(true);
    const twa = (window as any).Telegram.WebApp;
    const initData = twa.initData;
    const tmaToken = `tma ${initData}`;
    
    try {
      setAuth({ token: tmaToken, tgData: initData });
      localStorage.setItem('jwt_token', tmaToken); 
      
      const res: any = await api.get('/user/me');
      navigate(res.data.userType === 'child' ? '/child' : '/parent');
    } catch (err: any) {
      // 捕获 404，直接路由跳转至独立页面
      if (err.errorCode === 'ERR_USER_NOT_FOUND' || err.response?.status === 404) {
        navigate('/onboarding'); 
      } else {
        setAuth({ token: undefined, tgData: undefined });
        localStorage.removeItem('jwt_token');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await api.post('/auth/email/send-code', { email, locale: t('language_code') || 'zh-CN' });
      setStep('verify_otp');
      appToast.success(t('auth.code_sent_success', '验证码已发送，请查收邮箱')); 
    } catch (err) {
      // 错误由拦截器处理
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;
    setLoading(true);
    try {
      const res: any = await api.post('/auth/email/verify', { email, code: otp });
      setAuth({ token: res.token });
      localStorage.setItem('jwt_token', res.token);
      
      appToast.success(t('auth.login_success', '验证成功！')); 
      checkUserRegistration(); 
    } catch (err) {
      // 错误由拦截器处理
    } finally {
      setLoading(false);
    }
  };

  const checkUserRegistration = async () => {
    try {
      const res: any = await api.get('/user/me');
      navigate(res.data.userType === 'child' ? '/child' : '/parent');
    } catch (err: any) {
      if (err.errorCode === 'ERR_USER_NOT_FOUND' || err.response?.status === 404) {
        navigate('/onboarding'); 
      }
    }
  };

  if (step === 'checking_env') {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-8 flex flex-col justify-center overflow-y-auto">
      <div className="max-w-md w-full mx-auto bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-6 sm:p-8 space-y-6 my-auto">
        
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-500 rounded-full mx-auto flex items-center justify-center text-white text-3xl shadow-lg">
            ✨
          </div>
          <h2 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
            {t('auth.title_login', '登录与授权')}
          </h2>
        </div>

        {step === 'telegram_login' && (
          <div className="text-center space-y-6 mt-8">
            <div>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {t('auth.tg_greeting', { name: tgUser?.first_name || t('auth.tg_friend') })}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {t('auth.tg_recognized', '已识别到您的 Telegram 身份')}
              </p>
            </div>
            <button
              onClick={handleTelegramLogin}
              disabled={loading}
              className="w-full flex items-center justify-center py-4 px-4 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-xl font-bold text-lg transition-all shadow-md disabled:opacity-70"
            >
              <svg className="w-6 h-6 mr-2 fill-current" viewBox="0 0 24 24">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.892-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              {loading ? t('auth.tg_entering', '进入中...') : t('auth.btn_tg_login', '使用 Telegram 快捷登录')}
            </button>
          </div>
        )}

        {step === 'email_login' && (
          <form onSubmit={handleSendCode} className="space-y-4 mt-8">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                {t('auth.email_label', '您的电子邮箱')}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.email_placeholder', 'example@email.com')}
                className="w-full p-4 border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? t('auth.sending', '发送中...') : t('auth.btn_send_code', '获取验证码')}
            </button>
          </form>
        )}

        {step === 'verify_otp' && (
          <form onSubmit={handleVerify} className="space-y-4 mt-8">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                {t('auth.otp_label', '请输入验证码')}
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="------"
                className="w-full p-4 border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-mono uppercase text-xl tracking-widest text-center focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              <p className="text-sm text-gray-500 mt-3 text-center">
                {t('auth.otp_sent_to', '验证码已发送至')} <span className="font-bold text-gray-700 dark:text-gray-300">{email}</span>
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? '...' : t('auth.btn_verify', '验证并登录')}
            </button>
            <button 
              type="button" 
              onClick={() => setStep('email_login')}
              className="w-full py-3 text-sm font-bold text-gray-500 hover:text-blue-500 transition-colors"
            >
              {t('auth.change_email', '更换邮箱')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}