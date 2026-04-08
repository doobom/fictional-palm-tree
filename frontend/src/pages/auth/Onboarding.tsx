// frontend/src/pages/auth/Onboarding.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUserStore } from '../../store';
import service, { ApiResponse } from '../../api/request';
import { appToast } from '../../utils/toast';
import { UserInfo } from '../../types/user';

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUserInfo, telegramInitData } = useUserStore();

  const [mode, setMode] = useState<'create' | 'join'>('join');
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    familyName: '',
    nickName: '',
    inviteCode: '',
    avatar: '👤'
  });

  useEffect(() => {
    const tgStartParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    const urlInviteCode = searchParams.get('code');
    
    if (tgStartParam || urlInviteCode) {
      setFormData(prev => ({ ...prev, inviteCode: tgStartParam || urlInviteCode || '' }));
      setMode('join');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = mode === 'create' ? '/auth/create-family' : '/auth/join-family';
      const payload = mode === 'create' 
        ? { familyName: formData.familyName, nickName: formData.nickName, avatar: formData.avatar }
        : { inviteCode: formData.inviteCode, nickName: formData.nickName };

      const res = await service.post<any, ApiResponse>(endpoint, payload);

      if (res.success) {
        appToast.success(mode === 'create' ? '家庭创建成功！' : '成功加入家庭！');
        
        const userRes = await service.get<any, ApiResponse<UserInfo>>('/user/me');
        if (userRes.success) {
          setUserInfo(userRes.data);
          navigate('/parent'); 
        }
      }
    } catch (err: any) {
      // 错误由拦截器处理
    } finally {
      setLoading(false);
    }
  };

  // 🌟 核心修改：赋予 Onboarding 与 AuthPage 完全一致的全屏带暗黑模式布局
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-8 flex flex-col justify-center overflow-y-auto">
      <div className="max-w-md w-full mx-auto bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-6 sm:p-8 space-y-6 my-auto animate-fade-in">
        
        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
          {mode === 'create' ? '✨ 创建新家庭' : '🏠 加入现有家庭'}
        </h1>

        {/* 导航切换按钮 */}
        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
          <button 
            type="button"
            className={`flex-1 py-3 rounded-lg font-bold transition-all ${
              mode === 'join' 
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
            onClick={() => setMode('join')}
          >
            加入家庭
          </button>
          <button 
            type="button"
            className={`flex-1 py-3 rounded-lg font-bold transition-all ${
              mode === 'create' 
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
            onClick={() => setMode('create')}
          >
            创建家庭
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">您的昵称</label>
            <input 
              type="text" 
              required
              className="w-full p-4 border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={formData.nickName}
              onChange={(e) => setFormData({...formData, nickName: e.target.value})}
              placeholder="例如：爸爸、妈妈"
            />
          </div>

          {mode === 'create' ? (
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">家庭名称</label>
              <input 
                type="text" 
                required
                className="w-full p-4 border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={formData.familyName}
                onChange={(e) => setFormData({...formData, familyName: e.target.value})}
                placeholder="例如：快乐的一家人"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">8位邀请码</label>
              <input 
                type="text" 
                required
                className="w-full p-4 border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-mono uppercase text-lg tracking-widest text-center focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={formData.inviteCode}
                onChange={(e) => setFormData({...formData, inviteCode: e.target.value.toUpperCase()})}
                placeholder="ABCDEF12"
                maxLength={8}
              />
            </div>
          )}

          <button 
            disabled={loading}
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95 disabled:opacity-50 mt-2"
          >
            {loading ? '处理中...' : (mode === 'create' ? '立即创建' : '立即加入')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Onboarding;