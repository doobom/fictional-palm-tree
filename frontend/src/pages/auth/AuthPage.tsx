import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api/request';
import OnboardingForm from './OnboardingForm';
import { appToast } from '../../utils/toast'; // 🌟 引入全局 Toast

type AuthStep = 'checking_env' | 'telegram_login' | 'email_login' | 'verify_otp' | 'onboarding';

export default function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
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
      localStorage.setItem('jwt_token', tmaToken);
      const res: any = await api.get('/me');
      navigate(res.data.userType === 'child' ? '/child' : '/parent');
    } catch (err: any) {
      if (err.type === 'NEED_REGISTER' || err.response?.status === 404 || err.response?.status === 401) {
        setStep('onboarding'); 
      } else {
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
      appToast.success(t('auth.code_sent_success', '验证码已发送，请查收邮箱')); // 🌟
    } catch (err) {
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
      localStorage.setItem('jwt_token', res.token);
      appToast.success(t('auth.login_success', '验证成功！')); // 🌟
      checkUserRegistration(); 
    } catch (err) {
      appToast.error(t('auth.verify_failed', '验证码错误或已过期')); // 🌟
    } finally {
      setLoading(false);
    }
  };

  const checkUserRegistration = async () => {
    try {
      const res: any = await api.get('/me');
      navigate(res.data.userType === 'child' ? '/child' : '/parent');
    } catch (err: any) {
      if (err.type === 'NEED_REGISTER' || err.response?.status === 404) {
        setStep('onboarding');
      }
    }
  };

  if (step === 'checking_env') {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-6">
        
        {step !== 'onboarding' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-500 rounded-full mx-auto flex items-center justify-center text-white text-3xl shadow-lg">
              ✨
            </div>
            <h2 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
              {t('auth.title_login')}
            </h2>
          </div>
        )}

        {/* 🌟 Telegram 视图多语言修复 */}
        {step === 'telegram_login' && (
          <div className="text-center space-y-6 mt-8">
            <div>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {t('auth.tg_greeting', { name: tgUser?.first_name || t('auth.tg_friend') })}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {t('auth.tg_recognized')}
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
              {loading ? t('auth.tg_entering') : t('auth.btn_tg_login')}
            </button>
            <p className="text-xs text-gray-400">
              {t('auth.tg_secure_tip')}
            </p>
          </div>
        )}

        {step === 'email_login' && (
          <form onSubmit={handleSendCode} className="space-y-4 mt-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('auth.email_label')}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.email_placeholder')}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors duration-200"
            >
              {loading ? t('auth.sending') : t('auth.btn_send_code')}
            </button>
          </form>
        )}

        {/* 🌟 OTP 视图多语言修复 */}
        {step === 'verify_otp' && (
          <form onSubmit={handleVerify} className="space-y-4 mt-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('auth.otp_label')}
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="------"
                className="w-full px-4 py-3 tracking-widest text-center text-xl rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono"
              />
              <p className="text-sm text-gray-500 mt-2 text-center">
                {t('auth.otp_sent_to')} <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span>
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors duration-200"
            >
              {loading ? '...' : t('auth.btn_verify')}
            </button>
            <button 
              type="button" 
              onClick={() => setStep('email_login')}
              className="w-full text-sm text-gray-500 hover:text-blue-500 mt-2"
            >
              {t('auth.change_email')}
            </button>
          </form>
        )}

        {step === 'onboarding' && <OnboardingForm />}

      </div>
    </div>
  );
}