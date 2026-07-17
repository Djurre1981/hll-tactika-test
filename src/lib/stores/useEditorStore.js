import { create } from "zustand";

export const useEditorStore = create((set) => ({
  activeSlideId: null,
  selectedObjectId: null,
  dirty: false,
  showGrid: true,
  showStrongpoints: true,
  setActiveSlideId: (activeSlideId) => set({ activeSlideId }),
  setSelectedObjectId: (selectedObjectId) => set({ selectedObjectId }),
  setDirty: (dirty) => set({ dirty }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setShowStrongpoints: (showStrongpoints) => set({ showStrongpoints }),
}));
