import { create } from 'zustand';
import { MODE, SYNC_STATUS } from '@/constants';

const initialSettings = {
  columns: 4,
  horizontalSpacing: 4,
  verticalSpacing: 6,
  outerMargin: 10,
  photoBorderThickness: 1,
  detailsBorderThickness: 1,
  cornerRadius: 6,
  fontFamily: 'Inter',
  nameFontSize: 11,
  detailsFontSize: 9,
  textAlign: 'center',
  imageQuality: 0.95,
  dpi: 300,
  pageTitle: '',
  titleFontSize: 28,
  titleAlign: 'center',
  titleSpacing: 12,
  backgroundColor: '#ffffff',
  activeFrameTemplateId: null,
  showDetailLabels: true,
  visibleDetails: {
    photo: true,
    name: true,
    className: true,
    gender: false,
    admissionNumber: false,
    rollNumber: true,
    category: false,
    item: true,
    position: true,
    grade: true,
    marks: false,
  },
};

export const useAppStore = create((set, get) => ({
  mode: MODE.OFFLINE,
  user: null,
  accessStatus: 'unknown', // unknown | checking | allowed | denied | pending | rejected | inactive
  accessDetails: null,
  isAuthReady: false,
  syncStatus: 'idle', // idle | syncing | success | error
  lastSyncedAt: null,
  syncProgress: null,
  online: navigator.onLine,
  toasts: [],
  settings: initialSettings,

  setMode: (mode) => set({ mode }),
  setUser: (user) => set({ user }),
  setAccess: (accessStatus, accessDetails = null) => set({ accessStatus, accessDetails }),
  setAuthReady: (v) => set({ isAuthReady: v }),
  setOnline: (v) => set({ online: v }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setSyncProgress: (syncProgress) => set({ syncProgress }),

  setSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch } })),

  resetSettings: () => set({ settings: initialSettings }),

  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2);
    const t = { id, type: 'info', duration: 3500, ...toast };
    set((s) => ({ toasts: [...s.toasts, t] }));
    if (t.duration > 0) {
      setTimeout(() => get().dismissToast(id), t.duration);
    }
    return id;
  },
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export { initialSettings, SYNC_STATUS };
