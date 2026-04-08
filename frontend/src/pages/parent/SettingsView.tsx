// frontend/src/pages/parent/SettingsView.tsx
import React, { useEffect, useState } from 'react';
import { useUserStore, Child } from '../../store';
import service, { ApiResponse } from '../../api/request';
import { appToast } from '../../utils/toast';

// 局部折叠组件
const Section: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode }> = ({ title, defaultOpen = false, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-4">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-5 bg-white active:bg-gray-50">
        <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        <span className={`text-gray-400 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {isOpen && <div className="p-5 pt-0 border-t border-gray-50 animate-fade-in">{children}</div>}
    </section>
  );
};

export default function SettingsView() {
  const { currentFamilyId, families, childrenList, setChildrenList, setUserInfo } = useUserStore();
  const [members, setMembers] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const myRole = families.find(f => f.id === currentFamilyId)?.role;
  const isAdmin = myRole === 'admin' || myRole === 'superadmin';

  // 状态：编辑家庭
  const [isEditingFamily, setIsEditingFamily] = useState(false);
  const [editFamilyData, setEditFamilyData] = useState({ name: '', point_name: '', point_emoji: '', avatar: '' });

  // 状态：添加/编辑孩子
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [childForm, setChildForm] = useState({ id: '', name: '', avatar: '👦' });

  // 状态：各种弹窗
  const [inviteModal, setInviteModal] = useState<{ title: string, code: string; link: string, desc: string } | null>(null);

  useEffect(() => {
    if (currentFamilyId) fetchFamilyData();
  }, [currentFamilyId]);

  const fetchFamilyData = async () => {
    setLoading(true);
    try {
      const res = await service.get<any, ApiResponse>('/family/config');
      if (res.success) {
        setMembers(res.data.members || []);
        setConfig(res.data.config);
        setEditFamilyData({
          name: res.data.config.name,
          point_name: res.data.config.point_name,
          point_emoji: res.data.config.point_emoji,
          avatar: res.data.config.avatar || '🏠'
        });
      }
    } finally { setLoading(false); }
  };

  const handleSaveFamily = async () => {
    try {
      const res = await service.put<any, ApiResponse>('/family/config', editFamilyData);
      if (res.success) {
        appToast.success('家庭信息已更新');
        setConfig({ ...config, ...editFamilyData });
        setIsEditingFamily(false);
        const userRes = await service.get<any, ApiResponse>('/user/me');
        if (userRes.success) setUserInfo(userRes.data);
      }
    } catch (e) { appToast.error('保存失败'); }
  };

  const handleSaveChild = async () => {
    if (!childForm.name.trim()) return appToast.warn('请输入孩子昵称');
    
    try {
      if (childForm.id) {
        // 编辑
        await service.put(`/children/${childForm.id}`, { name: childForm.name, avatar: childForm.avatar });
        setChildrenList(childrenList.map(c => c.id === childForm.id ? { ...c, ...childForm } : c));
        appToast.success('资料已更新');
      } else {
        // 新增
        const res = await service.post<any, ApiResponse>('/children', { name: childForm.name, avatar: childForm.avatar });
        if (res.success) {
          setChildrenList([...childrenList, { id: res.data?.id || Date.now().toString(), name: childForm.name, avatar: childForm.avatar, balance: 0 }]);
          appToast.success('添加成功');
        }
      }
      setIsAddingChild(false);
      setChildForm({ id: '', name: '', avatar: '👦' });
    } catch (e) { appToast.error('操作失败'); }
  };

  // 生成家长邀请码或孩子绑定码
  const handleGenerateCode = async (type: 'admin' | 'child', targetChildId?: string) => {
    appToast.info('正在生成安全凭证...');
    try {
      const payload = type === 'child' ? { type: 'child', childId: targetChildId } : { type: 'admin' };
      const res = await service.post<any, ApiResponse>('/auth/generate-invite', payload);
      
      if (res.success) {
        setInviteModal({
          title: type === 'child' ? '孩子设备绑定码' : '邀请家人加入',
          code: res.data.code,
          link: res.data.inviteLink,
          desc: type === 'child' ? '在孩子的手机或平板上，输入此绑定码即可登录。' : '家人通过此码或链接加入您的家庭。'
        });
      }
    } catch (err) { appToast.error('生成失败'); }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      appToast.success('复制成功！');
    } catch (err) { appToast.error('复制失败，请手动选中复制'); }
  };

  if (loading && !config) return <div className="p-10 text-center">加载中...</div>;

  return (
    <div className="settings-container p-4 pb-28 pt-8">
      
      {/* 1. 基础设置 */}
      <Section title="⚙️ 基础设置" defaultOpen={true}>
        {isEditingFamily ? (
          <div className="space-y-4">
            <div className="flex gap-2">
               <div className="w-20">
                <label className="block text-xs font-bold text-gray-500 mb-1">家庭图标</label>
                <input type="text" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-center" value={editFamilyData.avatar} onChange={e => setEditFamilyData({...editFamilyData, avatar: e.target.value})} />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 mb-1">家庭名称</label>
                <input type="text" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" value={editFamilyData.name} onChange={e => setEditFamilyData({...editFamilyData, name: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="w-20">
                <label className="block text-xs font-bold text-gray-500 mb-1">代币图标</label>
                <input type="text" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-center" value={editFamilyData.point_emoji} onChange={e => setEditFamilyData({...editFamilyData, point_emoji: e.target.value})} />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 mb-1">代币名称</label>
                <input type="text" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" value={editFamilyData.point_name} onChange={e => setEditFamilyData({...editFamilyData, point_name: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setIsEditingFamily(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-600">取消</button>
              <button onClick={handleSaveFamily} className="flex-1 py-3 bg-blue-600 rounded-xl font-bold text-white shadow-md">保存</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-gray-500 font-medium">家庭名称</span>
              <span className="font-bold text-gray-800">{config?.avatar} {config?.name}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-gray-500 font-medium">代币单位</span>
              <span className="font-bold text-gray-800">{config?.point_emoji} {config?.point_name}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-500 font-medium">我的角色</span>
              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-black uppercase">{myRole}</span>
            </div>
            {isAdmin && <button onClick={() => setIsEditingFamily(true)} className="w-full py-3 bg-gray-50 text-blue-600 font-bold rounded-xl">✏️ 编辑基础信息</button>}
          </div>
        )}
      </Section>

      {/* 2. 孩子管理 */}
      <Section title="👶 孩子管理" defaultOpen={true}>
        <div className="space-y-3 pt-2">
          {childrenList.map((child: Child) => (
            <div key={child.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              {isAddingChild && childForm.id === child.id ? (
                <div className="flex gap-2">
                  <button onClick={() => setChildForm({...childForm, avatar: childForm.avatar === '👦' ? '👧' : '👦'})} className="w-12 h-12 bg-gray-50 rounded-xl text-2xl border border-gray-200">{childForm.avatar}</button>
                  <input type="text" value={childForm.name} onChange={e => setChildForm({...childForm, name: e.target.value})} className="flex-1 px-3 rounded-xl border border-gray-200 bg-gray-50" />
                  <button onClick={handleSaveChild} className="px-4 bg-green-500 text-white font-bold rounded-xl">✓</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl bg-gray-50 p-2 rounded-xl">{child.avatar}</span>
                      <span className="font-bold text-gray-800 text-lg">{child.name}</span>
                    </div>
                    {isAdmin && <button onClick={() => { setChildForm({ id: child.id, name: child.name, avatar: child.avatar }); setIsAddingChild(true); }} className="text-blue-600 font-bold px-3 py-1.5 bg-blue-50 rounded-xl text-sm">编辑</button>}
                  </div>
                  {isAdmin && (
                    <button onClick={() => handleGenerateCode('child', child.id)} className="w-full py-2 bg-gray-50 text-gray-600 text-sm font-bold rounded-xl border border-gray-200">
                      📱 获取设备绑定码
                    </button>
                  )}
                </>
              )}
            </div>
          ))}

          {/* 新增孩子的表单 */}
          {isAddingChild && !childForm.id && (
             <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 animate-fade-in">
              <div className="flex gap-2 mb-3">
                <button onClick={() => setChildForm({...childForm, avatar: childForm.avatar === '👦' ? '👧' : '👦'})} className="w-12 h-12 bg-white rounded-xl text-2xl border border-blue-200">{childForm.avatar}</button>
                <input type="text" autoFocus placeholder="孩子昵称" value={childForm.name} onChange={e => setChildForm({...childForm, name: e.target.value})} className="flex-1 px-3 rounded-xl border border-blue-200 bg-white" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setIsAddingChild(false); setChildForm({id:'', name:'', avatar:'👦'}); }} className="flex-1 py-2 bg-white text-gray-600 font-bold rounded-xl">取消</button>
                <button onClick={handleSaveChild} className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-xl">保存添加</button>
              </div>
            </div>
          )}

          {isAdmin && !isAddingChild && (
            <button onClick={() => { setChildForm({ id: '', name: '', avatar: '👦' }); setIsAddingChild(true); }} className="w-full py-3 border-2 border-dashed border-gray-200 text-gray-500 font-bold rounded-xl">
              + 添加新孩子
            </button>
          )}
        </div>
      </Section>

      {/* 3. 家长成员 */}
      <Section title="👥 家长成员">
        <div className="space-y-3 pt-2">
          {members.map(member => (
            <div key={member.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-2xl">
              <span className="text-3xl bg-white p-2 rounded-xl">{member.avatar}</span>
              <div className="flex-1">
                <p className="font-bold text-gray-800 text-base">{member.nick_name}</p>
                <p className="text-xs text-gray-500 font-bold">{member.role}</p>
              </div>
            </div>
          ))}
          {isAdmin && (
            <button onClick={() => handleGenerateCode('admin')} className="w-full py-3 bg-blue-50 text-blue-600 font-bold rounded-xl">
              + 邀请家人加入
            </button>
          )}
        </div>
      </Section>

      {/* 通用邀请/绑定码弹窗 */}
      {inviteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setInviteModal(null)} className="absolute right-4 top-4 w-8 h-8 bg-gray-100 rounded-full text-gray-500 font-bold">✕</button>
            <div className="text-center mt-2">
              <h2 className="text-2xl font-black text-gray-800 mb-2">{inviteModal.title}</h2>
              <p className="text-gray-500 text-sm mb-6">{inviteModal.desc}</p>
              
              <div className="bg-gray-50 p-4 rounded-2xl mb-6 border-2 border-dashed border-gray-300">
                <p className="text-4xl font-mono font-black text-blue-600 tracking-widest">{inviteModal.code}</p>
                <p className="text-xs text-gray-400 mt-2">有效期 7 天</p>
              </div>

              <div className="space-y-3">
                <button onClick={() => copyToClipboard(inviteModal.code)} className="w-full py-4 bg-gray-100 text-gray-800 font-bold rounded-xl">
                  只复制凭证码
                </button>
                <button onClick={() => copyToClipboard(`【FamilyPoints】${inviteModal.title}\n凭证码：${inviteModal.code}\n快速链接：${inviteModal.link}`)} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200">
                  复制完整链接发送
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}