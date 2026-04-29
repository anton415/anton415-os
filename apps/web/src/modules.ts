import type { ProductModule } from "./types";

// Пока это только навигационные маркеры будущих bounded contexts.
// Реальные экраны появятся позже, начиная с первого доменного vertical slice.
export const productModules: ProductModule[] = [
  {
    name: "Задачи",
    path: "/todo",
    accent: "#2563eb",
    summary: "Проекты, задачи, сроки и простые рабочие списки.",
    state: "реализовано"
  },
  {
    name: "Финансы",
    path: "/finance",
    accent: "#059669",
    summary: "Месячные факты доходов и расходов для спокойного обзора.",
    state: "реализовано"
  },
  {
    name: "Инвестиции",
    path: "/investments",
    accent: "#7c3aed",
    summary: "Граница счетов, позиций и доходности."
  },
  {
    name: "FIRE",
    path: "/fire",
    accent: "#d97706",
    summary: "Граница долгосрочного планирования и прогнозов."
  }
];
