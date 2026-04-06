// frontend/src/types/user.ts (或者直接放在 store/index.ts 顶部)

export interface Family {
  id: string;
  name: string;
  avatar: string;
  role: 'superadmin' | 'admin' | 'viewer';
  point_name: string;
  point_emoji: string;
  timezone: string;
}

export interface UserProfile {
  id: string;
  nick_name: string;
  avatar: string;
  locale: string;
}

export interface AuthBinding {
  provider: string;
  created_at: string;
}

export interface UserInfo {
  user: UserProfile;
  families: Family[];
  bindings: AuthBinding[];
  userType: 'parent' | 'child';
}