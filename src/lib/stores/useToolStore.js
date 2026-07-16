import { create } from "zustand";

export const useToolStore = create((set) => ({
  tool: "select",
  color: "#3d8bfd",
  strokeWidth: 2,
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
}));
