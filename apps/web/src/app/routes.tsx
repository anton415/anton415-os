import { createBrowserRouter } from "react-router";
import { LoginPage } from "./components/LoginPage";
import { Dashboard } from "./components/Dashboard";
import { TasksPage } from "./components/TasksPage";
import { FinancesPage } from "./components/FinancesPage";
import { CalendarPage } from "./components/CalendarPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Dashboard,
  },
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/tasks",
    Component: TasksPage,
  },
  {
    // Backend auth flows default to /todo (internal/auth/adapters/http/handler.go).
    path: "/todo",
    Component: TasksPage,
  },
  {
    path: "/finances",
    Component: FinancesPage,
  },
  {
    path: "/investments",
    element: <div className="p-8">Страница инвестиций (в разработке)</div>,
  },
  {
    path: "/fire",
    element: <div className="p-8">FIRE дашбоард (в разработке)</div>,
  },
  {
    path: "/calendar",
    Component: CalendarPage,
  },
  {
    path: "*",
    element: <div className="p-8">Страница не найдена</div>,
  },
]);
