import { create } from 'zustand';
import type { TopRightAdState } from '../types/topRightAd';

const EMPTY_STATE: TopRightAdState = {
  ad: null,
  ads: [],
};

interface TopRightAdStoreState {
  state: TopRightAdState;
  loading: boolean;
  initialized: boolean;
  fetchState: () => Promise<TopRightAdState>;
  forceRefreshState: () => Promise<TopRightAdState>;
}

export const useTopRightAdStore = create<TopRightAdStoreState>((set) => ({
  state: EMPTY_STATE,
  loading: false,
  initialized: true,

  fetchState: async () => {
    set({ state: EMPTY_STATE, loading: false, initialized: true });
    return EMPTY_STATE;
  },

  forceRefreshState: async () => {
    set({ state: EMPTY_STATE, loading: false, initialized: true });
    return EMPTY_STATE;
  },
}));
