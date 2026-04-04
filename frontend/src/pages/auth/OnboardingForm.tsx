import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api/request';
import { appToast } from '../../utils/toast'; // 🌟 引入全局 Toast

// 定义两个表单的数据结构
type CreateFormData = { familyName: string; nickName: string; };
type JoinFormData = { inviteCode: string; nickName: string; };

export default function OnboardingForm() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  // 1. 初始化创建家庭的 Form
  const { 
    register: registerCreate, 
    handleSubmit: submitCreate, 
    formState: { errors: errorsCreate, isSubmitting: isCreating } 
  } = useForm<CreateFormData>();

  // 2. 初始化加入家庭的 Form
  const { 
    register: registerJoin, 
    handleSubmit: submitJoin, 
    formState: { errors: errorsJoin, isSubmitting: isJoining } 
  } = useForm<JoinFormData>();

  // 🌟 核心：提交创建家庭
  const onCreate = async (data: CreateFormData) => {
    try {
      // 自动获取用户手机/浏览器的时区 (如 'Asia/Shanghai')
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      await api.post('/auth/create-family', {
        familyName: data.familyName,
        nickName: data.nickName,
        locale: i18n.language, // 传给后端用于初始化默认规则
        timezone: userTimezone // 传给后端用于报表时区计算
      });
      
      appToast.success(t('auth.create_family_success', '欢迎来到你的新家！')); // 🌟

      // 创建成功，直接跳转家长控制台
      navigate('/parent');
    } catch (err) {
      // 错误提示由 api/request.ts 全局接管
    }
  };

  // 🌟 核心：提交加入家庭
  const onJoin = async (data: JoinFormData) => {
    try {
      await api.post('/auth/join-family', {
        inviteCode: data.inviteCode,
        nickName: data.nickName,
        locale: i18n.language
      });

      appToast.success(t('auth.join_family_success', '成功加入家庭！')); // 🌟

      // 加入成功，直接跳转家长控制台
      navigate('/parent');
    } catch (err) {
      // 错误提示由 api/request.ts 全局接管
    }
  };

  return (
    <div className="mt-6">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-6">
        {t('auth.title_onboarding')}
      </h3>

      {/* 选项卡 (Tabs) */}
      <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl mb-6">
        <button
          onClick={() => setActiveTab('create')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'create' ? 'bg-white dark:bg-gray-800 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-300'
          }`}
        >
          {t('auth.tab_create')}
        </button>
        <button
          onClick={() => setActiveTab('join')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'join' ? 'bg-white dark:bg-gray-800 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-300'
          }`}
        >
          {t('auth.tab_join')}
        </button>
      </div>

      {/* 视图 A：创建新家庭 */}
      {activeTab === 'create' && (
        <form onSubmit={submitCreate(onCreate)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.family_name')}
            </label>
            <input
              {...registerCreate('familyName', { required: t('auth.err_required') })}
              placeholder={t('auth.family_name_ph')}
              className={`w-full px-4 py-3 rounded-lg border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all ${errorsCreate.familyName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
            />
            {errorsCreate.familyName && <p className="text-red-500 text-xs mt-1">{errorsCreate.familyName.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.your_nickname')}
            </label>
            <input
              {...registerCreate('nickName', { required: t('auth.err_required') })}
              placeholder={t('auth.your_nickname_ph')}
              className={`w-full px-4 py-3 rounded-lg border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all ${errorsCreate.nickName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
            />
            {errorsCreate.nickName && <p className="text-red-500 text-xs mt-1">{errorsCreate.nickName.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isCreating}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors duration-200 mt-6"
          >
            {isCreating ? t('auth.creating') : t('auth.btn_create')}
          </button>
        </form>
      )}

      {/* 视图 B：加入家庭 */}
      {activeTab === 'join' && (
        <form onSubmit={submitJoin(onJoin)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.invite_code')}
            </label>
            <input
              {...registerJoin('inviteCode', { required: t('auth.err_required') })}
              placeholder={t('auth.invite_code_ph')}
              className={`w-full px-4 py-3 rounded-lg border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all uppercase tracking-widest ${errorsJoin.inviteCode ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
            />
            {errorsJoin.inviteCode && <p className="text-red-500 text-xs mt-1">{errorsJoin.inviteCode.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.your_nickname')}
            </label>
            <input
              {...registerJoin('nickName', { required: t('auth.err_required') })}
              placeholder={t('auth.your_nickname_ph')}
              className={`w-full px-4 py-3 rounded-lg border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all ${errorsJoin.nickName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
            />
            {errorsJoin.nickName && <p className="text-red-500 text-xs mt-1">{errorsJoin.nickName.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isJoining}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-medium transition-colors duration-200 mt-6"
          >
            {isJoining ? t('auth.joining') : t('auth.btn_join')}
          </button>
        </form>
      )}
    </div>
  );
}