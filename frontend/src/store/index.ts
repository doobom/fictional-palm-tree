import { create } from 'zustand';

// 定义我们的数据结构
export interface Child {
  id: string;
  name: string;
  avatar: string;
  score_gained: number;
  score_spent: number;
  birthday?: string; // 🌟 新增
  gender?: string;   // 🌟 新增
  locale?: string;   // 🌟 新增
}

interface AppState {
  childrenList: Child[];
  selectedChildId: string | null;
  setChildrenList: (list: Child[]) => void;
  setSelectedChildId: (id: string) => void;
  // 获取当前选中的孩子对象
  getSelectedChild: () => Child | undefined;
}

export const useAppStore = create<AppState>((set, get) => ({
  childrenList: [],
  selectedChildId: null,
  setChildrenList: (list) => {
    set({ childrenList: list });
    // 如果之前没有选中，默认选中第一个孩子
    if (!get().selectedChildId && list.length > 0) {
      set({ selectedChildId: list[0].id });
    }
  },
  setSelectedChildId: (id) => set({ selectedChildId: id }),
  getSelectedChild: () => {
    const { childrenList, selectedChildId } = get();
    return childrenList.find(c => c.id === selectedChildId);
  }
}));