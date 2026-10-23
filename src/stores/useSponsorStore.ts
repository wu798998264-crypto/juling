import { create } from 'zustand';
import type { SponsorModuleState } from '../types/sponsor';
// Local workspace only: no advertising feed and no automatic route rewrites.
export const LOCAL_RELAY_STATE: SponsorModuleState = {
  sponsorModule: {
    enabled: true,
    entryVisible: true,
    title: 'JIULING.FUN',
    subtitle: '本地接入与密钥管理',
    targetVersions: '*',
    createdAt: '',
    sponsors: [],
  },
};

interface SponsorStoreState {
  state: SponsorModuleState;
  loading: boolean;
  initialized: boolean;
  fetchState: (force?: boolean) => Promise<SponsorModuleState>;
}

export const useSponsorStore = create<SponsorStoreState>(() => ({
  state: LOCAL_RELAY_STATE,
  loading: false,
  initialized: true,
  fetchState: async () => LOCAL_RELAY_STATE,
}));
