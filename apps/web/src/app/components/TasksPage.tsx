import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ChevronRight,
  ChevronDown,
  Inbox,
  Calendar as CalendarIcon,
  AlertCircle,
  Clock,
  CalendarCheck,
  Flag,
  CheckCircle2,
  Plus,
  CircleDot,
  MoreHorizontal,
  LayoutDashboard,
  CheckSquare,
  Wallet,
  TrendingUp,
  Target,
  Menu,
  X
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription
} from "./ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { todoApi, TodoApiError } from "../api";
import type {
  TodoProject,
  TodoProjectPayload,
  TodoRepeatFrequency,
  TodoTask,
  TodoTaskPayload,
  TodoTaskPriority,
  TodoTaskQuery,
  TodoTaskStatus,
  TodoView
} from "../api/types";
import { useAuthGate, logoutAndRedirect } from "../hooks/useAuthGate";

type Scope =
  | { kind: "view"; view: TodoView }
  | { kind: "project"; projectId: number };

type ProjectNode = TodoProject & { children: ProjectNode[] };
type TaskNode = TodoTask & { children: TaskNode[] };

const allViews: { id: TodoView; name: string; icon: typeof Inbox; color: string }[] = [
  { id: "inbox", name: "Входящие", icon: Inbox, color: "text-chart-1" },
  { id: "today", name: "Сегодня", icon: CalendarIcon, color: "text-success" },
  { id: "overdue", name: "Просроченные", icon: AlertCircle, color: "text-danger" },
  { id: "upcoming", name: "Скоро", icon: Clock, color: "text-warning" },
  { id: "scheduled", name: "Запланированные", icon: CalendarCheck, color: "text-chart-3" },
  { id: "flagged", name: "С флажком", icon: Flag, color: "text-chart-4" },
  { id: "all", name: "Всё", icon: CircleDot, color: "text-muted-foreground" },
  { id: "completed", name: "Готово", icon: CheckCircle2, color: "text-chart-2" }
];

function buildTaskQuery(scope: Scope): TodoTaskQuery {
  if (scope.kind === "project") return { project_id: scope.projectId };
  switch (scope.view) {
    case "all":
      return {};
    case "completed":
      return { status: "done" };
    default:
      return { view: scope.view };
  }
}

const priorityLabels: Record<TodoTaskPriority, string> = {
  none: "Без приоритета",
  low: "Низкий",
  medium: "Средний",
  high: "Высокий"
};

const priorityOrder: TodoTaskPriority[] = ["low", "medium", "high", "none"];

const repeatLabels: Record<TodoRepeatFrequency, string> = {
  none: "Не повторяется",
  daily: "Ежедневно",
  weekdays: "Будни",
  weekends: "Выходные",
  weekly: "Еженедельно",
  monthly: "Ежемесячно",
  yearly: "Ежегодно"
};

const NO_PROJECT_VALUE = "__none__";

function describeError(error: unknown): string {
  if (error instanceof TodoApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Не удалось выполнить запрос";
}

function buildProjectTree(projects: TodoProject[]): ProjectNode[] {
  const map = new Map<number, ProjectNode>();
  projects.forEach((p) => map.set(p.id, { ...p, children: [] }));
  const roots: ProjectNode[] = [];
  map.forEach((node) => {
    if (node.parent_project_id != null && map.has(node.parent_project_id)) {
      map.get(node.parent_project_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function buildTaskTree(tasks: TodoTask[]): TaskNode[] {
  const map = new Map<number, TaskNode>();
  tasks.forEach((t) => map.set(t.id, { ...t, children: [] }));
  const roots: TaskNode[] = [];
  map.forEach((node) => {
    if (node.parent_task_id != null && map.has(node.parent_task_id)) {
      map.get(node.parent_task_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function formatTaskDate(date: string | null): string | undefined {
  if (!date) return undefined;
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

const modules = [
  { id: "tasks", name: "Задачи", icon: CheckSquare, path: "/tasks" },
  { id: "finances", name: "Финансы", icon: Wallet, path: "/finances" },
  { id: "investments", name: "Инвестиции", icon: TrendingUp, path: "/investments" },
  { id: "fire", name: "FIRE", icon: Target, path: "/fire" },
  { id: "calendar", name: "Календарь", icon: CalendarIcon, path: "/calendar" }
];

export function TasksPage() {
  const { status } = useAuthGate();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<TodoProject[]>([]);
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [scope, setScope] = useState<Scope>({ kind: "view", view: "inbox" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [collapsedProjects, setCollapsedProjects] = useState<Set<number>>(new Set());
  const [collapsedTasks, setCollapsedTasks] = useState<Set<number>>(new Set());
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [editingTask, setEditingTask] = useState<TodoTask | null>(null);
  const [draftTask, setDraftTask] = useState<TodoTaskPayload | null>(null);
  const [subtaskTitle, setSubtaskTitle] = useState("");

  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const [editingProject, setEditingProject] = useState<TodoProject | null>(null);
  const [editProjectDraft, setEditProjectDraft] = useState<TodoProjectPayload | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const list = await todoApi.listProjects();
      setProjects(list);
    } catch (err) {
      setError(describeError(err));
    }
  }, []);

  const loadTasks = useCallback(async (current: Scope) => {
    setLoading(true);
    setError(undefined);
    try {
      const list = await todoApi.listTasks(buildTaskQuery(current));
      setTasks(list);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    void loadProjects();
  }, [status, loadProjects]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void loadTasks(scope);
  }, [status, scope, loadTasks]);

  const projectTree = useMemo(() => buildProjectTree(projects), [projects]);
  const taskTree = useMemo(() => buildTaskTree(tasks), [tasks]);
  const projectById = useMemo(() => {
    const m = new Map<number, TodoProject>();
    projects.forEach((p) => m.set(p.id, p));
    return m;
  }, [projects]);

  const scopeTitle = useMemo(() => {
    if (scope.kind === "view") {
      return allViews.find((v) => v.id === scope.view)?.name ?? "Задачи";
    }
    return projectById.get(scope.projectId)?.name ?? "Проект";
  }, [scope, projectById]);

  const handleToggleStatus = async (task: TodoTask) => {
    const nextStatus: TodoTaskStatus = task.status === "done" ? "todo" : "done";
    try {
      const updated = await todoApi.updateTask(task.id, { status: nextStatus });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch (err) {
      setError(describeError(err));
    }
  };

  const handleAddTask = async () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    const payload: TodoTaskPayload = {
      project_id: scope.kind === "project" ? scope.projectId : null,
      parent_task_id: null,
      title,
      notes: null,
      url: null,
      due_date: null,
      due_time: null,
      repeat_frequency: "none",
      repeat_interval: 1,
      repeat_until: null,
      flagged: false,
      priority: "none"
    };
    try {
      const created = await todoApi.createTask(payload);
      setTasks((prev) => [created, ...prev]);
      setNewTaskTitle("");
    } catch (err) {
      setError(describeError(err));
    }
  };

  const openTaskSheet = (task: TodoTask) => {
    setEditingTask(task);
    setDraftTask({
      project_id: task.project_id,
      parent_task_id: task.parent_task_id,
      title: task.title,
      notes: task.notes,
      url: task.url,
      status: task.status,
      due_date: task.due_date,
      due_time: task.due_time,
      repeat_frequency: task.repeat_frequency,
      repeat_interval: task.repeat_interval,
      repeat_until: task.repeat_until,
      flagged: task.flagged,
      priority: task.priority
    });
    setSubtaskTitle("");
  };

  const closeTaskSheet = () => {
    setEditingTask(null);
    setDraftTask(null);
    setSubtaskTitle("");
  };

  const handleSaveTask = async () => {
    if (!editingTask || !draftTask) return;
    try {
      const updated = await todoApi.updateTask(editingTask.id, draftTask);
      setTasks((prev) => prev.map((t) => (t.id === editingTask.id ? updated : t)));
      closeTaskSheet();
    } catch (err) {
      setError(describeError(err));
    }
  };

  const handleAddSubtask = async () => {
    if (!editingTask) return;
    const title = subtaskTitle.trim();
    if (!title) return;
    const payload: TodoTaskPayload = {
      project_id: editingTask.project_id,
      parent_task_id: editingTask.id,
      title,
      notes: null,
      url: null,
      due_date: null,
      due_time: null,
      repeat_frequency: "none",
      repeat_interval: 1,
      repeat_until: null,
      flagged: false,
      priority: "none"
    };
    try {
      const created = await todoApi.createTask(payload);
      setTasks((prev) => [created, ...prev]);
      setSubtaskTitle("");
    } catch (err) {
      setError(describeError(err));
    }
  };

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    try {
      const created = await todoApi.createProject({
        parent_project_id: null,
        name,
        start_date: null,
        end_date: null
      });
      setProjects((prev) => [...prev, created]);
      setNewProjectName("");
      setNewProjectOpen(false);
    } catch (err) {
      setError(describeError(err));
    }
  };

  const openEditProject = (project: TodoProject) => {
    setEditingProject(project);
    setEditProjectDraft({
      parent_project_id: project.parent_project_id,
      name: project.name,
      start_date: project.start_date,
      end_date: project.end_date
    });
  };

  const handleUpdateProject = async () => {
    if (!editingProject || !editProjectDraft) return;
    try {
      const updated = await todoApi.updateProject(editingProject.id, editProjectDraft);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditingProject(null);
      setEditProjectDraft(null);
    } catch (err) {
      setError(describeError(err));
    }
  };

  const handleDeleteProject = async () => {
    if (!editingProject) return;
    try {
      await todoApi.deleteProject(editingProject.id);
      setProjects((prev) => prev.filter((p) => p.id !== editingProject.id));
      if (scope.kind === "project" && scope.projectId === editingProject.id) {
        setScope({ kind: "view", view: "inbox" });
      }
      setEditingProject(null);
      setEditProjectDraft(null);
    } catch (err) {
      setError(describeError(err));
    }
  };

  const toggleProjectCollapse = (id: number) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTaskCollapse = (id: number) => {
    setCollapsedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderProject = (project: ProjectNode, level = 0): ReactNode => {
    const hasChildren = project.children.length > 0;
    const isCollapsed = collapsedProjects.has(project.id);
    const isActive = scope.kind === "project" && scope.projectId === project.id;

    return (
      <div key={project.id}>
        <div
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors group cursor-pointer ${
            isActive ? "bg-accent" : "hover:bg-accent"
          }`}
          style={{ paddingLeft: `${12 + level * 16}px` }}
          onClick={() => {
            setScope({ kind: "project", projectId: project.id });
            setIsMobileSidebarOpen(false);
          }}
        >
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  toggleProjectCollapse(project.id);
                }}
                className="hover:bg-accent/50 rounded p-0.5 cursor-pointer"
              >
                {isCollapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
              </span>
            ) : (
              <div className="w-4" />
            )}
            <div className="size-3 rounded-full bg-chart-1" />
            <span>{project.name}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditProject(project);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded"
          >
            <MoreHorizontal className="size-3" />
          </button>
        </div>
        {hasChildren && !isCollapsed && project.children.map((child) => renderProject(child, level + 1))}
      </div>
    );
  };

  const renderTask = (task: TaskNode, level = 0): ReactNode => {
    const hasSubtasks = task.children.length > 0;
    const isCollapsed = collapsedTasks.has(task.id);
    const completed = task.status === "done";
    const projectName = task.project_id ? projectById.get(task.project_id)?.name : undefined;

    return (
      <div key={task.id}>
        <div
          className="flex items-start gap-2 md:gap-3 p-2.5 md:p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors group"
          style={{ paddingLeft: `${12 + level * 24}px` }}
          onClick={() => openTaskSheet(task)}
        >
          {hasSubtasks ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleTaskCollapse(task.id);
              }}
              className="hover:bg-accent/50 rounded p-0.5 cursor-pointer shrink-0 mt-0.5"
            >
              {isCollapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
          ) : level > 0 ? (
            <div className="w-4" />
          ) : null}
          <Checkbox
            checked={completed}
            onCheckedChange={() => void handleToggleStatus(task)}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={`text-sm md:text-base ${completed ? "line-through text-muted-foreground" : ""}`}>
                {task.title}
              </p>
              {hasSubtasks && (
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {task.children.filter((c) => c.status === "done").length}/{task.children.length}
                </span>
              )}
              {task.flagged && <Flag className="size-3 text-chart-4" />}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {projectName && (
                <Badge variant="outline" className="text-xs">
                  {projectName}
                </Badge>
              )}
              {task.due_date && (
                <span className="text-xs text-muted-foreground">{formatTaskDate(task.due_date)}</span>
              )}
              {task.priority !== "none" && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {priorityLabels[task.priority]}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openTaskSheet(task);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 shrink-0"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>
        {hasSubtasks && !isCollapsed && task.children.map((c) => renderTask(c, level + 1))}
      </div>
    );
  };

  const SidebarContent = () => (
    <>
      <div className="mb-6">
        <h2 className="text-sm mb-3">Списки</h2>
        <div className="space-y-1">
          {allViews.map((view) => {
            const Icon = view.icon;
            const isActive = scope.kind === "view" && scope.view === view.id;
            return (
              <button
                key={view.id}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? "bg-accent" : "hover:bg-accent"
                }`}
                onClick={() => {
                  setScope({ kind: "view", view: view.id });
                  setIsMobileSidebarOpen(false);
                }}
              >
                <Icon className={`size-4 ${view.color}`} />
                <span>{view.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-sm mb-3">Проекты</h2>
        <div className="space-y-1">{projectTree.map((p) => renderProject(p))}</div>
        <button
          onClick={() => {
            setNewProjectOpen(true);
            setIsMobileSidebarOpen(false);
          }}
          className="w-full flex items-center gap-2 px-3 py-2 mt-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors"
        >
          <Plus className="size-4" />
          <span>Новый проект</span>
        </button>
      </div>
    </>
  );

  if (status === "loading") {
    return <div className="flex items-center justify-center h-screen text-muted-foreground">Загрузка…</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b bg-card">
        <div className="px-4 py-3 md:py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 md:gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu className="size-5" />
              </Button>
              <Link to="/" className="flex items-center gap-2 md:gap-3">
                <div className="bg-primary text-primary-foreground p-1.5 md:p-2 rounded-lg">
                  <LayoutDashboard className="size-5 md:size-6" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-lg md:text-xl">anton-hub</h1>
                  <p className="text-xs md:text-sm text-muted-foreground">Личный центр управления</p>
                </div>
              </Link>
            </div>

            <div className="flex gap-1 md:gap-2 overflow-x-auto flex-1 justify-center">
              {modules.map((module) => {
                const Icon = module.icon;
                const isActive = module.id === "tasks";
                return (
                  <Link key={module.id} to={module.path}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className="gap-1 md:gap-2 text-xs md:text-sm whitespace-nowrap h-8 md:h-9"
                    >
                      <Icon className="size-3 md:size-4" />
                      <span className="hidden xs:inline">{module.name}</span>
                    </Button>
                  </Link>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="md:h-9"
              onClick={() => logoutAndRedirect(navigate)}
            >
              <span className="hidden sm:inline">Выход</span>
              <X className="size-4 sm:hidden" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden md:flex w-64 border-r bg-card p-4 flex-col overflow-y-auto">
          <SidebarContent />
        </aside>

        <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
          <SheetContent side="left" className="w-64 p-4">
            <SheetHeader className="mb-4">
              <SheetTitle>Меню</SheetTitle>
              <SheetDescription>Навигация по проектам и задачам</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col h-full overflow-y-auto">
              <SidebarContent />
            </div>
          </SheetContent>
        </Sheet>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b p-3 md:p-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder={`Новая задача — ${scopeTitle}`}
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleAddTask()}
                className="flex-1 h-9"
              />
              <Button size="icon" onClick={() => void handleAddTask()} className="h-9 w-9 shrink-0">
                <Plus className="size-4" />
              </Button>
            </div>
            {error && <p className="text-sm text-danger mt-2">{error}</p>}
          </div>

          <div className="flex-1 overflow-y-auto p-3 md:p-4">
            <div className="max-w-4xl mx-auto space-y-1">
              {loading && tasks.length === 0 ? (
                <p className="text-muted-foreground text-sm px-3">Загрузка…</p>
              ) : taskTree.length === 0 ? (
                <p className="text-muted-foreground text-sm px-3">Задач нет</p>
              ) : (
                taskTree.map((task) => renderTask(task))
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Edit task sheet */}
      <Sheet open={editingTask !== null} onOpenChange={(open) => !open && closeTaskSheet()}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Редактировать задачу</SheetTitle>
            <SheetDescription>
              Измените параметры задачи и нажмите Сохранить
            </SheetDescription>
          </SheetHeader>

          {editingTask && draftTask && (
            <div className="space-y-4 py-4 px-4">
              <div className="space-y-2">
                <Label>Описание</Label>
                <Input
                  value={draftTask.title}
                  onChange={(e) => setDraftTask({ ...draftTask, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Проект</Label>
                <Select
                  value={draftTask.project_id == null ? NO_PROJECT_VALUE : String(draftTask.project_id)}
                  onValueChange={(value) =>
                    setDraftTask({
                      ...draftTask,
                      project_id: value === NO_PROJECT_VALUE ? null : Number(value)
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Без проекта" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT_VALUE}>Без проекта</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ссылка</Label>
                <Input
                  placeholder="https://..."
                  value={draftTask.url ?? ""}
                  onChange={(e) =>
                    setDraftTask({ ...draftTask, url: e.target.value || null })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Дата</Label>
                  <Input
                    type="date"
                    value={draftTask.due_date ?? ""}
                    onChange={(e) =>
                      setDraftTask({ ...draftTask, due_date: e.target.value || null })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Время</Label>
                  <Input
                    type="time"
                    value={draftTask.due_time ?? ""}
                    onChange={(e) =>
                      setDraftTask({ ...draftTask, due_time: e.target.value || null })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Повторение</Label>
                <Select
                  value={draftTask.repeat_frequency}
                  onValueChange={(value) =>
                    setDraftTask({ ...draftTask, repeat_frequency: value as TodoRepeatFrequency })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(repeatLabels) as TodoRepeatFrequency[]).map((freq) => (
                      <SelectItem key={freq} value={freq}>
                        {repeatLabels[freq]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Приоритет</Label>
                <div className="flex gap-2 flex-wrap">
                  {priorityOrder.map((p) => (
                    <Button
                      key={p}
                      type="button"
                      variant={draftTask.priority === p ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDraftTask({ ...draftTask, priority: p })}
                    >
                      {priorityLabels[p]}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Флажок</Label>
                <Button
                  type="button"
                  variant={draftTask.flagged ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDraftTask({ ...draftTask, flagged: !draftTask.flagged })}
                >
                  <Flag className="size-4 mr-2" />
                  {draftTask.flagged ? "С флажком" : "Без флажка"}
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Заметки</Label>
                <Textarea
                  rows={4}
                  value={draftTask.notes ?? ""}
                  onChange={(e) =>
                    setDraftTask({ ...draftTask, notes: e.target.value || null })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Подзадачи</Label>
                <div className="space-y-2">
                  {tasks
                    .filter((t) => t.parent_task_id === editingTask.id)
                    .map((subtask) => (
                      <div
                        key={subtask.id}
                        className="flex items-center gap-2 p-2 rounded-lg border"
                      >
                        <Checkbox
                          checked={subtask.status === "done"}
                          onCheckedChange={() => void handleToggleStatus(subtask)}
                        />
                        <span
                          className={`flex-1 text-sm ${
                            subtask.status === "done" ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {subtask.title}
                        </span>
                      </div>
                    ))}
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Добавить подзадачу"
                      className="flex-1 text-sm"
                      value={subtaskTitle}
                      onChange={(e) => setSubtaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleAddSubtask();
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => void handleAddSubtask()}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <SheetFooter className="px-4">
            <Button className="w-full" onClick={() => void handleSaveTask()}>
              Сохранить
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* New Project Dialog */}
      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый проект</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Название проекта</Label>
              <Input
                id="project-name"
                placeholder="Введите название проекта"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleCreateProject()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProjectOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => void handleCreateProject()}>Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit project dialog */}
      <Dialog
        open={editingProject !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingProject(null);
            setEditProjectDraft(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать проект</DialogTitle>
          </DialogHeader>
          {editingProject && editProjectDraft && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-project-name">Название проекта</Label>
                <Input
                  id="edit-project-name"
                  value={editProjectDraft.name}
                  onChange={(e) =>
                    setEditProjectDraft({ ...editProjectDraft, name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Родительский проект</Label>
                <Select
                  value={
                    editProjectDraft.parent_project_id == null
                      ? NO_PROJECT_VALUE
                      : String(editProjectDraft.parent_project_id)
                  }
                  onValueChange={(value) =>
                    setEditProjectDraft({
                      ...editProjectDraft,
                      parent_project_id: value === NO_PROJECT_VALUE ? null : Number(value)
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Нет родительского проекта" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT_VALUE}>Нет родительского проекта</SelectItem>
                    {projects
                      .filter((p) => p.id !== editingProject.id)
                      .map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Начало</Label>
                  <Input
                    type="date"
                    value={editProjectDraft.start_date ?? ""}
                    onChange={(e) =>
                      setEditProjectDraft({
                        ...editProjectDraft,
                        start_date: e.target.value || null
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Конец</Label>
                  <Input
                    type="date"
                    value={editProjectDraft.end_date ?? ""}
                    onChange={(e) =>
                      setEditProjectDraft({
                        ...editProjectDraft,
                        end_date: e.target.value || null
                      })
                    }
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="destructive" onClick={() => void handleDeleteProject()} className="sm:mr-auto">
              Удалить проект
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingProject(null);
                  setEditProjectDraft(null);
                }}
                className="flex-1 sm:flex-none"
              >
                Отмена
              </Button>
              <Button onClick={() => void handleUpdateProject()} className="flex-1 sm:flex-none">
                Сохранить
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
