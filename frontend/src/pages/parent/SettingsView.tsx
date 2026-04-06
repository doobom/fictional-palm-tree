// frontend/src/pages/parent/SettingsView.tsx
import React, { useEffect, useState } from 'react';
import { useUserStore } from '../../store';
import service, { ApiResponse} from '../../api/request';
import { appToast } from '../../utils/toast';

interface FamilyMember {
  id: string;
  nick_name: string;
  avatar: string;
  role: string;
}

const SettingsView: React.FC = () => {
  const { currentFamilyId, families } = useUserStore();
  const [members, setMembers] = useState<FamilyMember[]>();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 获取当前家庭的角色，判断是否有管理权限
  const myRole = families.find(f => f.id === currentFamilyId)?.role;
  const isAdmin = myRole === 'admin' || myRole === 'superadmin';

  useEffect(() => {
    fetchFamilyData();
  }, [currentFamilyId]);

  const fetchFamilyData = async () => {
    setLoading(true);
    try {
      const res = await service.get<any, ApiResponse>('/family/config');
      if (res.success) {
        setMembers(res.data.members);
        setConfig(res.data.config);
      }
    } finally {
      setLoading(false);
    }
  };

  // 生成邀请链接并分享
  const handleGenerateInvite = async () => {
    try {
      const res = await service.post<any, ApiResponse>('/auth/generate-invite', { type: 'admin' });
      if (res.success) {
        const { inviteLink, message } = res.data;
        
        // 调用 Telegram 原生分享或复制到剪贴板
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.switchInlineQuery(inviteLink, ['users', 'groups']);
        } else {
          await navigator.clipboard.writeText(message);
          appToast.success('邀请信息已复制到剪贴板');
        }
      }
    } catch (err) {
      appToast.error('生成失败');
    }
  };

  if (loading) return <div className="p-10 text-center">加载配置中...</div>;

  return (
    <div className="settings-container p-4 space-y-6 pb-20">
      {/* 1. 家庭基础信息卡片 */}
      <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span>⚙️</span> 家庭设置
        </h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-gray-50">
            <span className="text-gray-600">家庭名称</span>
            <span className="font-medium">{config?.name}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-50">
            <span className="text-gray-600">积分名称</span>
            <span className="font-medium">{config?.point_emoji} {config?.point_name}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600">我的角色</span>
            <span className={`px-2 py-1 rounded text-xs font-bold ${
              myRole === 'superadmin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {myRole?.toUpperCase()}
            </span>
          </div>
        </div>
      </section>

      {/* 2. 成员管理逻辑 */}
      <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">👥 家庭成员</h3>
          {isAdmin && (
            <button 
              onClick={handleGenerateInvite}
              className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-full font-medium"
            >
              + 邀请家人
            </button>
          )}
        </div>
        
        <div className="space-y-3">
          {members?.map(member => (
            <div key={member.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-xl">
              <span className="text-2xl">{member.avatar}</span>
              <div className="flex-1">
                <p className="font-bold text-sm">{member.nick_name}</p>
                <p className="text-xs text-gray-500">{member.role}</p>
              </div>
              {/* 如果是超级管理员，可以显示移除按钮 */}
              {myRole === 'superadmin' && member.role !== 'superadmin' && (
                <button className="text-red-500 text-xs font-medium p-2">移除</button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 3. 家庭危险操作 */}
      {myRole === 'superadmin' && (
        <button 
          className="w-full py-4 text-red-500 font-bold bg-red-50 rounded-2xl"
          onClick={() => appToast.info('请长按以确认解散家庭')}
        >
          💥 解散当前家庭
        </button>
      )}
    </div>
  );
};

export default SettingsView;