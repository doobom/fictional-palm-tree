// src/pages/parent/SettingsView.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  User, Home, Users, Settings, Database, ShieldAlert, 
  X, Check, Copy, CheckCircle2, Plus, Edit2, Trash2,
  Moon, Sun, Monitor, Bell, Globe, Tags, Info, 
  DownloadCloud, UploadCloud, LogOut, Loader2, Key,
  HelpCircle, MessageSquare, RotateCcw, Send, Zap,
  AlertTriangle
} from 'lucide-react';

import api from '../../api/request';
import { useAppStore } from '../../store';
import { appToast } from '../../utils/toast';
import { SUPPORTED_LANGUAGES } from '../../locales';
import { VERSION_INFO } from '../../version'; 
import CategoryManagerDrawer from './CategoryManagerDrawer';
import CollapsibleSection from '../../components/CollapsibleSection';
import JSZip from 'jszip';
import WebApp from '@twa-dev/sdk';

// 🌟 常用的 Emoji 网格预设
// 🌟 按场景分类的 Emoji 预设字典
const EMOJI_CATEGORIES = {
  // 1. 个人头像 (User Avatars) - 包含人物、可爱动物、奇幻角色 (孩子最爱)
  user: [
    '👦', '👧', '👨', '👩', '👴', '👵', 
    '🐱', '🐶', '🐰', '🦊', '🐼', '🦁', 
    '🦸‍♂️', '🦸‍♀️', '🧚', '🧙‍♂️', '🥷', '🤖'
  ],
  
  // 2. 家庭头像 (Family Avatars) - 包含房屋、自然、家族徽章、旅行
  family: [
    '🏠', '🏡', '🏰', '⛺', '🏕️', '🚐', 
    '🌳', '🌍', '🛡️', '👑', '👨‍👩‍👧', '👨‍👩‍👦‍👦',
    '🕊️', '☀️', '🌈', '🔥'
  ],
  
  // 3. 积分/货币头像 (Point Icons) - 包含金币、宝石、星星、能量、糖果
  point: [
    '🪙', '💰', '💎', '⭐', '🌟', '✨', 
    '🏆', '🎖️', '⚡', '💡', '🚀', '🎯',
    '🍬', '🍭', '🍦', '🍎'
  ]
};
/**
 * 🌟 自定义 Hook: 用于静默更新的防抖逻辑
 */
function useDebounceEffect(fn: Function, deps: any[], delay: number = 800) {
  useEffect(() => {
    const handler = setTimeout(() => fn(), delay);
    return () => clearTimeout(handler);
  }, deps);
}

export default function SettingsView() {
  const { t, i18n } = useTranslation();
  const { childrenList, setChildrenList } = useAppStore();
  
  // 🌟 直接从 api/me 初始化，减少重复请求
  const [syncing, setSyncing] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [familyProfile, setFamilyProfile] = useState<any>(null);
  const [parentsList, setParentsList] = useState<any[]>([]);

  // 弹窗状态
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [inviteModal, setInviteModal] = useState({ isOpen: false, code: '', type: 'child', copied: false });
  const [emojiPicker, setEmojiPicker] = useState<{ isOpen: boolean, target: string, value: string } | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackContent, setFeedbackContent] = useState('');

  // 🥚 彩蛋逻辑
  const clickCount = useRef(0);
  const handleVersionClick = () => {
    clickCount.current += 1;
    if (clickCount.current === 10) {
      alert(`Debug Info:\nUA: ${navigator.userAgent}\nFamily: ${userInfo?.familyId}\nID: ${userInfo?.internalId}`);
      clickCount.current = 0;
    }
  };

  // 1. 初始化数据
  const fetchData = async () => {
    try {
      const [meRes, childRes, membersRes]: any = await Promise.all([
        api.get('/me'),
        api.get('/children/list'),
        api.get('/family/members') 
      ]);
      setUserInfo(meRes.data);
      setChildrenList(childRes.data);
      setParentsList(membersRes.data.parents || []);
      const f = meRes.data.family;
      if (f) {
        setFamilyProfile({
          name: f.name, avatar: f.avatar || '🏠',
          pointName: f.point_name || '金币', pointEmoji: f.point_emoji || '🪙',
          pushEnabled: f.push_enabled === 1, pushTime: f.push_time || '20:00',
          pushOptions: f.push_options ? JSON.parse(f.push_options) : ['summary']
        });
      }
    } catch (e) {}
  };

  useEffect(() => { fetchData(); }, []);

  // 2. 个人资料静默更新
  // 🌟 静默更新逻辑 (防抖同步)
  useEffect(() => {
    if (!userInfo || !userInfo.isDirty) return;
    const timer = setTimeout(async () => {
      setSyncing(true);
      try {
        await api.put('/user/profile', { 
          nickName: userInfo.nickName, 
          avatar: userInfo.avatar, 
          locale: userInfo.locale 
        });
        if (i18n.language !== userInfo.locale) i18n.changeLanguage(userInfo.locale);
        setUserInfo({ ...userInfo, isDirty: false });
      } finally {
        setSyncing(false);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [userInfo?.nickName, userInfo?.avatar, userInfo?.locale]);

  // 家庭设置静默更新
  useEffect(() => {
    if (!familyProfile || !familyProfile.isDirty) return;
    const timer = setTimeout(async () => {
      setSyncing(true);
      try {
        await api.put('/family/profile', familyProfile);
        setFamilyProfile({ ...familyProfile, isDirty: false });
      } finally {
        setSyncing(false);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [familyProfile]);

  // 生成邀请码
  const handleInvite = async (type: 'parent' | 'child') => {
    try {
      const res: any = await api.post(`/family/invite-code?type=${type}`);
      setInviteModal({ isOpen: true, code: res.code, type, copied: false });
    } catch (err) {}
  };

  // 主题切换逻辑
  const toggleTheme = (mode: 'light' | 'dark' | 'system') => {
    const root = document.documentElement;
    if (mode === 'dark') root.classList.add('dark');
    else if (mode === 'light') root.classList.remove('dark');
    else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add('dark');
      else root.classList.remove('dark');
    }
    localStorage.setItem('theme', mode);
    appToast.success(t('parent.theme_updated', '主题已更新'));
  };

  // 1. 数据备份 (导出 Zip)
  const handleExportData = async () => {
    try {
      setSyncing(true);
      const res: any = await api.get('/family/export'); // 假设后端有此接口聚合所有数据
      const dataStr = JSON.stringify(res.data, null, 2);
      
      const zip = new JSZip();
      zip.file("family_backup.json", dataStr);
      const content = await zip.generateAsync({ type: "blob" });
      //const WebApp = (window as any).Telegram?.WebApp;
      if (WebApp.initData) {
        // 在 Telegram 中，Blob 下载不可靠。我们通过引导复制或提示说明。
        // 更好的建议：如果是 Telegram，将 JSON 直接弹出供用户复制
        WebApp.showPopup({
          title: t('parent.settings_export_title', '数据备份'),
          message: t('parent.settings_export_tg_desc', '已生成备份数据包。在部分 Telegram 环境中无法直接保存文件，是否复制 JSON 内容手动保存？'),
          buttons: [
            { id: 'ok', type: 'default',text: t('common.copy', '复制内容') }, 
            { id: 'cancel', type: 'cancel' }
          ]
        }, (id?: string) => {
          if (id === 'ok') {
            navigator.clipboard.writeText(dataStr);
            appToast.success(t('common.copied', '内容已复制到剪贴板'));
          }
        });
      } else {
        const url = window.URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Family_Backup_${new Date().getTime()}.zip`;
        link.click();
        appToast.success(t('parent.settings_export_success', '备份成功'));
      }
    } catch (e) {
      appToast.error(t('parent.settings_export_failed', '备份失败'));
    } finally { setSyncing(false); }
  };

  // 2. 数据恢复 (支持 Json/Zip)
  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setSyncing(true);
      let jsonData;
      if (file.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        const jsonFile = zip.file("family_backup.json");
        if (!jsonFile) throw new Error(t('parent.settings_import_invalid_format', '无效的备份包'));
        jsonData = JSON.parse(await jsonFile.async("string"));
      } else {
        jsonData = JSON.parse(await file.text());
      }
      
      await api.post('/family/import', jsonData);
      appToast.success(t('parent.settings_import_success', '恢复成功，正在刷新...'));
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      appToast.error(t('parent.settings_import_failed', '恢复失败：格式错误'));
    } finally { setSyncing(false); }
  };

  // 核心功能：发送反馈
  const sendFeedback = async () => {
    if (!feedbackContent.trim()) return;
    try {
      await api.post('/user/feedback', { content: feedbackContent });
      appToast.success(t('common.success_sent', '反馈已发送'));
      setIsFeedbackOpen(false);
      setFeedbackContent('');
    } catch (e) {}
  };

  // 核心功能：清除缓存
  const clearCache = () => {
    if (window.confirm(t('parent.clear_cache_confirm', '确定清除缓存并重新加载吗？'))) {
      localStorage.clear();
      window.location.reload();
    }
  };

  // 3. 解散家庭 (Super Admin 专属)
  const handleDisbandFamily = async () => {
    const confirmName = window.prompt(t('parent.settings_disband_confirm', '⚠️ 解散家庭将永久删除所有成员、积分和奖品。请输入家庭名称以确认：'));
    if (confirmName === null) return;
    if (confirmName !== familyProfile?.name) {
      appToast.error(t('parent.settings_disband_error_name', '名称输入不正确'));
      return;
    }
    try {
      await api.delete('/family/disband');
      appToast.success(t('parent.settings_disband_success', '家庭已解散'));
      window.location.href = '/auth';
    } catch (e) {}
  };

  return (
    <div className="p-4 pb-20 max-w-lg mx-auto relative">
      
      {/* 顶部同步状态 */}
      <div className={`fixed top-safe left-0 right-0 z-50 flex justify-center transition-all ${syncing ? 'translate-y-2 opacity-100' : '-translate-y-10 opacity-0'}`}>
        <div className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-bold flex items-center shadow-lg">
          <Loader2 size={14} className="animate-spin mr-2" /> {t('common.syncing', '正在同步设置...')}
        </div>
      </div>
      {/* 1. 个人资料 */}
      <CollapsibleSection title={t('parent.settings_personal_title')} icon={<User size={20} />} defaultOpen={true}>
        <div className="flex items-center space-x-4 pt-2">
          <button onClick={() => setEmojiPicker({ isOpen: true, target: 'user', value: userInfo?.avatar })} className="text-5xl p-3 bg-gray-100 dark:bg-gray-700 rounded-3xl relative">
            {userInfo?.avatar || '👤'}
            <div className="absolute -bottom-1 -right-1 p-1 bg-blue-500 rounded-full border-2 border-white dark:border-gray-800"><Edit2 size={10} className="text-white"/></div>
          </button>
          <div className="flex-1">
            <input type="text" value={userInfo?.nickName || ''} onChange={e => setUserInfo({...userInfo, nickName: e.target.value, isDirty: true})} className="w-full bg-transparent border-b border-gray-100 dark:border-gray-700 py-1 font-black text-xl outline-none" placeholder={t('auth.your_nickname_ph')} />
            <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-bold">{t('parent.role_' + userInfo?.role)}</p>
          </div>
        </div>
        <div className="mt-4">
           <label className="text-[10px] font-bold text-gray-400 uppercase">{t('parent.settings_language')}</label>
           <select value={userInfo?.locale || 'zh-CN'} onChange={e => setUserInfo({...userInfo, locale: e.target.value, isDirty: true})} className="w-full mt-1 h-12 bg-gray-50 dark:bg-gray-900 rounded-2xl px-4 text-sm font-bold border-none">
             {SUPPORTED_LANGUAGES.map(lang => <option key={lang.code} value={lang.code}>{lang.label}</option>)}
           </select>
        </div>
      </CollapsibleSection>

      {/* 2. 家庭设置 (Superadmin 可见) */}
      {userInfo?.role === 'superadmin' && familyProfile && (
        <CollapsibleSection title={t('parent.settings_family_title')} icon={<Home size={20} />}>
          <div className="space-y-5 pt-2">
            <div className="flex items-center space-x-4">
               <button onClick={() => setEmojiPicker({ isOpen: true, target: 'family', value: familyProfile.avatar })} className="text-4xl p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">{familyProfile.avatar}</button>
               <div className="flex-1">
                  <input type="text" value={familyProfile.name} onChange={e => setFamilyProfile({...familyProfile, name: e.target.value, isDirty: true})} className="w-full bg-transparent border-b border-gray-100 dark:border-gray-700 font-bold text-lg outline-none"/>
               </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="flex items-center space-x-2">
                 <button onClick={() => setEmojiPicker({ isOpen: true, target: 'point', value: familyProfile.pointEmoji })} className="text-2xl p-2 bg-gray-50 dark:bg-gray-900 rounded-xl">{familyProfile.pointEmoji}</button>
                 <input type="text" value={familyProfile.pointName} onChange={e => setFamilyProfile({...familyProfile, pointName: e.target.value, isDirty: true})} className="w-full h-10 bg-gray-50 dark:bg-gray-900 rounded-xl px-3 text-sm font-bold border-none" />
               </div>
            </div>
            {/* 推送 */}
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl space-y-3">
               <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{t('parent.push_enabled')}</span>
                  <input type="checkbox" checked={familyProfile.pushEnabled} onChange={e => setFamilyProfile({...familyProfile, pushEnabled: e.target.checked, isDirty: true})} className="w-5 h-5 rounded" />
               </div>
               {familyProfile.pushEnabled && <input type="time" value={familyProfile.pushTime} onChange={e => setFamilyProfile({...familyProfile, pushTime: e.target.value, isDirty: true})} className="w-full h-10 bg-white dark:bg-gray-800 rounded-xl px-3 text-sm" />}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* 3. 成员管理 */}
      <CollapsibleSection title={t('parent.settings_members_title')} icon={<Users size={20} />}>
        <div className="space-y-6 pt-2">
          {/* 家长列表 */}
          <div>
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{t('parent.settings_section_family_management')}</h4>
            <div className="space-y-2">
              {parentsList.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{p.avatar}</span>
                    <div>
                      <p className="font-bold text-sm">{p.nick_name}</p>
                      <p className="text-[10px] text-blue-500 font-bold uppercase">{p.role}</p>
                    </div>
                  </div>
                  {/* Superadmin 才有权修改其他家长 */}
                  {userInfo?.role === 'superadmin' && p.id !== userInfo.internalId && (
                    <button onClick={() => setEditingMember({...p, type: 'parent'})} className="p-2 text-gray-400 hover:text-blue-500"><Edit2 size={16}/></button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 孩子列表 */}
          <div>
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{t('parent.settings_section_family_kids_list')}</h4>
            <div className="grid grid-cols-2 gap-2">
              {childrenList.map(child => (
                <div key={child.id} onClick={() => setEditingMember({...child, type: 'child'})}
                  className="flex items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl cursor-pointer active:scale-95 transition-transform">
                  <span className="text-2xl mr-2">{child.avatar}</span>
                  <span className="font-bold text-sm truncate">{child.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 邀请入口 */}
          <div className="flex space-x-2">
             <button onClick={() => handleInvite('parent')} className="flex-1 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl text-xs font-bold flex items-center justify-center">
               <Zap size={14} className="mr-1"/> {t('parent.settings_btn_family_code', '邀请家长')}
             </button>
             <button onClick={() => handleInvite('child')} className="flex-1 py-3 bg-pink-50 dark:bg-pink-900/20 text-pink-600 rounded-2xl text-xs font-bold flex items-center justify-center">
               <Plus size={14} className="mr-1"/> {t('parent.settings_btn_child_code', '邀请孩子')}
             </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* 4. 通用设置 */}
      <CollapsibleSection title={t('parent.settings_general_title')} icon={<Settings size={20} />}>
        <div className="space-y-4 pt-2">
          {/* 主题切换 */}
          <div className="flex items-center justify-between p-1 bg-gray-100 dark:bg-gray-900 rounded-2xl">
             <button onClick={() => toggleTheme('light')} className="flex-1 flex items-center justify-center py-2 rounded-xl text-gray-500 hover:bg-white hover:text-orange-500 transition-all"><Sun size={18}/></button>
             <button onClick={() => toggleTheme('system')} className="flex-1 flex items-center justify-center py-2 rounded-xl text-gray-500 hover:bg-white hover:text-blue-500 transition-all"><Monitor size={18}/></button>
             <button onClick={() => toggleTheme('dark')} className="flex-1 flex items-center justify-center py-2 rounded-xl text-gray-500 hover:bg-white hover:text-purple-500 transition-all"><Moon size={18}/></button>
          </div>
          {/* 分类管理 */}
          <button onClick={() => setIsCategoryDrawerOpen(true)} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl">
            <div className="flex items-center space-x-3"><Tags size={20} className="text-blue-500" /> <span className="font-bold">{t('parent.settings_btn_category_management')}</span></div>
            <Plus size={18} className="text-gray-400" />
          </button>
        </div>
      </CollapsibleSection>

      {/* 5. 数据管理 */}
      <CollapsibleSection title={t('parent.settings_data_title')} icon={<Database size={20} />}>
        <div className="grid grid-cols-2 gap-3 pt-2">
           <button onClick={handleExportData} className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-900 rounded-3xl active:scale-95 transition-transform">
             <DownloadCloud size={24} className="mb-2 text-blue-500" />
             <span className="text-xs font-bold">{t('parent.btn_backup')}</span>
           </button>
           <label className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-900 rounded-3xl active:scale-95 transition-transform cursor-pointer">
             <UploadCloud size={24} className="mb-2 text-green-500" />
             <span className="text-xs font-bold">{t('parent.btn_restore')}</span>
             <input type="file" accept=".json,.zip" onChange={handleImportData} className="hidden" />
           </label>
        </div>
      </CollapsibleSection>

      {/* 6. 账号安全/危险区 */}
      <CollapsibleSection title={t('parent.settings_danger_title')} icon={<ShieldAlert size={20} />}>
        <div className="space-y-3 pt-2">
           {userInfo?.role === 'superadmin' && (
             <button onClick={handleDisbandFamily} className="w-full py-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-2xl font-bold flex items-center justify-center space-x-2">
               <AlertTriangle size={20} /> <span>{t('parent.settings_btn_disband_family')}</span>
             </button>
           )}
           <button className="w-full py-4 bg-gray-50 dark:bg-gray-700/50 text-gray-500 rounded-2xl font-bold flex items-center justify-center">
             <LogOut size={20} className="mr-2" /> <span>{t('parent.settings_btn_leave_family')}</span>
           </button>
        </div>
      </CollapsibleSection>

      {/* 面板之外：版本信息 */}
      {/* 底部按钮组 (缓存/反馈/帮助) */}
      <div className="mt-10 space-y-3 px-2">
         <div className="flex space-x-2">
            <a href="https://t.me/doobom_bot" target="_blank" rel="noreferrer" className="flex-1 h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center space-x-2 text-gray-500 font-bold active:scale-95 transition-all">
               <HelpCircle size={18}/> <span>{t('parent.settings_btn_help')}</span>
            </a>
            <button onClick={() => setIsFeedbackOpen(true)} className="flex-1 h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center space-x-2 text-gray-500 font-bold active:scale-95 transition-all">
               <MessageSquare size={18}/> <span>{t('parent.settings_btn_feedback')}</span>
            </button>
         </div>
         <button onClick={clearCache} className="w-full h-12 bg-gray-100/50 dark:bg-gray-800/50 rounded-2xl flex items-center justify-center space-x-2 text-gray-400 font-bold active:scale-95 transition-all">
            <RotateCcw size={16}/> <span>{t('parent.settings_btn_clear_cache')}</span>
         </button>
      </div>

      {/* 页面最底部版本信息 */}
      <div className="mt-6 mb-20 text-center opacity-30 select-none">
         <p onClick={handleVersionClick} className="text-[10px] font-mono tracking-widest text-gray-400">
           VERSION {VERSION_INFO.version} (BUILD {VERSION_INFO.buildDate})
         </p>
      </div>

      {/* 反馈抽屉 */}
      <div className={`fixed inset-0 z-[200] transition-all ${isFeedbackOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsFeedbackOpen(false)} />
        <div className={`absolute inset-x-0 bottom-0 bg-white dark:bg-gray-800 rounded-t-[32px] p-6 transition-transform transform ${isFeedbackOpen ? 'translate-y-0' : 'translate-y-full'}`}>
           <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{ t('parent.settings_feedback_title') }</h3>
              <button onClick={() => setIsFeedbackOpen(false)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full"><X size={20}/></button>
           </div>
           <textarea value={feedbackContent} onChange={e => setFeedbackContent(e.target.value)} rows={4} placeholder={t('parent.settings_feedback_desc')} className="w-full p-4 bg-gray-50 dark:bg-gray-700 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-medium" />
           <button onClick={sendFeedback} disabled={!feedbackContent.trim()} className="w-full mt-4 py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center space-x-2 disabled:bg-blue-300">
              <Send size={18}/> <span>{t('parent.settings_btn_feedback_submit')}</span>
           </button>
        </div>
      </div>

      {/* --- 弹窗组件区 --- */}
      {/* Emoji 选择器抽屉 */}
      <div className={`fixed inset-0 z-[200] transition-all ${emojiPicker?.isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEmojiPicker(null)} />
        <div className={`absolute inset-x-0 bottom-0 bg-white dark:bg-gray-800 rounded-t-[32px] p-6 transition-transform transform ${emojiPicker?.isOpen ? 'translate-y-0' : 'translate-y-full'}`}>
           <h3 className="text-center font-bold mb-6 text-gray-400">
             {/* 根据 target 动态显示标题 */}
             {emojiPicker?.target === 'user' && t('parent.settings_emoji_user')}
             {emojiPicker?.target === 'family' && t('parent.settings_emoji_family')}
             {emojiPicker?.target === 'point' && t('parent.settings_emoji_point')}
           </h3>
           
           <div className="grid grid-cols-4 gap-4 mb-8">
              {/* 🌟 核心修改：根据 target 动态读取对应的 Emoji 数组 */}
              {emojiPicker && EMOJI_CATEGORIES[emojiPicker.target as keyof typeof EMOJI_CATEGORIES]?.map((e: string) => (
                <button 
                  key={e} 
                  onClick={() => {
                    if (emojiPicker.target === 'user') setUserInfo({...userInfo, avatar: e, isDirty: true});
                    if (emojiPicker.target === 'family') setFamilyProfile({...familyProfile, avatar: e, isDirty: true});
                    if (emojiPicker.target === 'point') setFamilyProfile({...familyProfile, pointEmoji: e, isDirty: true});
                    setEmojiPicker(null);
                  }} 
                  className="text-4xl p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl active:scale-90 transition-transform"
                >
                  {e}
                </button>
              ))}
           </div>
        </div>
      </div>


      {/* 成员管理抽屉 (复用前面的编辑逻辑并增强) */}
      <EditMemberDrawer 
        member={editingMember} 
        isAdmin={userInfo?.role === 'superadmin'}
        onClose={() => setEditingMember(null)} 
        onSuccess={fetchData} 
      />

      <CategoryManagerDrawer isOpen={isCategoryDrawerOpen} onClose={() => setIsCategoryDrawerOpen(false)} />

    </div>
  );
}

/**
 * 🌟 增强版：成员管理抽屉
 */
function EditMemberDrawer({ member, isAdmin, onClose, onSuccess }: any) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => { if (member) setData({...member}); }, [member]);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      if (data.type === 'child') {
        await api.put(`/children/${data.id}`, { name: data.name, avatar: data.avatar });
      } else {
        await api.put(`/family/member-role`, { userId: data.id, role: data.role });
      }
      appToast.success(t('common.modified_success'));
      onSuccess();
      onClose();
    } finally { setLoading(false); }
  };

  const handleKick = async () => {
    if (!window.confirm(t('settings_kick_confirm', { name: data.name }))) return;
    try {
      await api.delete(`/family/member/${data.id}`); // 需要后端支持
      appToast.success(t('parent.settings_member_kicked'));
      onSuccess();
      onClose();
    } catch(err){
      appToast.error(t('parent.settings_member_kick_failed'));
    }
  };

  if (!data) return null;

  return (
    <div className={`fixed inset-0 z-[150] transition-all duration-300 ${member ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/40 transition-opacity ${member ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <div className={`absolute inset-x-0 bottom-0 bg-white dark:bg-gray-800 rounded-t-[32px] p-8 transition-transform transform ${member ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex items-center space-x-4 mb-8">
           <div className="text-6xl p-4 bg-gray-50 dark:bg-gray-900 rounded-[32px]">{data.avatar || data.name?.[0]}</div>
           <div className="flex-1">
              <h3 className="text-2xl font-black">{data.name || data.nick_name}</h3>
              <p className="text-gray-400 font-bold uppercase text-xs tracking-widest">{data.type}</p>
           </div>
        </div>

        <div className="space-y-6">
          {data.type === 'parent' && isAdmin && (
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase">{t('settings_member_role_label','角色权限')}</label>
              <select value={data.role} onChange={e => setData({...data, role: e.target.value})} className="w-full mt-1 h-12 bg-gray-50 dark:bg-gray-900 rounded-2xl px-4 font-bold">
                 <option value="admin">{t('parent.settings_member_role_admin','管理员 (Admin)')}</option>
                 <option value="viewer">{t('parent.settings_member_role_viewer','观察者 (Viewer)')}</option>
              </select>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
             <button onClick={handleKick} className="py-4 bg-red-50 text-red-600 rounded-2xl font-bold flex items-center justify-center">
               <Trash2 size={18} className="mr-2"/> {t('parent.settings_member_btn_kick','移出成员')}
             </button>
             <button onClick={handleUpdate} disabled={loading} className="py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center">
               <Check size={18} className="mr-2"/> {loading ? '...' : t('common.save','保存')}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}