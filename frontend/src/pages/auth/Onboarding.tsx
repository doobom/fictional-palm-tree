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

  // 状态管理：是在创建还是在加入
  const [mode, setMode] = useState<'create' | 'join'>('join');
  const [loading, setLoading] = useState(false);
  
  // 表单字段
  const [formData, setFormData] = useState({
    familyName: '',
    nickName: '',
    inviteCode: '',
    avatar: '👤'
  });

  // 自动从 URL 或 TG 启动参数中读取邀请码
  useEffect(() => {
    // 优先读取 Telegram 传入的 startapp 参数
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
        
        // 重新获取完整的用户信息和家庭列表以刷新 Store
        const userRes = await service.get<any, ApiResponse<UserInfo>>('/user/me');
        if (userRes.success) {
          setUserInfo(userRes.data);
          navigate('/parent'); // 跳转至家长主页
        }
      }
    } catch (err: any) {
      // 错误已由拦截器处理
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="onboarding-container p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-center">
        {mode === 'create' ? '✨ 创建您的新家庭' : '🏠 加入现有家庭'}
      </h1>

      <div className="flex mb-8 bg-gray-100 p-1 rounded-lg">
        <button 
          className={`flex-1 py-2 rounded-md ${mode === 'join' ? 'bg-white shadow' : ''}`}
          onClick={() => setMode('join')}
        >
          加入家庭
        </button>
        <button 
          className={`flex-1 py-2 rounded-md ${mode === 'create' ? 'bg-white shadow' : ''}`}
          onClick={() => setMode('create')}
        >
          创建家庭
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 公共字段：您的昵称 */}
        <div>
          <label className="block text-sm font-medium mb-1">您的昵称</label>
          <input 
            type="text" 
            required
            className="w-full p-3 border rounded-lg"
            value={formData.nickName}
            onChange={(e) => setFormData({...formData, nickName: e.target.value})}
            placeholder="例如：爸爸、妈妈"
          />
        </div>

        {mode === 'create' ? (
          <div>
            <label className="block text-sm font-medium mb-1">家庭名称</label>
            <input 
              type="text" 
              required
              className="w-full p-3 border rounded-lg"
              value={formData.familyName}
              onChange={(e) => setFormData({...formData, familyName: e.target.value})}
              placeholder="例如：快乐的一家人"
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1">8位邀请码</label>
            <input 
              type="text" 
              required
              className="w-full p-3 border rounded-lg font-mono uppercase"
              value={formData.inviteCode}
              onChange={(e) => setFormData({...formData, inviteCode: e.target.value.toUpperCase()})}
              placeholder="请输入邀请码"
            />
          </div>
        )}

        <button 
          disabled={loading}
          type="submit"
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold mt-4 disabled:opacity-50"
        >
          {loading ? '处理中...' : (mode === 'create' ? '立即创建' : '立即加入')}
        </button>
      </form>
    </div>
  );
};

export default Onboarding;