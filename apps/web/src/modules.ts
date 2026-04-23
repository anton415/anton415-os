import type { ProductModule } from "./types";

// Пока это только навигационные маркеры будущих bounded contexts.
// Реальные экраны появятся позже, начиная с первого доменного vertical slice.
export const productModules: ProductModule[] = [
  {
    name: "Todo",
    path: "/todo",
    accent: "#2563eb",
    summary: "Projects, tasks, due dates, and simple execution views.",
    state: "implemented"
  },
  {
    name: "Finance",
    path: "/finance",
    accent: "#059669",
    summary: "Personal finance records and rules boundary."
  },
  {
    name: "Investments",
    path: "/investments",
    accent: "#7c3aed",
    summary: "Accounts, positions, and performance boundary."
  },
  {
    name: "FIRE",
    path: "/fire",
    accent: "#d97706",
    summary: "Long-term planning and projection boundary."
  }
];
