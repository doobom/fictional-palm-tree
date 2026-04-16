// frontend/src/store/index.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import service, { ApiResponse } from '../api/request';

/**
 * 1. 基础业务模型接口定义
 */
export interface Family {
  id: string;
  name: string;
  avatar: string;
  role: 'superadmin' | 'admin' | 'viewer';
  point_name: string;
  point_emoji: string;
  timezone: string;
}

export interface Child {
  id: string;
  name: string;
  avatar: string;
  balance: number;
  has_new_achievement?: number;
  score_gained?: number;
  score_spent?: number;
}

export interface UserProfile {
  id: string;
  nick_name: string;
  avatar: string;
  locale: string;
}

export interface UserInfo {
  user: UserProfile;
  families: Family[];
  userType: 'parent' | 'child';
  bindings?: any[];
}

/**
 * 2. Store 状态接口定义
 */
interface UserState {
  // 身份凭证
  token: string | null;
  telegramInitData: string | null;
  
  // 用户与家庭数据
  user: UserProfile | null;
  userType: 'parent' | 'child' | null;
  families: Family[];
  currentFamilyId: string | null;
  
  // 业务数据缓存
  childrenList: Child[];
  routinesList: any[];
  routineLogs: any[];

  // --- Actions ---
  setAuth: (data: { token?: string; tgData?: string }) => void;
  setUserInfo: (data: UserInfo) => void;
  setCurrentFamilyId: (id: string | null) => void;
  setChildrenList: (list: Child[]) => void;
  setRoutinesList: (list: any[]) => void;
  fetchRoutinesAction: (familyId: string, childId?: string) => Promise<void>;
  
  // 实时更新：用于 SSE 收到消息后直接修改内存数据
  updateScoreLocal: (childId: string, delta: number) => void;
  
  // 登出清理
  logout: () => void;
}

/**
 * 3. 创建并导出 Store
 */
export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      token: null,
      telegramInitData: null,
      user: null,
      userType: null,
      families: [],
      currentFamilyId: null,
      childrenList: [],
      routinesList: [],
      routineLogs: [],

      // 设置 Token 或 TG 初始化数据
      setAuth: (data) => set((state) => ({
        token: data.token ?? state.token,
        telegramInitData: data.tgData ?? state.telegramInitData
      })),

      // 初始化用户信息与家庭列表
      setUserInfo: (data) => {
        const { user, families, userType } = data;
        // 策略：如果当前没选家庭或当前家庭不在列表中，默认选第一个
        const currentId = get().currentFamilyId;
        const isValid = families.some(f => f.id === currentId);
        const activeFamilyId = isValid ? currentId : (families.length > 0 ? families[0].id : null);
        
        set({
          user,
          families,
          userType,
          currentFamilyId: activeFamilyId
        });
      },

      // 切换当前活跃家庭
      setCurrentFamilyId: (id) => set({ currentFamilyId: id }),

      // 更新孩子列表 (由各页面 Fetch 后同步)
      setChildrenList: (list) => set({ childrenList: list }),

      // 实时积分跳动逻辑 (SSE 触发)
      updateScoreLocal: (childId, delta) => {
        set((state) => ({
          childrenList: state.childrenList.map((child) =>
            child.id === childId 
              ? { ...child, balance: (child.balance || 0) + delta } 
              : child
          )
        }));
      },

      // 🌟 修复后的 fetchRoutinesAction
      fetchRoutinesAction: async (familyId: string, childId?: string) => {
        try {
          const todayStr = new Date().toLocaleDateString('en-CA');
          // 智能拼接 URL：如果是孩子端调用，带上 childId；如果是家长端，拉取全家
          let url = `/routines?familyId=${familyId}&dateStr=${todayStr}`;
          if (childId) {
            url = `/routines?childId=${childId}&dateStr=${todayStr}`;
          }

          const res = await service.get<any, ApiResponse>(url);
          if (res.success && res.data) {
            // 🌟 核心修复：分别精准提取 routines 和 logs 数组
            set({ 
              routinesList: res.data.routines || [],
              routineLogs: res.data.logs || []
            });
          }
        } catch (error) {
          console.error('获取任务列表失败:', error);
        }
      },
      // 🌟 可选：手动更新列表（用于无需重新请求后端的场景）
      setRoutinesList: (list: any[]) => set({ routinesList: list }),
      setRoutineLogs: (logs: any[]) => set({ routineLogs: logs }),

      // 彻底清理状态
      logout: () => set({
        token: null,
        user: null,
        userType: null,
        families: [],
        currentFamilyId: null,
        childrenList: [],
        routinesList: [],
        routineLogs: []
      })
    }),
    {
      name: 'family-points-storage',
      storage: createJSONStorage(() => localStorage),
      /**
       * 4. 持久化黑名单/白名单过滤
       * 我们只持久化身份凭证和用户偏好的家庭 ID。
       * 业务数据 (families, childrenList) 应该每次进入 App 时通过 API 重新获取，以防陈旧。
       */
      partialize: (state) => ({ 
        token: state.token, 
        telegramInitData: state.telegramInitData,
        currentFamilyId: state.currentFamilyId 
      }),
    }
  )
);