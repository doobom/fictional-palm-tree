// frontend/src/pages/parent/SettingsView.tsx
import React, { useEffect, useState } from 'react';
import { useUserStore, Child } from '../../store';
import service, { ApiResponse } from '../../api/request';
import { appToast } from '../../utils/toast';
import { VERSION_INFO } from '../../version';
import { SUPPORTED_LANGUAGES } from '../../locales/index';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import BottomDrawer from '../../components/BottomDrawer';
import Section from '../../components/Section';
import CategoryManagerDrawer from './CategoryManagerDrawer';

import JSZip from 'jszip'; // 🌟 新增 ZIP 库
import { 
  Settings, Baby, ShieldCheck, Copy, Smartphone, Plus, 
  UserCircle, Tags, Trash2, HelpCircle, Info, MessageSquare, ChevronRight, 
  Globe, Calendar, MapPin, Edit3, Sun, Database, DownloadCloud, UploadCloud, AlertTriangle,
  Bell, Clock, CheckSquare, Save, 
} from 'lucide-react';

export default function SettingsView() {
  const { currentFamilyId, families, childrenList, setChildrenList } = useUserStore();
  const { i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState<'profile' | 'basic'| 'notifications' | 'categories' | 'children' | 'members' | 'backup'>('profile'); // 增加 backup 枚举

  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;

  // 主题偏好
  const [themePref, setThemePref] = useState(localStorage.getItem('app_theme') || 'auto');
  const handleThemeChange = (newTheme: string) => {
    setThemePref(newTheme);
    localStorage.setItem('app_theme', newTheme);
    window.dispatchEvent(new Event('theme-updated')); 
  };

  const [userProfile, setUserProfile] = useState<{nick_name: string, avatar: string, id: string | number, locale?: string} | null>(null);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [profileData, setProfileData] = useState({ 
    nick_name: tgUser ? `${tgUser.first_name} ${tgUser.last_name || ''}`.trim() : '', 
    avatar: '🧑', 
    locale: tgUser?.language_code || 'zh-CN'
  });

  const [config, setConfig] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);

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

  useEffect(() => {
    if (currentFamilyId) fetchFamilyData();
    fetchCategories();
    
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

  useEffect(() => {
    if (inviteModal) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [inviteModal]);


  const fetchCategories = async () => {
    try { const res = await service.get<any, ApiResponse>('/categories/list'); if (res.success || res.data) setCategories(res.data || res); } catch (e) {}
  };

  const handleSaveProfile = async () => {
    if (!profileData.nick_name.trim()) return appToast.warn('昵称不能为空');
    try { 
      const payload = { nickName: profileData.nick_name, avatar: profileData.avatar, locale: profileData.locale };
      const res = await service.put<any, ApiResponse>('/user/profile', payload); 
      
      if(res.success){ 
        appToast.success('个人资料已更新'); 
        const currentUserId = userProfile?.id || tgUser?.id || '';
        setUserProfile(prev => ({ ...prev!, nick_name: profileData.nick_name, avatar: profileData.avatar, locale: profileData.locale, id: currentUserId })); 
        setMembers(prevMembers => prevMembers.map(m => String(m.id) === String(currentUserId) ? { ...m, nick_name: profileData.nick_name, avatar: profileData.avatar } : m));
        if (i18n && typeof i18n.changeLanguage === 'function') i18n.changeLanguage(profileData.locale);
        setIsProfileDrawerOpen(false); 
      } 
    } catch(e) { appToast.error('保存失败，请稍后重试'); } 
  };

  // 🌟 家庭设置相关
  const [isFamilyDrawerOpen, setIsFamilyDrawerOpen] = useState(false);
  const [editFamilyData, setEditFamilyData] = useState({ 
    name: '', point_name: '', point_emoji: '', avatar: '', timezone: 'Asia/Shanghai',
    push_enabled: false, push_time: '20:00', push_options: ['summary', 'pending', 'expiring'] // 🌟 新增
  });
  const [isPushDrawerOpen, setIsPushDrawerOpen] = useState(false);

  const fetchFamilyData = async () => {
    setLoading(true);
    try {
      const res = await service.get<any, ApiResponse>('/family/config');
      if (res.success) {
        setMembers(res.data.members || []); setConfig(res.data.config);
        
        // 🌟 解析 push_options
        let parsedOptions = ['summary', 'pending', 'expiring'];
        try { if (res.data.config.push_options) parsedOptions = JSON.parse(res.data.config.push_options); } catch(e) {}

        setEditFamilyData({ 
          name: res.data.config.name, 
          point_name: res.data.config.point_name, 
          point_emoji: res.data.config.point_emoji, 
          avatar: res.data.config.avatar || '🏠',
          timezone: res.data.config.timezone || 'Asia/Shanghai',
          push_enabled: !!res.data.config.push_enabled, // 🌟 新增
          push_time: res.data.config.push_time || '20:00', // 🌟 新增
          push_options: parsedOptions // 🌟 新增
        });
      }
    } finally { setLoading(false); }
  };

  const handleSaveFamily = async () => {
    if (!editFamilyData.name.trim()) return appToast.warn('家庭名称不能为空');
    try { 
      // 🌟 将数组转回 JSON 字符串发给后端
      const payload = {
        ...editFamilyData,
        push_options: JSON.stringify(editFamilyData.push_options)
      };
      const res = await service.put<any, ApiResponse>('/family/config', payload); 
      if(res.success){ 
        appToast.success('家庭设置已更新'); 
        setConfig({...config, ...payload}); 
        setIsFamilyDrawerOpen(false); 
        setIsPushDrawerOpen(false); // 🌟 顺便关掉推送抽屉
      } 
    } catch(e) {} 
  };

  const handleTogglePushOption = (id: string) => {
    setEditFamilyData(prev => ({
      ...prev,
      push_options: prev.push_options.includes(id)
        ? prev.push_options.filter((item: string) => item !== id)
        : [...prev.push_options, id]
    }));
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

  const currentUserMember = members.find(m => String(m.id) === String(userProfile?.id || tgUser?.id));
  const displayNickName = currentUserMember?.nick_name || userProfile?.nick_name || '未设置昵称';
  const displayAvatar = currentUserMember?.avatar || userProfile?.avatar || '🧑';
  const currentLangLabel = SUPPORTED_LANGUAGES.find(l => l.code === profileData.locale)?.label || '简体中文';

  // 🌟 备份与恢复状态
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isProcessingBackup, setIsProcessingBackup] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [restoreWarningOpen, setRestoreWarningOpen] = useState(false);

  // 🌟 导出备份 (智能识别环境)
  const handleExportBackup = async () => {
    setIsProcessingBackup(true);
    const toastId = toast.loading('正在打包您的家庭数据...');
    try {
      // 检查是否在 Telegram 环境内
      const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
      
      if (tgUser && tgUser.id) {
        // 🚀 Telegram 环境：直接发消息到聊天框
        const res = await service.post<any, ApiResponse>('/system/export-telegram', { tgUserId: tgUser.id });
        if (res.success) {
          toast.dismiss(toastId);
          appToast.success('✅ 备份文件已发送到您的 Telegram 聊天中！请关闭应用去对话框查看。', { duration: 5000 });
        }
      } else {
        // 🌐 普通浏览器环境：正常打包并触发浏览器 ZIP 下载
        const res = await service.get<any, ApiResponse>('/system/export');
        if (res.success && res.data) {
          const zip = new JSZip();
          const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
          const fileName = `FamilyPoints_backup_${currentFamilyId}_${dateStr}.zip`;

          zip.file('backup.json', JSON.stringify(res.data, null, 2));
          const blob = await zip.generateAsync({ type: 'blob' });

          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          window.URL.revokeObjectURL(url);
          
          toast.dismiss(toastId);
          appToast.success('备份已成功下载！');
        }
      }
    } catch (e) {
      toast.dismiss(toastId);
      appToast.error('导出失败，请重试');
    } finally {
      setIsProcessingBackup(false);
    }
  };

  // 🌟 选定导入文件
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setRestoreWarningOpen(true); // 打开红色警告弹窗
    }
    e.target.value = ''; // 清空 input 允许重复选同一个文件
  };

  // 🌟 确认执行恢复 (支持 ZIP 和 JSON)
  const executeRestore = async () => {
    if (!importFile) return;
    setIsProcessingBackup(true);
    const toastId = toast.loading('正在解析并恢复数据...');
    
    try {
      let backupData;
      const fileName = importFile.name.toLowerCase();

      // 判断文件类型进行处理
      if (fileName.endsWith('.zip')) {
        const zip = new JSZip();
        const unzipped = await zip.loadAsync(importFile);
        const jsonFiles = Object.keys(unzipped.files).filter(name => name.endsWith('.json'));
        if (jsonFiles.length === 0) throw new Error("ZIP 文件中未找到 .json 备份文件！");
        const jsonStr = await unzipped.file(jsonFiles[0])?.async('string');
        backupData = JSON.parse(jsonStr!);
      } else if (fileName.endsWith('.json')) {
        const text = await importFile.text();
        backupData = JSON.parse(text);
      } else {
        throw new Error("不支持的文件格式，请上传 .zip 或 .json 文件");
      }

      // 验证 JSON 结构
      if (!backupData || !backupData.data) {
        throw new Error("文件内容格式不正确或已损坏");
      }

      // 提交到后端进行事务覆盖
      const res = await service.post<any, ApiResponse>('/system/import', { backupData });
      if (res.success) {
        toast.dismiss(toastId);
        appToast.success('数据恢复成功！系统即将刷新...');
        setTimeout(() => window.location.reload(), 1500); 
      }
    } catch (e: any) {
      toast.dismiss(toastId);
      appToast.error(e.message || '恢复失败，文件可能已损坏');
    } finally {
      setIsProcessingBackup(false);
      setRestoreWarningOpen(false);
      setImportFile(null);
    }
  };


  if (loading && !config) return <div className="p-10 text-center text-gray-500 dark:text-gray-400 font-bold transition-colors">加载中...</div>;

  return (
    <div className="settings-container p-4 pb-32 pt-8 min-h-full bg-gray-50 dark:bg-gray-900 overscroll-none transition-colors duration-300">
      
      {/* 1. 个人资料 */}
      <Section title="个人资料" icon={<UserCircle size={22} />} isOpen={openSection === 'profile'} onToggle={() => setOpenSection(openSection === 'profile' ? '' : 'profile' as any)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-5xl bg-gray-50 dark:bg-gray-700 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600 transition-colors">{displayAvatar}</span>
            <div>
              <p className="font-black text-gray-800 dark:text-gray-100 text-xl transition-colors">{displayNickName}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-300 font-bold bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md transition-colors">ID: {userProfile?.id || tgUser?.id || '未知'}</span>
                <span className="text-xs text-gray-500 dark:text-gray-300 font-bold bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors"><Globe size={12}/> {currentLangLabel}</span>
              </div>
            </div>
          </div>
          <button onClick={() => setIsProfileDrawerOpen(true)} className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl active:scale-95 transition-all"><Edit3 size={20} /></button>
        </div>
      </Section>

      <BottomDrawer isOpen={isProfileDrawerOpen} onClose={() => setIsProfileDrawerOpen(false)} title="编辑个人资料" footer={<button onClick={handleSaveProfile} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-md active:scale-[0.98] transition-transform">保存资料</button>}>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-24">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">头像</label>
              <input type="text" className="w-full h-14 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 text-center text-3xl focus:ring-2 focus:ring-blue-500 outline-none transition-colors" value={profileData.avatar} onChange={e => setProfileData({...profileData, avatar: e.target.value})} maxLength={2} />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">我的昵称</label>
              <input type="text" className="w-full h-14 px-4 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 font-bold text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-colors" value={profileData.nick_name} onChange={e => setProfileData({...profileData, nick_name: e.target.value})} placeholder="输入你在家庭中的称呼" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><Globe size={16}/> 语言设置 (Language)</label>
            <select className="w-full h-14 px-4 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 font-bold text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none appearance-none transition-colors" value={profileData.locale} onChange={e => setProfileData({...profileData, locale: e.target.value})}>
              {SUPPORTED_LANGUAGES.map((lang) => (<option key={lang.code} value={lang.code}>{lang.label} ({lang.code})</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><Sun size={16}/> 外观主题 (Theme)</label>
            <select className="w-full h-14 px-4 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 font-bold text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none appearance-none transition-colors" value={themePref} onChange={e => handleThemeChange(e.target.value)}>
              <option value="auto">自动 (跟随系统或 Telegram)</option>
              <option value="light">浅色模式 (Light)</option>
              <option value="dark">深色模式 (Dark)</option>
            </select>
          </div>
        </div>
      </BottomDrawer>

      {/* 2. 基础设置 */}
      <Section title="基础设置" icon={<Settings size={22} />} isOpen={openSection === 'basic'} onToggle={() => setOpenSection(openSection === 'basic' ? '' : 'basic' as any)}>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700/50 transition-colors"><span className="text-gray-500 dark:text-gray-400 font-medium">家庭名称</span><span className="font-bold text-gray-800 dark:text-gray-100 text-lg">{config?.avatar} {config?.name}</span></div>
          <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700/50 transition-colors"><span className="text-gray-500 dark:text-gray-400 font-medium">代币单位</span><span className="font-bold text-gray-800 dark:text-gray-100 text-lg">{config?.point_emoji} {config?.point_name}</span></div>
          <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700/50 transition-colors"><span className="text-gray-500 dark:text-gray-400 font-medium">所在区/时区</span><span className="font-bold text-gray-800 dark:text-gray-100">{config?.timezone || 'Asia/Shanghai'}</span></div>
          <div className="flex justify-between items-center py-2"><span className="text-gray-500 dark:text-gray-400 font-medium">我的角色</span><span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-black uppercase transition-colors">{myRole}</span></div>
          {isAdmin && <button onClick={() => setIsFamilyDrawerOpen(true)} className="w-full py-3.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"><Edit3 size={18}/> 编辑基础信息</button>}
        </div>
      </Section>

      <BottomDrawer isOpen={isFamilyDrawerOpen} onClose={() => setIsFamilyDrawerOpen(false)} title="编辑家庭基础信息" footer={<button onClick={handleSaveFamily} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-md active:scale-[0.98] transition-transform">保存设置</button>}>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-24"><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">家庭图标</label><input type="text" className="w-full h-14 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 text-center text-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-colors" value={editFamilyData.avatar} onChange={e => setEditFamilyData({...editFamilyData, avatar: e.target.value})} maxLength={2} /></div>
            <div className="flex-1"><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">家庭名称</label><input type="text" className="w-full h-14 px-4 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 font-bold text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-colors" value={editFamilyData.name} onChange={e => setEditFamilyData({...editFamilyData, name: e.target.value})} /></div>
          </div>
          <div className="flex gap-3">
            <div className="w-24"><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">代币图标</label><input type="text" className="w-full h-14 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 text-center text-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-colors" value={editFamilyData.point_emoji} onChange={e => setEditFamilyData({...editFamilyData, point_emoji: e.target.value})} maxLength={2} /></div>
            <div className="flex-1"><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">代币名称</label><input type="text" className="w-full h-14 px-4 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 font-bold text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-colors" value={editFamilyData.point_name} onChange={e => setEditFamilyData({...editFamilyData, point_name: e.target.value})} /></div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><MapPin size={16}/> 所在区/时区 (Timezone)</label>
            <select className="w-full h-14 px-4 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 font-bold text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none appearance-none transition-colors" value={editFamilyData.timezone} onChange={e => setEditFamilyData({...editFamilyData, timezone: e.target.value})}>
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

      {/* 2.5 自动推送设置 */}
      <Section title="自动推送设置" icon={<Bell size={22} />} isOpen={openSection === 'notifications'} onToggle={() => setOpenSection(openSection === 'notifications' ? '' : 'notifications' as any)}>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700/50 transition-colors">
            <span className="text-gray-500 dark:text-gray-400 font-medium">推送状态</span>
            <span className={`font-bold ${config?.push_enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
              {config?.push_enabled ? '已开启' : '已关闭'}
            </span>
          </div>
          {config?.push_enabled && (
            <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700/50 transition-colors">
              <span className="text-gray-500 dark:text-gray-400 font-medium">推送时间</span>
              <span className="font-bold text-gray-800 dark:text-gray-100">{config?.push_time || '20:00'}</span>
            </div>
          )}
          {isAdmin && (
            <button onClick={() => setIsPushDrawerOpen(true)} className="w-full py-3.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
              <Edit3 size={18}/> 配置推送规则
            </button>
          )}
        </div>
      </Section>

      <BottomDrawer isOpen={isPushDrawerOpen} onClose={() => setIsPushDrawerOpen(false)} title="Telegram 推送设置" footer={<button onClick={handleSaveFamily} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-md active:scale-[0.98] transition-transform">保存设置</button>}>
        <div className="space-y-6">
          {/* 总开关 */}
          <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-4 rounded-2xl border border-gray-100 dark:border-gray-600 transition-colors">
            <div>
              <p className="font-bold text-gray-800 dark:text-gray-100">每日定时播报</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">在绑定的群组内自动发送简报</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={editFamilyData.push_enabled} onChange={(e) => setEditFamilyData({...editFamilyData, push_enabled: e.target.checked})} />
              <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* 展开的详情设置 */}
          {editFamilyData.push_enabled && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1"><Clock size={16}/> 推送时间</label>
                <input type="time" className="w-full h-14 px-4 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 font-bold text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-colors" value={editFamilyData.push_time} onChange={e => setEditFamilyData({...editFamilyData, push_time: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1"><CheckSquare size={16}/> 推送内容</label>
                <div className="space-y-3">
                  {[
                    { id: 'summary', label: '每日日报', desc: '汇总今日得分、打卡情况与系统大盘' },
                    { id: 'pending', label: '待办提醒', desc: '如果有待审批的任务，将一并发出提醒' },
                    { id: 'expiring', label: '目标进度', desc: '附带展示孩子们当前正在进行的心愿进度' }
                  ].map(type => (
                    <div key={type.id} onClick={() => handleTogglePushOption(type.id)} className={`p-3 rounded-xl border-2 transition-all flex items-center justify-between cursor-pointer ${editFamilyData.push_options.includes(type.id) ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-100 dark:border-gray-600 bg-white dark:bg-gray-700'}`}>
                      <div>
                        <p className="font-bold text-sm text-gray-800 dark:text-gray-100">{type.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{type.desc}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${editFamilyData.push_options.includes(type.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-500'}`}>
                        {editFamilyData.push_options.includes(type.id) && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </BottomDrawer>

      {/* 3. 商品分类 */}
      <Section title="商品分类" icon={<Tags size={22} />} isOpen={openSection === 'categories'} onToggle={() => setOpenSection(openSection === 'categories' ? '' : 'categories' as any)}>
        <div className="pt-2 space-y-4">
          {categories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl shadow-sm transition-colors">
                  <span className="text-base">{cat.emoji || '🏷️'}</span>
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{cat.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 transition-colors">
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">暂无分类数据，请在管理台中添加</p>
            </div>
          )}
          <div onClick={() => setIsCategoryDrawerOpen(true)} className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 active:scale-[0.98] transition-all p-4 rounded-2xl cursor-pointer">
            <div>
              <p className="font-bold text-blue-800 dark:text-blue-300 text-base transition-colors">打开分类管理台</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium transition-colors">新增、修改或删除商品分类</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-2 rounded-xl shadow-sm transition-colors"><ChevronRight className="text-blue-500 dark:text-blue-400" size={20} /></div>
          </div>
        </div>
      </Section>

      {/* 4. 孩子管理 */}
      <Section title="孩子管理" icon={<Baby size={22} />} isOpen={openSection === 'children'} onToggle={() => setOpenSection(openSection === 'children' ? '' : 'children' as any)}>
        <div className="space-y-3 pt-2">
          {childrenList.map((child: Child | any) => (
            <div key={child.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm relative transition-colors">
              <div className="flex items-center gap-4">
                <span className="text-4xl bg-gray-50 dark:bg-gray-700 p-2 rounded-xl border border-gray-100 dark:border-gray-600 transition-colors">{child.avatar}</span>
                <div>
                  <span className="font-bold text-gray-800 dark:text-gray-100 text-lg block transition-colors">{child.name}</span>
                  {child.birthday && (
                    <span className="text-xs font-bold text-orange-500 dark:text-orange-400 flex items-center gap-1 mt-1 bg-orange-50 dark:bg-orange-900/30 inline-block px-2 py-0.5 rounded-md transition-colors"><Calendar size={12} /> {child.birthday}</span>
                  )}
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {isAdmin && <button onClick={() => { setChildForm({ id: child.id, name: child.name, avatar: child.avatar, birthday: child.birthday || '' }); setIsChildDrawerOpen(true); }} className="flex-1 py-2 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-sm flex items-center justify-center gap-1 transition-colors"><Edit3 size={14}/> 编辑</button>}
                {isAdmin && <button onClick={() => handleGenerateCode('child', child.id)} className="flex-1 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold rounded-xl text-sm flex items-center justify-center gap-1 transition-colors"><Smartphone size={14}/> 绑定码</button>}
              </div>
            </div>
          ))}
          {isAdmin && <button onClick={() => { setChildForm({ id: '', name: '', avatar: '👦', birthday: '' }); setIsChildDrawerOpen(true); }} className="w-full flex justify-center items-center gap-2 py-4 border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-95 transition-all"><Plus size={18} /> 添加新孩子</button>}
        </div>
      </Section>

      <BottomDrawer isOpen={isChildDrawerOpen} onClose={() => setIsChildDrawerOpen(false)} title={childForm.id ? "编辑孩子资料" : "添加新孩子"} footer={<button onClick={handleSaveChild} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-md active:scale-[0.98] transition-transform">保存资料</button>}>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-24"><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">头像</label><input type="text" className="w-full h-14 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 text-center text-3xl focus:ring-2 focus:ring-blue-500 outline-none transition-colors" value={childForm.avatar} onChange={e => setChildForm({...childForm, avatar: e.target.value})} maxLength={2} /></div>
            <div className="flex-1"><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">孩子昵称/小名</label><input type="text" className="w-full h-14 px-4 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 font-bold text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-colors" value={childForm.name} onChange={e => setChildForm({...childForm, name: e.target.value})} placeholder="输入称呼" /></div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><Calendar size={16}/> 生日 (可选)</label>
            <input type="date" className="w-full h-14 px-4 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 font-bold text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-colors" value={childForm.birthday} onChange={e => setChildForm({...childForm, birthday: e.target.value})} />
          </div>
        </div>
      </BottomDrawer>

      {/* 5. 家长成员 */}
      <Section title="家长成员" icon={<ShieldCheck size={22} />} isOpen={openSection === 'members'} onToggle={() => setOpenSection(openSection === 'members' ? '' : 'members' as any)}>
        <div className="space-y-3 pt-2">
          {members.map(member => (
            <div key={member.id} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-2xl transition-colors">
              <span className="text-3xl bg-white dark:bg-gray-800 p-2 rounded-xl transition-colors">{member.avatar}</span>
              <div className="flex-1">
                <p className="font-bold text-gray-800 dark:text-gray-100 text-base transition-colors">{member.nick_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold transition-colors">{member.role}</p>
              </div>
            </div>
          ))}
          {isAdmin && <button onClick={() => handleGenerateCode('admin')} className="w-full flex justify-center items-center gap-2 py-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"><Plus size={18} /> 邀请家人加入</button>}
        </div>
      </Section>

      {/* 6. 数据安全与备份 */}
      <Section title="数据安全与备份" icon={<Database size={22} />} isOpen={openSection === 'backup'} onToggle={() => setOpenSection(openSection === 'backup' ? '' : 'backup' as any)}>
        <div className="pt-2 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/50">
            <p className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-1">您的数据完全掌握在自己手中</p>
            <p className="text-xs text-blue-600 dark:text-blue-400">所有积分流水、孩子资料、心愿任务均可随时一键打包为 ZIP 格式下载到本地保存。</p>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={handleExportBackup} 
              disabled={isProcessingBackup}
              className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-blue-600 hover:text-white dark:text-gray-200 font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <DownloadCloud size={18} /> 导出 ZIP 备份
            </button>
            
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isProcessingBackup || !isAdmin}
              className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-orange-500 hover:text-white dark:text-gray-200 font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              <UploadCloud size={18} /> 上传 ZIP 恢复
            </button>
            <input type="file" accept=".zip,.json" ref={fileInputRef} className="hidden" onChange={handleImportFileChange} />
          </div>
        </div>
      </Section>

      {/* --- 独立底部分组菜单 --- */}
      <div className="mt-8 px-2 animate-fade-in-up">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
          <button onClick={() => setFeedbackOpen(true)} className="w-full flex items-center gap-3 p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors border-b border-gray-50 dark:border-gray-700/50">
            <MessageSquare size={20} className="text-orange-500 dark:text-orange-400" />
            <span className="font-bold text-gray-800 dark:text-gray-200 flex-1 text-left transition-colors">意见反馈</span>
          </button>
          <button onClick={() => window.Telegram?.WebApp?.openTelegramLink('https://t.me/+-dVp6A1EnMZjOGI1')} className="w-full flex items-center gap-3 p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors border-b border-gray-50 dark:border-gray-700/50">
            <HelpCircle size={20} className="text-blue-500 dark:text-blue-400" />
            <span className="font-bold text-gray-800 dark:text-gray-200 flex-1 text-left transition-colors">帮助与支持</span>
          </button>
          <button onClick={handleClearCache} className="w-full flex items-center gap-3 p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors">
            <Trash2 size={20} className="text-red-500 dark:text-red-400" />
            <span className="font-bold text-gray-800 dark:text-gray-200 flex-1 text-left transition-colors">清除本地缓存</span>
          </button>
        </div>
        <p className="text-center text-gray-400 dark:text-gray-500 text-xs font-bold mt-6 uppercase tracking-widest flex items-center justify-center gap-1 transition-colors">
          <Info size={12} /> Family Points v{VERSION_INFO.version}
        </p>
      </div>

      {/* --- 全局功能弹窗区 --- */}
      <CategoryManagerDrawer isOpen={isCategoryDrawerOpen} onClose={() => { setIsCategoryDrawerOpen(false); fetchCategories(); }} />

      <BottomDrawer isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} title="意见反馈" footer={<button onClick={handleSendFeedback} disabled={isSubmittingFeedback || !feedbackText.trim()} className="w-full py-4 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold rounded-xl shadow-lg active:scale-[0.98] disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:shadow-none transition-all">{isSubmittingFeedback ? '发送中...' : '提交反馈给管理员'}</button>}>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 text-center font-medium transition-colors">有任何问题或建议，请告诉我们。消息将直接发送给系统开发组。</p>
        <textarea className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl p-4 text-gray-800 dark:text-gray-100 font-bold outline-none focus:ring-2 focus:ring-orange-500 resize-none h-36 transition-colors" placeholder="请详细描述您的问题..." value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} />
      </BottomDrawer>

      {/* 危险操作：恢复确认弹窗 */}
      <BottomDrawer isOpen={restoreWarningOpen} onClose={() => { setRestoreWarningOpen(false); setImportFile(null); }} title="⚠️ 严重警告" footer={
        <div className="flex gap-3">
          <button onClick={() => { setRestoreWarningOpen(false); setImportFile(null); }} className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl active:scale-95 transition-all">取消操作</button>
          <button onClick={executeRestore} disabled={isProcessingBackup} className="flex-1 py-4 bg-red-600 text-white font-black rounded-xl shadow-lg shadow-red-200 dark:shadow-none active:scale-95 flex justify-center items-center gap-2 transition-all">
            {isProcessingBackup ? '正在恢复...' : '明白风险，确认覆盖'}
          </button>
        </div>
      }>
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-5 mb-4 space-y-3">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-black text-lg">
            <AlertTriangle size={24} /> 确认覆盖现有数据？
          </div>
          <p className="text-red-800 dark:text-red-300 text-sm font-medium leading-relaxed">
            您即将导入备份文件 <span className="font-bold border-b border-red-300">{importFile?.name}</span>。
          </p>
          <p className="text-red-800 dark:text-red-300 text-sm font-medium leading-relaxed">
            执行恢复操作后，当前系统内所有最新的积分流水、待办任务和审核记录将被 <span className="font-black underline">完全清空</span>，并替换为该备份文件中的历史状态。
          </p>
          <p className="text-red-600 dark:text-red-400 text-xs font-bold pt-2">此操作不可逆！如果担心出错，请在覆盖前先执行一次【导出备份】。</p>
        </div>
      </BottomDrawer>

      {inviteModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative transition-colors duration-300">
            <button onClick={() => setInviteModal(null)} className="absolute right-4 top-4 w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 font-bold flex items-center justify-center transition-colors">✕</button>
            <div className="text-center mt-2">
              <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-2 transition-colors">{inviteModal.title}</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 transition-colors">{inviteModal.desc}</p>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-2xl mb-6 border-2 border-dashed border-gray-300 dark:border-gray-600 transition-colors">
                <p className="text-4xl font-mono font-black text-blue-600 dark:text-blue-400 tracking-widest transition-colors">{inviteModal.code}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 transition-colors">有效期 7 天</p>
              </div>
              <div className="space-y-3">
                <button onClick={() => copyToClipboard(inviteModal.code)} className="w-full flex justify-center items-center gap-2 py-4 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold rounded-xl active:scale-95 transition-all"><Copy size={18} /> 复制凭证码</button>
                <button onClick={() => copyToClipboard(`【FamilyPoints】${inviteModal.title}\n凭证码：${inviteModal.code}\n快速链接：${inviteModal.link}`)} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 dark:shadow-none active:scale-95 transition-transform">复制完整链接发送</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}