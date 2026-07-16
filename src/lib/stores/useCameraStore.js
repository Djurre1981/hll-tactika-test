import { create } from "zustand";

export const useCameraStore = create((set) => ({
  x: 0,
  y: 0,
  zoom: 1,
  setCamera: ({ x, y, zoom }) =>
    set((s) => ({
      x: x ?? s.x,
      y: y ?? s.y,
      zoom: zoom ?? s.zoom,
    })),
  setPan: (x, y) => set({ x, y }),
  setZoom: (zoom) => set({ zoom }),
}));
