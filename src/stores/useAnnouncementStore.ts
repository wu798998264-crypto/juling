import { create } from 'zustand';
import type { AnnouncementState } from '../types/announcement';

const EMPTY_STATE: AnnouncementState = {
  announcements: [],
  unreadIds: [],
  popupAnnouncement: null,
};

interface AnnouncementStoreState {
  state: AnnouncementState;
  loading: boolean;
  initialized: boolean;
  fetchState: (forceRefresh?: boolean) => Promise<AnnouncementState>;
  markAsRead: (id: string) => Promise<AnnouncementState>;
  markAllAsRead: () => Promise<AnnouncementState>;
}

export const useAnnouncementStore = create<AnnouncementStoreState>((set) => ({
  state: EMPTY_STATE,
  loading: false,
  initialized: false,

  fetchState: async (forceRefresh = false) => {
    void forceRefresh;
    set({ state: EMPTY_STATE, loading: false, initialized: true });
    return EMPTY_STATE;
  },

  markAsRead: async (id: string) => {
    void id;
    set({ state: EMPTY_STATE });
    return EMPTY_STATE;
  },

  markAllAsRead: async () => {
    set({ state: EMPTY_STATE });
    return EMPTY_STATE;
  },
}));
