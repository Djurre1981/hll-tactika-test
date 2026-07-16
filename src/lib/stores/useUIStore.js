import { create } from "zustand";

export const useUIStore = create((set) => ({
  sidebarOpen: true,
  activeModal: null,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActiveModal: (activeModal) => set({ activeModal }),
}));
