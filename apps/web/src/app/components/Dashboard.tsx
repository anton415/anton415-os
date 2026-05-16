import { LayoutDashboard, CheckSquare, Wallet, TrendingUp, Calendar, Target } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useAuthGate, logoutAndRedirect } from "../hooks/useAuthGate";

export function Dashboard() {
  const { status } = useAuthGate();
  const navigate = useNavigate();

  const modules = [
    {
      id: "tasks",
      title: "Задачи",
      description: "Управление задачами и проектами",
      icon: CheckSquare,
      status: "active",
      color: "bg-chart-1",
      path: "/tasks"
    },
    {
      id: "finances",
      title: "Личные финансы",
      description: "Учет доходов и расходов",
      icon: Wallet,
      status: "active",
      color: "bg-chart-2",
      path: "/finances"
    },
    {
      id: "investments",
      title: "Инвестиции",
      description: "Портфель и аналитика",
      icon: TrendingUp,
      status: "coming-soon",
      color: "bg-chart-3",
      path: "/investments"
    },
    {
      id: "fire",
      title: "FIRE дашбоард",
      description: "Отслеживание прогресса к финансовой независимости",
      icon: Target,
      status: "coming-soon",
      color: "bg-chart-4",
      path: "/fire"
    },
    {
      id: "calendar",
      title: "Календарь",
      description: "Планирование и события",
      icon: Calendar,
      status: "active",
      color: "bg-chart-5",
      path: "/calendar"
    }
  ];

  if (status === "loading") {
    return <div className="flex items-center justify-center h-screen text-muted-foreground">Загрузка…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary text-primary-foreground p-2 rounded-lg">
                <LayoutDashboard className="size-6" />
              </div>
              <div>
                <h1 className="text-xl">anton-hub</h1>
                <p className="text-sm text-muted-foreground">Личный центр управления</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => logoutAndRedirect(navigate)}>
              Выход
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="mb-2">Модули</h2>
          <p className="text-muted-foreground">Выберите модуль для работы</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => {
            const Icon = module.icon;
            const isActive = module.status === "active";

            return (
              <Card
                key={module.id}
                className={`transition-all hover:shadow-lg ${
                  isActive ? "cursor-pointer hover:border-primary" : "opacity-60"
                }`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className={`${module.color} p-3 rounded-lg text-white`}>
                      <Icon className="size-6" />
                    </div>
                    {!isActive && <Badge variant="outline">Скоро</Badge>}
                  </div>
                  <CardTitle className="mt-4">{module.title}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {isActive ? (
                    <Link to={module.path}>
                      <Button className="w-full">Открыть</Button>
                    </Link>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      В разработке
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
