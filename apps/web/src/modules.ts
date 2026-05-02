import type { ProductModule } from "./types";

// Пока это только навигационные маркеры будущих bounded contexts.
// Реальные экраны появятся позже, начиная с первого доменного vertical slice.
export const productModules: ProductModule[] = [
  {
    name: "Задачи",
    path: "/todo",
    summary: "Проекты, задачи, сроки и простые рабочие списки.",
    state: "реализовано"
  },
  {
    name: "Финансы",
    path: "/finance",
    summary: "Месячные факты доходов и расходов для спокойного обзора.",
    state: "реализовано"
  },
  {
    name: "Инвестиции",
    path: "/investments",
    summary: "Граница счетов, позиций и доходности."
  },
  {
    name: "FIRE",
    path: "/fire",
    summary: "Граница долгосрочного планирования и прогнозов."
  }
];
