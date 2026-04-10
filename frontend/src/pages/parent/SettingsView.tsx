// frontend/src/pages/parent/SettingsView.tsx
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUserStore, Child } from '../../store';
import service, { ApiResponse } from '../../api/request';
import { appToast } from '../../utils/toast';
import { VERSION_INFO } from '../../version';
import { SUPPORTED_LANGUAGES } from '../../locales/index';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast'; // 🌟 用于 loading 提示

import BottomDrawer from '../../components/BottomDrawer';
import Section from '../../components/Section';
import CategoryManagerDrawer from './CategoryManagerDrawer';

import { 
  Settings, Baby, ShieldCheck, Copy, Smartphone, Plus, 
  UserCircle, Tags, Trash2, HelpCircle, Info, MessageSquare, ChevronRight, 
  Globe, Calendar, MapPin, Edit3, Sun, Moon, X, Check, Globe2
} from 'lucide-react'; 

export default function SettingsView() {
  const { currentFamilyId, families, childrenList, setChildrenList } = useUserStore();
  const { i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState<'profile' | 'basic' | 'categories' | 'children' | 'members'>('profile');

  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;

  const [userProfile, setUserProfile] = useState<{nick_name: string, avatar: string, id: string | number, locale?: string} | null>(null);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [profileData, setProfileData] = useState({ 
    nick_name: tgUser ? `${tgUser.first_name} ${tgUser.last_name || ''}`.trim() : '', 
    avatar: '🧑', 
    locale: tgUser?.language_code || 'zh-CN' // 🌟 映射为 locale
  });

  const [config, setConfig] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [isFamilyDrawerOpen, setIsFamilyDrawerOpen] = useState(false);
  const [editFamilyData, setEditFamilyData] = useState({ name: '', point_name: '', point_emoji: '', avatar: '', timezone: 'Asia/Shanghai' });

  const [categories, setCategories] = useState<any[]>([]);
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);

  const [isChildDrawerOpen, setIsChildDrawerOpen] = useState(false);
  const [childForm, setChildForm] = useState({ id: '', name: '', avatar: '👦', birthday: '' });

  const [inviteModal, setInviteModal] = useState<{ title: string, code: string; link: string, desc: string } | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const myRole = families.find(f => f.id === currentFamilyId)?.role;
  const isAdmin = myRole === 'admin' || myRole === 'superadmin';

  // 🌟 新增：读取本地缓存的主题偏好，默认为 'auto'
  const [themePref, setThemePref] = useState(localStorage.getItem('app_theme') || 'auto');

  // 🌟 新增：处理主题切换的函数
  const handleThemeChange = (newTheme: string) => {
    setThemePref(newTheme);
    localStorage.setItem('app_theme', newTheme);
    // 派发全局事件，通知 App.tsx 瞬间更新 DOM 和顶栏颜色
    window.dispatchEvent(new Event('theme-updated')); 
  };

  // 🌟 新增：专门处理 Telegram 原生下拉行为的 useEffect
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg && tg.disableVerticalSwipes) {
      // 进入设置页时，禁用原生的垂直下拉 (彻底解决下拉黑边和误触关闭)
      try { tg.disableVerticalSwipes(); } catch (e) {}
    }

    // 可选：如果你希望离开设置页时恢复下拉，就加上这句 return
    /*
    return () => {
      if (tg && tg.enableVerticalSwipes) {
        try { tg.enableVerticalSwipes(); } catch (e) {}
      }
    };
    */
  }, []);

  useEffect(() => {
    if (currentFamilyId) fetchFamilyData();
    fetchCategories();
    
    // 🌟 核心修复 1：适配后端的嵌套数据结构 res.data.user
    service.get<any, ApiResponse>('/user/me').then(res => {
      if (res.success && res.data && res.data.user) {
        const u = res.data.user;
        setUserProfile(u);
        setProfileData({
          nick_name: u.nick_name || profileData.nick_name,
          avatar: u.avatar || '🧑',
          locale: u.locale || profileData.locale
        });
      }
    }).catch(() => {});
  }, [currentFamilyId]);

  const fetchFamilyData = async () => {
    setLoading(true);
    try {
      const res = await service.get<any, ApiResponse>('/family/config');
      if (res.success) {
        setMembers(res.data.members || []); setConfig(res.data.config);
        setEditFamilyData({ 
          name: res.data.config.name, point_name: res.data.config.point_name, 
          point_emoji: res.data.config.point_emoji, avatar: res.data.config.avatar || '🏠',
          timezone: res.data.config.timezone || 'Asia/Shanghai'
        });
      }
    } finally { setLoading(false); }
  };

  const fetchCategories = async () => {
    try { const res = await service.get<any, ApiResponse>('/categories/list'); if (res.success || res.data) setCategories(res.data || res); } catch (e) {}
  };

  const handleSaveProfile = async () => {
    if (!profileData.nick_name.trim()) return appToast.warn('昵称不能为空');
    try { 
      const payload = {
        nickName: profileData.nick_name,
        avatar: profileData.avatar,
        locale: profileData.locale
      };
      
      const res = await service.put<any, ApiResponse>('/user/profile', payload); 
      
      if(res.success){ 
        appToast.success('个人资料已更新'); 
        
        const currentUserId = userProfile?.id || tgUser?.id || '';

        // 1. 更新顶部的个人资料卡片
        setUserProfile(prev => ({ 
          ...prev!, 
          nick_name: profileData.nick_name, 
          avatar: profileData.avatar, 
          locale: profileData.locale, 
          id: currentUserId 
        })); 

        // 🌟 2. 核心修复：同步更新“家长成员”列表中的数据
        setMembers(prevMembers => 
          prevMembers.map(m => 
            String(m.id) === String(currentUserId) 
              ? { ...m, nick_name: profileData.nick_name, avatar: profileData.avatar } 
              : m
          )
        );
        
        // 3. 动态切换系统语言
        if (i18n && typeof i18n.changeLanguage === 'function') i18n.changeLanguage(profileData.locale);
        
        setIsProfileDrawerOpen(false); 
      } 
    } catch(e) { 
      appToast.error('保存失败，请稍后重试'); 
    } 
  };

  const handleSaveFamily = async () => {
    if (!editFamilyData.name.trim()) return appToast.warn('家庭名称不能为空');
    try { 
      const res = await service.put<any, ApiResponse>('/family/config', editFamilyData); 
      if(res.success){ appToast.success('家庭信息已更新'); setConfig({...config, ...editFamilyData}); setIsFamilyDrawerOpen(false); } 
    } catch(e) {} 
  };

  const handleSaveChild = async () => {
    if (!childForm.name.trim()) return appToast.warn('请输入孩子昵称');
    try {
      if (childForm.id) { 
        await service.put(`/children/${childForm.id}`, childForm); 
        setChildrenList(childrenList.map(c => c.id === childForm.id ? { ...c, ...childForm } : c)); 
        appToast.success('孩子资料已更新'); 
      } else { 
        const res = await service.post<any, ApiResponse>('/children', childForm); 
        if (res.success) { 
          setChildrenList([...childrenList, { ...childForm, id: res.data?.id || Date.now().toString(), balance: 0 }]); 
          appToast.success('孩子添加成功'); 
        } 
      }
      setIsChildDrawerOpen(false);
    } catch (e) { appToast.error('操作失败'); } 
  };

  const handleGenerateCode = async (type: 'admin' | 'child', targetChildId?: string) => {
    // 🌟 修复 3：调用原生的 loading，配合你在 App.tsx 中配置的彩色样式
    const toastId = toast.loading('正在提取安全凭证...');
    try { 
      const res: any = await service.post('/auth/generate-invite', type === 'child' ? { type: 'child', childId: targetChildId } : { type: 'admin' });
      toast.dismiss(toastId);
      if (res.success) setInviteModal({ title: type === 'child' ? '孩子设备绑定码' : '邀请家人加入', code: res.code || res.data?.code || 'ERROR', link: res.inviteLink || res.data?.inviteLink || '', desc: type === 'child' ? '在孩子的设备上输入此绑定码即可登录。' : '家人通过此码或链接加入您的家庭。' });
    } catch (err) {
      toast.dismiss(toastId);
      appToast.error('提取失败');
    } 
  };

  const handleSendFeedback = async () => {
    if (!feedbackText.trim()) return appToast.warn('请输入反馈内容哦');
    setIsSubmittingFeedback(true);
    try {
      await service.post('/system/feedback', { text: feedbackText });
      appToast.success('感谢反馈！管理员已收到您的消息。');
      setFeedbackOpen(false); setFeedbackText('');
    } catch (err) { appToast.error('发送失败，请稍后重试'); } finally { setIsSubmittingFeedback(false); }
  };

  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); appToast.success('内容已复制到剪贴板！'); } catch (err) {} 
  };

  const handleClearCache = () => {
    try { localStorage.clear(); sessionStorage.clear(); } catch(e) {}
    appToast.success('缓存清理成功，正在重启...');
    setTimeout(() => { window.location.reload(); }, 1500);
  };

  const displayNickName = userProfile?.nick_name || '未设置昵称';
  const displayAvatar = userProfile?.avatar || '🧑';
  const currentLangLabel = SUPPORTED_LANGUAGES.find(l => l.code === profileData.locale)?.label || '简体中文';

  if (loading && !config) return <div className="p-10 text-center text-gray-500 font-bold">加载中...</div>;

  return (
    <div className="settings-container p-4 pb-32 pt-8 min-h-full bg-gray-50 dark:bg-gray-900 overscroll-none">
      
      {/* 1. 个人资料 */}
      <Section title="个人资料" icon={<UserCircle size={22} />} isOpen={openSection === 'profile'} onToggle={() => setOpenSection(openSection === 'profile' ? '' : 'profile' as any)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-5xl bg-gray-50 p-2 rounded-2xl shadow-sm border border-gray-100">{displayAvatar}</span>
            <div>
              <p className="font-black text-gray-800 text-xl">{displayNickName}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded-md">ID: {userProfile?.id || tgUser?.id || '未知'}</span>
                <span className="text-xs text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded-md flex items-center gap-1"><Globe size={12}/> {currentLangLabel}</span>
              </div>
            </div>
          </div>
          <button onClick={() => setIsProfileDrawerOpen(true)} className="p-3 bg-blue-50 text-blue-600 rounded-xl active:scale-95 transition-transform"><Edit3 size={20} /></button>
        </div>
      </Section>

      <BottomDrawer isOpen={isProfileDrawerOpen} onClose={() => setIsProfileDrawerOpen(false)} title="编辑个人资料" footer={<button onClick={handleSaveProfile} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-md active:scale-[0.98]">保存资料</button>}>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-24"><label className="block text-sm font-bold text-gray-700 mb-1">头像</label><input type="text" className="w-full h-14 bg-white rounded-xl border border-gray-200 text-center text-3xl focus:ring-2 focus:ring-blue-500 outline-none" value={profileData.avatar} onChange={e => setProfileData({...profileData, avatar: e.target.value})} maxLength={2} /></div>
            <div className="flex-1"><label className="block text-sm font-bold text-gray-700 mb-1">我的昵称</label><input type="text" className="w-full h-14 px-4 bg-white rounded-xl border border-gray-200 font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none" value={profileData.nick_name} onChange={e => setProfileData({...profileData, nick_name: e.target.value})} placeholder="输入你在家庭中的称呼" /></div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><Globe size={16}/> 语言设置 (Language)</label>
            <select className="w-full h-14 px-4 bg-white rounded-xl border border-gray-200 font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none appearance-none" value={profileData.locale} onChange={e => setProfileData({...profileData, locale: e.target.value})}>
              {SUPPORTED_LANGUAGES.map((lang) => (<option key={lang.code} value={lang.code}>{lang.label} ({lang.code})</option>))}
            </select>
          </div>
          {/* 🌟 新增：外观主题设置 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1">
              <Sun size={16}/> 外观主题 (Theme)
            </label>
            <select 
              className="w-full h-14 px-4 bg-white rounded-xl border border-gray-200 font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none appearance-none" 
              value={themePref} 
              onChange={e => handleThemeChange(e.target.value)}
            >
              <option value="auto">自动 (跟随 Telegram)</option>
              <option value="light">浅色模式 (Light)</option>
              <option value="dark">深色模式 (Dark)</option>
            </select>
          </div>
        </div>
      </BottomDrawer>

      {/* 2. 基础设置 */}
      <Section title="基础设置" icon={<Settings size={22} />} isOpen={openSection === 'basic'} onToggle={() => setOpenSection(openSection === 'basic' ? '' : 'basic' as any)}>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-gray-50"><span className="text-gray-500 font-medium">家庭名称</span><span className="font-bold text-gray-800 text-lg">{config?.avatar} {config?.name}</span></div>
          <div className="flex justify-between items-center py-2 border-b border-gray-50"><span className="text-gray-500 font-medium">代币单位</span><span className="font-bold text-gray-800 text-lg">{config?.point_emoji} {config?.point_name}</span></div>
          <div className="flex justify-between items-center py-2 border-b border-gray-50"><span className="text-gray-500 font-medium">所在区/时区</span><span className="font-bold text-gray-800">{config?.timezone || 'Asia/Shanghai'}</span></div>
          <div className="flex justify-between items-center py-2"><span className="text-gray-500 font-medium">我的角色</span><span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-black uppercase">{myRole}</span></div>
          {isAdmin && <button onClick={() => setIsFamilyDrawerOpen(true)} className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl flex items-center justify-center gap-2"><Edit3 size={18}/> 编辑基础信息</button>}
        </div>
      </Section>

      <BottomDrawer isOpen={isFamilyDrawerOpen} onClose={() => setIsFamilyDrawerOpen(false)} title="编辑家庭基础信息" footer={<button onClick={handleSaveFamily} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-md active:scale-[0.98]">保存设置</button>}>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-24"><label className="block text-sm font-bold text-gray-700 mb-1">家庭图标</label><input type="text" className="w-full h-14 bg-white rounded-xl border border-gray-200 text-center text-2xl focus:ring-2 focus:ring-blue-500 outline-none" value={editFamilyData.avatar} onChange={e => setEditFamilyData({...editFamilyData, avatar: e.target.value})} maxLength={2} /></div>
            <div className="flex-1"><label className="block text-sm font-bold text-gray-700 mb-1">家庭名称</label><input type="text" className="w-full h-14 px-4 bg-white rounded-xl border border-gray-200 font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none" value={editFamilyData.name} onChange={e => setEditFamilyData({...editFamilyData, name: e.target.value})} /></div>
          </div>
          <div className="flex gap-3">
            <div className="w-24"><label className="block text-sm font-bold text-gray-700 mb-1">代币图标</label><input type="text" className="w-full h-14 bg-white rounded-xl border border-gray-200 text-center text-2xl focus:ring-2 focus:ring-blue-500 outline-none" value={editFamilyData.point_emoji} onChange={e => setEditFamilyData({...editFamilyData, point_emoji: e.target.value})} maxLength={2} /></div>
            <div className="flex-1"><label className="block text-sm font-bold text-gray-700 mb-1">代币名称</label><input type="text" className="w-full h-14 px-4 bg-white rounded-xl border border-gray-200 font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none" value={editFamilyData.point_name} onChange={e => setEditFamilyData({...editFamilyData, point_name: e.target.value})} /></div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><MapPin size={16}/> 所在区/时区 (Timezone)</label>
            <select className="w-full h-14 px-4 bg-white rounded-xl border border-gray-200 font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none appearance-none" value={editFamilyData.timezone} onChange={e => setEditFamilyData({...editFamilyData, timezone: e.target.value})}>
              <option value="Asia/Shanghai">中国标准时间 (Asia/Shanghai)</option>
              <option value="Asia/Hong_Kong">香港时间 (Asia/Hong_Kong)</option>
              <option value="Asia/Taipei">台北时间 (Asia/Taipei)</option>
              <option value="America/New_York">美西时间 (America/New_York)</option>
              <option value="America/Los_Angeles">美东时间 (America/Los_Angeles)</option>
              <option value="Europe/London">伦敦时间 (Europe/London)</option>
            </select>
          </div>
        </div>
      </BottomDrawer>

      {/* 3. 商品分类 */}
      <Section title="商品分类" icon={<Tags size={22} />} isOpen={openSection === 'categories'} onToggle={() => setOpenSection(openSection === 'categories' ? '' : 'categories' as any)}>
        <div className="pt-2 space-y-4">
          {categories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (<div key={cat.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl shadow-sm"><span className="text-base">{cat.emoji || '🏷️'}</span><span className="text-sm font-bold text-gray-700">{cat.name}</span></div>))}
            </div>
          ) : (
            <div className="text-center py-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200"><p className="text-sm text-gray-500 font-medium">暂无分类数据，请在管理台中添加</p></div>
          )}
          <div onClick={() => setIsCategoryDrawerOpen(true)} className="flex items-center justify-between bg-blue-50 hover:bg-blue-100 active:scale-[0.98] transition-all p-4 rounded-2xl cursor-pointer">
            <div><p className="font-bold text-blue-800 text-base">打开分类管理台</p><p className="text-xs text-blue-600 mt-1 font-medium">新增、修改或删除商品分类</p></div>
            <div className="bg-white p-2 rounded-xl shadow-sm"><ChevronRight className="text-blue-500" size={20} /></div>
          </div>
        </div>
      </Section>

      {/* 4. 孩子管理 */}
      <Section title="孩子管理" icon={<Baby size={22} />} isOpen={openSection === 'children'} onToggle={() => setOpenSection(openSection === 'children' ? '' : 'children' as any)}>
        <div className="space-y-3 pt-2">
          {childrenList.map((child: Child | any) => (
            <div key={child.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm relative">
              <div className="flex items-center gap-4">
                <span className="text-4xl bg-gray-50 p-2 rounded-xl border border-gray-100">{child.avatar}</span>
                <div>
                  <span className="font-bold text-gray-800 text-lg block">{child.name}</span>
                  {child.birthday && (
                    <span className="text-xs font-bold text-orange-500 flex items-center gap-1 mt-1 bg-orange-50 inline-block px-2 py-0.5 rounded-md"><Calendar size={12} /> {child.birthday}</span>
                  )}
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {isAdmin && <button onClick={() => { setChildForm({ id: child.id, name: child.name, avatar: child.avatar, birthday: child.birthday || '' }); setIsChildDrawerOpen(true); }} className="flex-1 py-2 bg-gray-50 text-gray-700 font-bold rounded-xl text-sm flex items-center justify-center gap-1"><Edit3 size={14}/> 编辑</button>}
                {isAdmin && <button onClick={() => handleGenerateCode('child', child.id)} className="flex-1 py-2 bg-blue-50 text-blue-600 font-bold rounded-xl text-sm flex items-center justify-center gap-1"><Smartphone size={14}/> 绑定码</button>}
              </div>
            </div>
          ))}
          {isAdmin && <button onClick={() => { setChildForm({ id: '', name: '', avatar: '👦', birthday: '' }); setIsChildDrawerOpen(true); }} className="w-full flex justify-center items-center gap-2 py-4 border-2 border-dashed border-gray-200 text-gray-500 font-bold rounded-xl hover:bg-gray-50 active:scale-95 transition-transform"><Plus size={18} /> 添加新孩子</button>}
        </div>
      </Section>

      <BottomDrawer isOpen={isChildDrawerOpen} onClose={() => setIsChildDrawerOpen(false)} title={childForm.id ? "编辑孩子资料" : "添加新孩子"} footer={<button onClick={handleSaveChild} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-md active:scale-[0.98]">保存资料</button>}>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-24"><label className="block text-sm font-bold text-gray-700 mb-1">头像</label><input type="text" className="w-full h-14 bg-white rounded-xl border border-gray-200 text-center text-3xl focus:ring-2 focus:ring-blue-500 outline-none" value={childForm.avatar} onChange={e => setChildForm({...childForm, avatar: e.target.value})} maxLength={2} /></div>
            <div className="flex-1"><label className="block text-sm font-bold text-gray-700 mb-1">孩子昵称/小名</label><input type="text" className="w-full h-14 px-4 bg-white rounded-xl border border-gray-200 font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none" value={childForm.name} onChange={e => setChildForm({...childForm, name: e.target.value})} placeholder="输入称呼" /></div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><Calendar size={16}/> 生日 (可选)</label>
            <input type="date" className="w-full h-14 px-4 bg-white rounded-xl border border-gray-200 font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none" value={childForm.birthday} onChange={e => setChildForm({...childForm, birthday: e.target.value})} />
          </div>
        </div>
      </BottomDrawer>

      {/* 5. 家长成员 */}
      <Section title="家长成员" icon={<ShieldCheck size={22} />} isOpen={openSection === 'members'} onToggle={() => setOpenSection(openSection === 'members' ? '' : 'members' as any)}>
        <div className="space-y-3 pt-2">
          {members.map(member => (
            <div key={member.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-2xl"><span className="text-3xl bg-white p-2 rounded-xl">{member.avatar}</span><div className="flex-1"><p className="font-bold text-gray-800 text-base">{member.nick_name}</p><p className="text-xs text-gray-500 font-bold">{member.role}</p></div></div>
          ))}
          {isAdmin && <button onClick={() => handleGenerateCode('admin')} className="w-full flex justify-center items-center gap-2 py-3 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100"><Plus size={18} /> 邀请家人加入</button>}
        </div>
      </Section>

      {/* --- 独立底部分组菜单 --- */}
      <div className="mt-8 px-2 animate-fade-in-up">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <button onClick={() => setFeedbackOpen(true)} className="w-full flex items-center gap-3 p-4 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50">
            <MessageSquare size={20} className="text-orange-500" />
            <span className="font-bold text-gray-800 flex-1 text-left">意见反馈</span>
          </button>
          <button onClick={() => window.Telegram?.WebApp?.openTelegramLink('https://t.me/+-dVp6A1EnMZjOGI1')} className="w-full flex items-center gap-3 p-4 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50">
            <HelpCircle size={20} className="text-blue-500" />
            <span className="font-bold text-gray-800 flex-1 text-left">帮助与支持</span>
          </button>
          <button onClick={handleClearCache} className="w-full flex items-center gap-3 p-4 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors">
            <Trash2 size={20} className="text-red-500" />
            <span className="font-bold text-gray-800 flex-1 text-left">清除本地缓存</span>
          </button>
        </div>
        <p className="text-center text-gray-400 text-xs font-bold mt-6 uppercase tracking-widest flex items-center justify-center gap-1">
          <Info size={12} /> Family Points v{VERSION_INFO.version}
        </p>
      </div>

      {/* --- 全局功能弹窗区 --- */}
      <CategoryManagerDrawer isOpen={isCategoryDrawerOpen} onClose={() => { setIsCategoryDrawerOpen(false); fetchCategories(); }} />

      <BottomDrawer isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} title="意见反馈" footer={<button onClick={handleSendFeedback} disabled={isSubmittingFeedback || !feedbackText.trim()} className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl shadow-lg active:scale-[0.98] disabled:bg-gray-300 disabled:shadow-none transition-all">{isSubmittingFeedback ? '发送中...' : '提交反馈给管理员'}</button>}>
        <p className="text-gray-500 text-sm mb-4 text-center font-medium">有任何问题或建议，请告诉我们。消息将直接发送给系统开发组。</p>
        <textarea className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-gray-800 font-bold outline-none focus:ring-2 focus:ring-orange-500 resize-none h-36" placeholder="请详细描述您的问题..." value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} />
      </BottomDrawer>

      {inviteModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setInviteModal(null)} className="absolute right-4 top-4 w-8 h-8 bg-gray-100 rounded-full text-gray-500 font-bold flex items-center justify-center">✕</button>
            <div className="text-center mt-2">
              <h2 className="text-2xl font-black text-gray-800 mb-2">{inviteModal.title}</h2>
              <p className="text-gray-500 text-sm mb-6">{inviteModal.desc}</p>
              <div className="bg-gray-50 p-4 rounded-2xl mb-6 border-2 border-dashed border-gray-300">
                <p className="text-4xl font-mono font-black text-blue-600 tracking-widest">{inviteModal.code}</p>
                <p className="text-xs text-gray-400 mt-2">有效期 7 天</p>
              </div>
              <div className="space-y-3">
                <button onClick={() => copyToClipboard(inviteModal.code)} className="w-full flex justify-center items-center gap-2 py-4 bg-gray-100 text-gray-800 font-bold rounded-xl active:scale-95 transition-transform"><Copy size={18} /> 复制凭证码</button>
                <button onClick={() => copyToClipboard(`【FamilyPoints】${inviteModal.title}\n凭证码：${inviteModal.code}\n快速链接：${inviteModal.link}`)} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 active:scale-95 transition-transform">复制完整链接发送</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}