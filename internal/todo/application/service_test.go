package application

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/anton415/anton415-hub/internal/todo/domain"
)

func TestServiceCreatesTaskAndRejectsEmptyTitle(t *testing.T) {
	service := newTestService()

	task, err := service.CreateTask(context.Background(), CreateTaskInput{Title: "  Write tests  "})
	if err != nil {
		t.Fatalf("CreateTask() error = %v", err)
	}
	if task.Title != "Write tests" {
		t.Fatalf("Title = %q, want Write tests", task.Title)
	}

	_, err = service.CreateTask(context.Background(), CreateTaskInput{Title: "   "})
	if !errors.Is(err, domain.ErrInvalidTaskTitle) {
		t.Fatalf("CreateTask() error = %v, want ErrInvalidTaskTitle", err)
	}
}

func TestServiceStatusTransitions(t *testing.T) {
	store := newMemoryStore()
	now := time.Date(2026, 4, 23, 10, 0, 0, 0, time.UTC)
	service := NewService(Dependencies{
		Projects: store,
		Tasks:    store,
		Now:      func() time.Time { return now },
		Location: time.UTC,
	})

	task, err := service.CreateTask(context.Background(), CreateTaskInput{Title: "Status task"})
	if err != nil {
		t.Fatalf("CreateTask() error = %v", err)
	}

	now = now.Add(time.Hour)
	task, err = service.UpdateTask(context.Background(), task.ID, UpdateTaskInput{
		Status: OptionalTaskStatus{Set: true, Value: domain.TaskStatusDone},
	})
	if err != nil {
		t.Fatalf("UpdateTask(done) error = %v", err)
	}
	if task.CompletedAt == nil || !task.CompletedAt.Equal(now) {
		t.Fatalf("CompletedAt = %v, want %v", task.CompletedAt, now)
	}

	now = now.Add(time.Hour)
	task, err = service.UpdateTask(context.Background(), task.ID, UpdateTaskInput{
		Status: OptionalTaskStatus{Set: true, Value: domain.TaskStatusTodo},
	})
	if err != nil {
		t.Fatalf("UpdateTask(todo) error = %v", err)
	}
	if task.CompletedAt != nil {
		t.Fatalf("CompletedAt = %v, want nil", task.CompletedAt)
	}
}

func TestServiceUpdatesNullableTaskFields(t *testing.T) {
	service := newTestService()
	ctx := context.Background()

	project, err := service.CreateProject(ctx, CreateProjectInput{Name: "Work"})
	if err != nil {
		t.Fatalf("CreateProject() error = %v", err)
	}
	notes := "  Draft release notes  "
	taskURL := "  docs.example.com/releases/42  "
	dueDate := time.Date(2026, 4, 24, 18, 30, 0, 0, time.UTC)
	task, err := service.CreateTask(ctx, CreateTaskInput{
		ProjectID: &project.ID,
		Title:     "Release",
		Notes:     &notes,
		URL:       &taskURL,
		DueDate:   &dueDate,
	})
	if err != nil {
		t.Fatalf("CreateTask() error = %v", err)
	}

	task, err = service.UpdateTask(ctx, task.ID, UpdateTaskInput{
		ProjectID: OptionalInt64{Set: true, Value: nil},
		Notes:     OptionalString{Set: true, Value: nil},
		URL:       OptionalString{Set: true, Value: nil},
		DueDate:   OptionalDate{Set: true, Value: nil},
	})
	if err != nil {
		t.Fatalf("UpdateTask(clear nullable fields) error = %v", err)
	}
	if task.ProjectID != nil {
		t.Fatalf("ProjectID = %v, want nil", task.ProjectID)
	}
	if task.Notes != nil {
		t.Fatalf("Notes = %v, want nil", task.Notes)
	}
	if task.URL != nil {
		t.Fatalf("URL = %v, want nil", task.URL)
	}
	if task.DueDate != nil {
		t.Fatalf("DueDate = %v, want nil", task.DueDate)
	}
}

func TestServiceRejectsInvalidTaskReferencesAndFilters(t *testing.T) {
	service := newTestService()
	ctx := context.Background()
	missingProjectID := int64(999)
	zeroProjectID := int64(0)

	_, err := service.CreateTask(ctx, CreateTaskInput{Title: "Missing project", ProjectID: &missingProjectID})
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("CreateTask(missing project) error = %v, want ErrNotFound", err)
	}

	task, err := service.CreateTask(ctx, CreateTaskInput{Title: "Existing"})
	if err != nil {
		t.Fatalf("CreateTask() error = %v", err)
	}
	_, err = service.UpdateTask(ctx, task.ID, UpdateTaskInput{
		ProjectID: OptionalInt64{Set: true, Value: &zeroProjectID},
	})
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("UpdateTask(zero project) error = %v, want ErrNotFound", err)
	}

	_, err = service.ListTasks(ctx, ListTasksInput{View: TaskView("blocked")})
	if !errors.Is(err, ErrInvalidFilter) {
		t.Fatalf("ListTasks(invalid view) error = %v, want ErrInvalidFilter", err)
	}
	blockedStatus := domain.TaskStatus("blocked")
	_, err = service.ListTasks(ctx, ListTasksInput{Status: &blockedStatus})
	if !errors.Is(err, domain.ErrInvalidTaskStatus) {
		t.Fatalf("ListTasks(invalid status) error = %v, want ErrInvalidTaskStatus", err)
	}
	_, err = service.ListTasks(ctx, ListTasksInput{ProjectID: &zeroProjectID})
	if !errors.Is(err, ErrInvalidFilter) {
		t.Fatalf("ListTasks(zero project) error = %v, want ErrInvalidFilter", err)
	}
}

func TestServiceCreatesNestedProjectsAndRejectsCycles(t *testing.T) {
	service := newTestService()
	ctx := context.Background()

	parent, err := service.CreateProject(ctx, CreateProjectInput{Name: "Parent"})
	if err != nil {
		t.Fatalf("CreateProject(parent) error = %v", err)
	}
	child, err := service.CreateProject(ctx, CreateProjectInput{Name: "Child", ParentProjectID: &parent.ID})
	if err != nil {
		t.Fatalf("CreateProject(child) error = %v", err)
	}
	if child.ParentProjectID == nil || *child.ParentProjectID != parent.ID {
		t.Fatalf("child parent = %v, want %d", child.ParentProjectID, parent.ID)
	}

	_, err = service.UpdateProject(ctx, parent.ID, UpdateProjectInput{Name: "Parent", ParentProjectID: &child.ID})
	if !errors.Is(err, ErrInvalidHierarchy) {
		t.Fatalf("UpdateProject(cycle) error = %v, want ErrInvalidHierarchy", err)
	}
}

func TestServiceCreatesSubtasksAndRejectsCycles(t *testing.T) {
	service := newTestService()
	ctx := context.Background()

	parent, err := service.CreateTask(ctx, CreateTaskInput{Title: "Parent"})
	if err != nil {
		t.Fatalf("CreateTask(parent) error = %v", err)
	}
	child, err := service.CreateTask(ctx, CreateTaskInput{Title: "Child", ParentTaskID: &parent.ID})
	if err != nil {
		t.Fatalf("CreateTask(child) error = %v", err)
	}
	if child.ParentTaskID == nil || *child.ParentTaskID != parent.ID {
		t.Fatalf("child parent = %v, want %d", child.ParentTaskID, parent.ID)
	}

	_, err = service.UpdateTask(ctx, parent.ID, UpdateTaskInput{
		ParentTaskID: OptionalInt64{Set: true, Value: &child.ID},
	})
	if !errors.Is(err, ErrInvalidHierarchy) {
		t.Fatalf("UpdateTask(cycle) error = %v, want ErrInvalidHierarchy", err)
	}
}

func TestServiceFiltersInboxAndToday(t *testing.T) {
	store := newMemoryStore()
	now := time.Date(2026, 4, 23, 10, 0, 0, 0, time.UTC)
	service := NewService(Dependencies{
		Projects: store,
		Tasks:    store,
		Now:      func() time.Time { return now },
		Location: time.UTC,
	})

	project, err := service.CreateProject(context.Background(), CreateProjectInput{Name: "Work"})
	if err != nil {
		t.Fatalf("CreateProject() error = %v", err)
	}

	today := now
	tomorrow := now.AddDate(0, 0, 1)
	inbox, _ := service.CreateTask(context.Background(), CreateTaskInput{Title: "Inbox"})
	todayTask, _ := service.CreateTask(context.Background(), CreateTaskInput{Title: "Today", DueDate: &today})
	projectTask, _ := service.CreateTask(context.Background(), CreateTaskInput{Title: "Project", ProjectID: &project.ID})
	upcomingTask, _ := service.CreateTask(context.Background(), CreateTaskInput{Title: "Upcoming", DueDate: &tomorrow})
	doneTask, _ := service.CreateTask(context.Background(), CreateTaskInput{Title: "Done", Status: domain.TaskStatusDone})

	inboxTasks, err := service.ListTasks(context.Background(), ListTasksInput{View: TaskViewInbox})
	if err != nil {
		t.Fatalf("ListTasks(inbox) error = %v", err)
	}
	if got := taskIDs(inboxTasks); !slices.Equal(got, []int64{todayTask.ID, upcomingTask.ID, inbox.ID}) {
		t.Fatalf("inbox ids = %v, want [%d %d %d]", got, inbox.ID, todayTask.ID, upcomingTask.ID)
	}

	todayTasks, err := service.ListTasks(context.Background(), ListTasksInput{View: TaskViewToday})
	if err != nil {
		t.Fatalf("ListTasks(today) error = %v", err)
	}
	if got := taskIDs(todayTasks); !slices.Equal(got, []int64{todayTask.ID}) {
		t.Fatalf("today ids = %v, want [%d]", got, todayTask.ID)
	}

	upcomingTasks, err := service.ListTasks(context.Background(), ListTasksInput{View: TaskViewUpcoming})
	if err != nil {
		t.Fatalf("ListTasks(upcoming) error = %v", err)
	}
	if got := taskIDs(upcomingTasks); !slices.Equal(got, []int64{upcomingTask.ID}) {
		t.Fatalf("upcoming ids = %v, want [%d]", got, upcomingTask.ID)
	}

	projectTasks, err := service.ListTasks(context.Background(), ListTasksInput{ProjectID: &project.ID})
	if err != nil {
		t.Fatalf("ListTasks(project) error = %v", err)
	}
	if got := taskIDs(projectTasks); !slices.Equal(got, []int64{projectTask.ID}) {
		t.Fatalf("project ids = %v, want [%d]", got, projectTask.ID)
	}

	allTasks, err := service.ListTasks(context.Background(), ListTasksInput{})
	if err != nil {
		t.Fatalf("ListTasks(all) error = %v", err)
	}
	if got := taskIDs(allTasks); !slices.Equal(got, []int64{todayTask.ID, upcomingTask.ID, inbox.ID, projectTask.ID, doneTask.ID}) {
		t.Fatalf("all ids = %v, want all task ids", got)
	}

	doneStatus := domain.TaskStatusDone
	doneTasks, err := service.ListTasks(context.Background(), ListTasksInput{Status: &doneStatus})
	if err != nil {
		t.Fatalf("ListTasks(done) error = %v", err)
	}
	if got := taskIDs(doneTasks); !slices.Equal(got, []int64{doneTask.ID}) {
		t.Fatalf("done ids = %v, want [%d]", got, doneTask.ID)
	}
}

func TestServiceFiltersOverdueFlaggedSearchAndSort(t *testing.T) {
	store := newMemoryStore()
	now := time.Date(2026, 4, 23, 10, 30, 0, 0, time.UTC)
	service := NewService(Dependencies{
		Projects: store,
		Tasks:    store,
		Now:      func() time.Time { return now },
		Location: time.UTC,
	})

	yesterday := now.AddDate(0, 0, -1)
	today := now
	tomorrow := now.AddDate(0, 0, 1)
	pastTime := "09:00"
	futureTime := "12:00"
	low := domain.TaskPriorityLow
	high := domain.TaskPriorityHigh
	overdueDateTask, _ := service.CreateTask(context.Background(), CreateTaskInput{Title: "Alpha old", DueDate: &yesterday})
	milkURL := "https://recipes.example.com/milk"
	overdueTimeTask, _ := service.CreateTask(context.Background(), CreateTaskInput{Title: "Milk today", URL: &milkURL, DueDate: &today, DueTime: &pastTime, Flagged: true, Priority: high})
	futureTask, _ := service.CreateTask(context.Background(), CreateTaskInput{Title: "Beta later", DueDate: &today, DueTime: &futureTime, Priority: low})
	tomorrowTask, _ := service.CreateTask(context.Background(), CreateTaskInput{Title: "Gamma tomorrow", DueDate: &tomorrow})

	overdueTasks, err := service.ListTasks(context.Background(), ListTasksInput{View: TaskViewOverdue})
	if err != nil {
		t.Fatalf("ListTasks(overdue) error = %v", err)
	}
	if got := taskIDs(overdueTasks); !slices.Equal(got, []int64{overdueDateTask.ID, overdueTimeTask.ID}) {
		t.Fatalf("overdue ids = %v, want overdue date and time tasks", got)
	}

	flaggedTasks, err := service.ListTasks(context.Background(), ListTasksInput{View: TaskViewFlagged})
	if err != nil {
		t.Fatalf("ListTasks(flagged) error = %v", err)
	}
	if got := taskIDs(flaggedTasks); !slices.Equal(got, []int64{overdueTimeTask.ID}) {
		t.Fatalf("flagged ids = %v, want [%d]", got, overdueTimeTask.ID)
	}

	searchTasks, err := service.ListTasks(context.Background(), ListTasksInput{Query: "milk"})
	if err != nil {
		t.Fatalf("ListTasks(search) error = %v", err)
	}
	if got := taskIDs(searchTasks); !slices.Equal(got, []int64{overdueTimeTask.ID}) {
		t.Fatalf("search ids = %v, want [%d]", got, overdueTimeTask.ID)
	}

	urlSearchTasks, err := service.ListTasks(context.Background(), ListTasksInput{Query: "recipes.example.com"})
	if err != nil {
		t.Fatalf("ListTasks(url search) error = %v", err)
	}
	if got := taskIDs(urlSearchTasks); !slices.Equal(got, []int64{overdueTimeTask.ID}) {
		t.Fatalf("url search ids = %v, want [%d]", got, overdueTimeTask.ID)
	}

	priorityTasks, err := service.ListTasks(context.Background(), ListTasksInput{Sort: TaskSortPriority, Direction: SortDirectionDesc})
	if err != nil {
		t.Fatalf("ListTasks(priority sort) error = %v", err)
	}
	if got := taskIDs(priorityTasks); !slices.Equal(got[:2], []int64{overdueTimeTask.ID, futureTask.ID}) {
		t.Fatalf("priority ids = %v, want high then low first", got)
	}

	_ = tomorrowTask
}

func TestServiceSortsCompletedTasksLastForExplicitSorts(t *testing.T) {
	store := newMemoryStore()
	now := time.Date(2026, 4, 23, 10, 30, 0, 0, time.UTC)
	service := NewService(Dependencies{
		Projects: store,
		Tasks:    store,
		Now:      func() time.Time { return now },
		Location: time.UTC,
	})

	project, err := service.CreateProject(context.Background(), CreateProjectInput{Name: "Work"})
	if err != nil {
		t.Fatalf("CreateProject() error = %v", err)
	}

	low := domain.TaskPriorityLow
	medium := domain.TaskPriorityMedium
	high := domain.TaskPriorityHigh
	activeLow, _ := service.CreateTask(context.Background(), CreateTaskInput{ProjectID: &project.ID, Title: "Active low", Priority: low})
	doneHigh, _ := service.CreateTask(context.Background(), CreateTaskInput{ProjectID: &project.ID, Title: "Done high", Status: domain.TaskStatusDone, Priority: high})
	activeMedium, _ := service.CreateTask(context.Background(), CreateTaskInput{ProjectID: &project.ID, Title: "Active medium", Priority: medium})

	projectTasks, err := service.ListTasks(context.Background(), ListTasksInput{
		ProjectID: &project.ID,
		Sort:      TaskSortPriority,
		Direction: SortDirectionDesc,
	})
	if err != nil {
		t.Fatalf("ListTasks(project priority sort) error = %v", err)
	}
	if got := taskIDs(projectTasks); !slices.Equal(got, []int64{activeMedium.ID, activeLow.ID, doneHigh.ID}) {
		t.Fatalf("project priority ids = %v, want active tasks before completed task", got)
	}
}

func TestServiceProjectLifecycleArchiveRestoreAndCascadeDelete(t *testing.T) {
	store := newMemoryStore()
	service := NewService(Dependencies{
		Projects: store,
		Tasks:    store,
		Now: func() time.Time {
			return time.Date(2026, 4, 23, 10, 0, 0, 0, time.UTC)
		},
		Location: time.UTC,
	})
	ctx := context.Background()

	project, err := service.CreateProject(ctx, CreateProjectInput{Name: "  Home  "})
	if err != nil {
		t.Fatalf("CreateProject() error = %v", err)
	}
	if project.Name != "Home" {
		t.Fatalf("Name = %q, want Home", project.Name)
	}

	project, err = service.UpdateProject(ctx, project.ID, UpdateProjectInput{Name: "Personal"})
	if err != nil {
		t.Fatalf("UpdateProject() error = %v", err)
	}
	if project.Name != "Personal" {
		t.Fatalf("Name = %q, want Personal", project.Name)
	}

	projectTask, err := service.CreateTask(ctx, CreateTaskInput{Title: "Bound task", ProjectID: &project.ID})
	if err != nil {
		t.Fatalf("CreateTask() error = %v", err)
	}
	inboxTask, err := service.CreateTask(ctx, CreateTaskInput{Title: "Inbox"})
	if err != nil {
		t.Fatalf("CreateTask(inbox) error = %v", err)
	}

	project, err = service.ArchiveProject(ctx, project.ID)
	if err != nil {
		t.Fatalf("ArchiveProject() error = %v", err)
	}
	if !project.Archived {
		t.Fatalf("Archived = false, want true")
	}

	activeProjects, err := service.ListProjects(ctx, ListProjectsInput{})
	if err != nil {
		t.Fatalf("ListProjects(active) error = %v", err)
	}
	if len(activeProjects) != 0 {
		t.Fatalf("active projects = %+v, want none", activeProjects)
	}

	archivedOnly := true
	archivedProjects, err := service.ListProjects(ctx, ListProjectsInput{Archived: &archivedOnly})
	if err != nil {
		t.Fatalf("ListProjects(archived) error = %v", err)
	}
	if len(archivedProjects) != 1 || archivedProjects[0].ID != project.ID {
		t.Fatalf("archived projects = %+v, want archived project", archivedProjects)
	}

	allTasks, err := service.ListTasks(ctx, ListTasksInput{})
	if err != nil {
		t.Fatalf("ListTasks(all with archived project) error = %v", err)
	}
	if slices.Contains(taskIDs(allTasks), projectTask.ID) {
		t.Fatalf("all tasks include archived project task %d, want hidden", projectTask.ID)
	}

	projectTasks, err := service.ListTasks(ctx, ListTasksInput{ProjectID: &project.ID})
	if err != nil {
		t.Fatalf("ListTasks(archived project) error = %v", err)
	}
	if got := taskIDs(projectTasks); !slices.Equal(got, []int64{projectTask.ID}) {
		t.Fatalf("archived project ids = %v, want [%d]", got, projectTask.ID)
	}

	project, err = service.RestoreProject(ctx, project.ID)
	if err != nil {
		t.Fatalf("RestoreProject() error = %v", err)
	}
	if project.Archived {
		t.Fatalf("Archived = true, want false")
	}

	allTasks, err = service.ListTasks(ctx, ListTasksInput{})
	if err != nil {
		t.Fatalf("ListTasks(all restored) error = %v", err)
	}
	if !slices.Contains(taskIDs(allTasks), projectTask.ID) {
		t.Fatalf("all tasks = %v, want restored project task %d", taskIDs(allTasks), projectTask.ID)
	}

	err = service.DeleteProject(ctx, project.ID)
	if err != nil {
		t.Fatalf("DeleteProject() error = %v", err)
	}

	allTasks, err = service.ListTasks(ctx, ListTasksInput{})
	if err != nil {
		t.Fatalf("ListTasks(after delete) error = %v", err)
	}
	if slices.Contains(taskIDs(allTasks), projectTask.ID) {
		t.Fatalf("all tasks include deleted project task %d, want removed", projectTask.ID)
	}
	if !slices.Contains(taskIDs(allTasks), inboxTask.ID) {
		t.Fatalf("all tasks = %v, want inbox task %d untouched", taskIDs(allTasks), inboxTask.ID)
	}
}

func newTestService() *Service {
	store := newMemoryStore()
	return NewService(Dependencies{
		Projects: store,
		Tasks:    store,
		Now: func() time.Time {
			return time.Date(2026, 4, 23, 10, 0, 0, 0, time.UTC)
		},
		Location: time.UTC,
	})
}

type memoryStore struct {
	nextProjectID int64
	nextTaskID    int64
	projects      map[int64]domain.Project
	tasks         map[int64]domain.Task
}

func newMemoryStore() *memoryStore {
	return &memoryStore{
		nextProjectID: 1,
		nextTaskID:    1,
		projects:      map[int64]domain.Project{},
		tasks:         map[int64]domain.Task{},
	}
}

func (store *memoryStore) ListProjects(_ context.Context, filter ProjectListFilter) ([]domain.Project, error) {
	projects := make([]domain.Project, 0, len(store.projects))
	for _, project := range store.projects {
		if filter.Archived != nil {
			if project.Archived != *filter.Archived {
				continue
			}
		} else if !filter.IncludeArchived && project.Archived {
			continue
		}
		projects = append(projects, project)
	}
	slices.SortFunc(projects, func(left, right domain.Project) int {
		if left.Name < right.Name {
			return -1
		}
		if left.Name > right.Name {
			return 1
		}
		return 0
	})
	return projects, nil
}

func (store *memoryStore) GetProject(_ context.Context, id int64) (domain.Project, error) {
	project, ok := store.projects[id]
	if !ok {
		return domain.Project{}, ErrNotFound
	}
	return project, nil
}

func (store *memoryStore) CreateProject(_ context.Context, project domain.Project) (domain.Project, error) {
	project.ID = store.nextProjectID
	store.nextProjectID++
	store.projects[project.ID] = project
	return project, nil
}

func (store *memoryStore) UpdateProject(_ context.Context, project domain.Project) (domain.Project, error) {
	if _, ok := store.projects[project.ID]; !ok {
		return domain.Project{}, ErrNotFound
	}
	store.projects[project.ID] = project
	return project, nil
}

func (store *memoryStore) DeleteProject(_ context.Context, id int64) error {
	if _, ok := store.projects[id]; !ok {
		return ErrNotFound
	}
	for projectID, project := range store.projects {
		if project.ParentProjectID != nil && *project.ParentProjectID == id {
			project.ParentProjectID = nil
			store.projects[projectID] = project
		}
	}
	for taskID, task := range store.tasks {
		if task.ProjectID != nil && *task.ProjectID == id {
			delete(store.tasks, taskID)
		}
	}
	delete(store.projects, id)
	return nil
}

func (store *memoryStore) ListTasks(_ context.Context, filter TaskListFilter) ([]domain.Task, error) {
	tasks := make([]domain.Task, 0, len(store.tasks))
	for _, task := range store.tasks {
		if filter.ProjectID == nil && task.ProjectID != nil {
			project, ok := store.projects[*task.ProjectID]
			if ok && project.Archived {
				continue
			}
		}
		tasks = append(tasks, task)
	}
	slices.SortFunc(tasks, func(left, right domain.Task) int {
		if left.ID < right.ID {
			return -1
		}
		if left.ID > right.ID {
			return 1
		}
		return 0
	})
	return ApplyTaskFilter(tasks, filter), nil
}

func (store *memoryStore) GetTask(_ context.Context, id int64) (domain.Task, error) {
	task, ok := store.tasks[id]
	if !ok {
		return domain.Task{}, ErrNotFound
	}
	return task, nil
}

func (store *memoryStore) CreateTask(_ context.Context, task domain.Task) (domain.Task, error) {
	task.ID = store.nextTaskID
	store.nextTaskID++
	store.tasks[task.ID] = task
	return task, nil
}

func (store *memoryStore) UpdateTask(_ context.Context, task domain.Task) (domain.Task, error) {
	if _, ok := store.tasks[task.ID]; !ok {
		return domain.Task{}, ErrNotFound
	}
	store.tasks[task.ID] = task
	return task, nil
}

func (store *memoryStore) DeleteTask(_ context.Context, id int64) error {
	if _, ok := store.tasks[id]; !ok {
		return ErrNotFound
	}
	for taskID, task := range store.tasks {
		if task.ParentTaskID != nil && *task.ParentTaskID == id {
			task.ParentTaskID = nil
			store.tasks[taskID] = task
		}
	}
	delete(store.tasks, id)
	return nil
}

func taskIDs(tasks []domain.Task) []int64 {
	ids := make([]int64, 0, len(tasks))
	for _, task := range tasks {
		ids = append(ids, task.ID)
	}
	return ids
}
