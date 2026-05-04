package application

import (
	"context"
	"time"

	"github.com/anton415/anton415-hub/internal/todo/domain"
)

type ProjectRepository interface {
	ListProjects(ctx context.Context, filter ProjectListFilter) ([]domain.Project, error)
	GetProject(ctx context.Context, id int64) (domain.Project, error)
	CreateProject(ctx context.Context, project domain.Project) (domain.Project, error)
	UpdateProject(ctx context.Context, project domain.Project) (domain.Project, error)
	DeleteProject(ctx context.Context, id int64) error
}

type TaskRepository interface {
	ListTasks(ctx context.Context, filter TaskListFilter) ([]domain.Task, error)
	GetTask(ctx context.Context, id int64) (domain.Task, error)
	CreateTask(ctx context.Context, task domain.Task) (domain.Task, error)
	UpdateTask(ctx context.Context, task domain.Task) (domain.Task, error)
	DeleteTask(ctx context.Context, id int64) error
}

type Dependencies struct {
	Projects ProjectRepository
	Tasks    TaskRepository
	Now      func() time.Time
	Location *time.Location
}

type Service struct {
	projects ProjectRepository
	tasks    TaskRepository
	now      func() time.Time
	location *time.Location
}

func NewService(deps Dependencies) *Service {
	now := deps.Now
	if now == nil {
		now = time.Now
	}

	location := deps.Location
	if location == nil {
		location = time.Local
	}

	return &Service{
		projects: deps.Projects,
		tasks:    deps.Tasks,
		now:      now,
		location: location,
	}
}

type CreateProjectInput struct {
	ParentProjectID *int64
	Name            string
	StartDate       *time.Time
	EndDate         *time.Time
}

type ListProjectsInput struct {
	IncludeArchived bool
	Archived        *bool
}

type ProjectListFilter struct {
	IncludeArchived bool
	Archived        *bool
}

type UpdateProjectInput struct {
	ParentProjectID *int64
	Name            string
	StartDate       *time.Time
	EndDate         *time.Time
}

func (service *Service) ListProjects(ctx context.Context, input ListProjectsInput) ([]domain.Project, error) {
	return service.projects.ListProjects(ctx, ProjectListFilter{
		IncludeArchived: input.IncludeArchived,
		Archived:        input.Archived,
	})
}

func (service *Service) CreateProject(ctx context.Context, input CreateProjectInput) (domain.Project, error) {
	if err := service.ensureProjectParent(ctx, 0, input.ParentProjectID); err != nil {
		return domain.Project{}, err
	}

	project, err := domain.NewProject(input.ParentProjectID, input.Name, input.StartDate, input.EndDate, service.now())
	if err != nil {
		return domain.Project{}, err
	}
	return service.projects.CreateProject(ctx, project)
}

func (service *Service) UpdateProject(ctx context.Context, id int64, input UpdateProjectInput) (domain.Project, error) {
	project, err := service.projects.GetProject(ctx, id)
	if err != nil {
		return domain.Project{}, err
	}

	if err := service.ensureProjectParent(ctx, id, input.ParentProjectID); err != nil {
		return domain.Project{}, err
	}

	project, err = domain.UpdateProject(project, input.ParentProjectID, input.Name, input.StartDate, input.EndDate, service.now())
	if err != nil {
		return domain.Project{}, err
	}

	return service.projects.UpdateProject(ctx, project)
}

func (service *Service) ArchiveProject(ctx context.Context, id int64) (domain.Project, error) {
	project, err := service.projects.GetProject(ctx, id)
	if err != nil {
		return domain.Project{}, err
	}
	return service.projects.UpdateProject(ctx, domain.ArchiveProject(project, service.now()))
}

func (service *Service) RestoreProject(ctx context.Context, id int64) (domain.Project, error) {
	project, err := service.projects.GetProject(ctx, id)
	if err != nil {
		return domain.Project{}, err
	}
	return service.projects.UpdateProject(ctx, domain.RestoreProject(project, service.now()))
}

func (service *Service) DeleteProject(ctx context.Context, id int64) error {
	return service.projects.DeleteProject(ctx, id)
}

type CreateTaskInput struct {
	ProjectID       *int64
	ParentTaskID    *int64
	Title           string
	Notes           *string
	URL             *string
	Status          domain.TaskStatus
	DueDate         *time.Time
	DueTime         *string
	RepeatFrequency domain.RepeatFrequency
	RepeatInterval  int
	RepeatUntil     *time.Time
	Flagged         bool
	Priority        domain.TaskPriority
}

type OptionalInt64 struct {
	Set   bool
	Value *int64
}

type OptionalString struct {
	Set   bool
	Value *string
}

type OptionalDate struct {
	Set   bool
	Value *time.Time
}

type OptionalBool struct {
	Set   bool
	Value bool
}

type OptionalInt struct {
	Set   bool
	Value int
}

type OptionalTaskStatus struct {
	Set   bool
	Value domain.TaskStatus
}

type OptionalRepeatFrequency struct {
	Set   bool
	Value domain.RepeatFrequency
}

type OptionalTaskPriority struct {
	Set   bool
	Value domain.TaskPriority
}

type UpdateTaskInput struct {
	ProjectID       OptionalInt64
	ParentTaskID    OptionalInt64
	Title           OptionalString
	Notes           OptionalString
	URL             OptionalString
	Status          OptionalTaskStatus
	DueDate         OptionalDate
	DueTime         OptionalString
	RepeatFrequency OptionalRepeatFrequency
	RepeatInterval  OptionalInt
	RepeatUntil     OptionalDate
	Flagged         OptionalBool
	Priority        OptionalTaskPriority
}

func (service *Service) ListTasks(ctx context.Context, input ListTasksInput) ([]domain.Task, error) {
	filter, err := service.taskListFilter(input)
	if err != nil {
		return nil, err
	}
	return service.tasks.ListTasks(ctx, filter)
}

func (service *Service) CreateTask(ctx context.Context, input CreateTaskInput) (domain.Task, error) {
	if err := service.ensureProjectExists(ctx, input.ProjectID); err != nil {
		return domain.Task{}, err
	}
	if err := service.ensureTaskParent(ctx, 0, input.ParentTaskID); err != nil {
		return domain.Task{}, err
	}

	task, err := domain.NewTask(domain.NewTaskInput{
		ProjectID:       input.ProjectID,
		ParentTaskID:    input.ParentTaskID,
		Title:           input.Title,
		Notes:           input.Notes,
		URL:             input.URL,
		Status:          input.Status,
		DueDate:         input.DueDate,
		DueTime:         input.DueTime,
		RepeatFrequency: input.RepeatFrequency,
		RepeatInterval:  input.RepeatInterval,
		RepeatUntil:     input.RepeatUntil,
		Flagged:         input.Flagged,
		Priority:        input.Priority,
	}, service.now())
	if err != nil {
		return domain.Task{}, err
	}

	return service.tasks.CreateTask(ctx, task)
}

func (service *Service) UpdateTask(ctx context.Context, id int64, input UpdateTaskInput) (domain.Task, error) {
	task, err := service.tasks.GetTask(ctx, id)
	if err != nil {
		return domain.Task{}, err
	}

	now := service.now()
	if input.ProjectID.Set {
		if err := service.ensureProjectExists(ctx, input.ProjectID.Value); err != nil {
			return domain.Task{}, err
		}
		task.SetProject(input.ProjectID.Value, now)
	}
	if input.ParentTaskID.Set {
		if err := service.ensureTaskParent(ctx, id, input.ParentTaskID.Value); err != nil {
			return domain.Task{}, err
		}
		if err := task.SetParentTask(input.ParentTaskID.Value, now); err != nil {
			return domain.Task{}, err
		}
	}
	if input.Title.Set {
		if input.Title.Value == nil {
			return domain.Task{}, domain.ErrInvalidTaskTitle
		}
		if err := task.Rename(*input.Title.Value, now); err != nil {
			return domain.Task{}, err
		}
	}
	if input.Notes.Set {
		task.SetNotes(input.Notes.Value, now)
	}
	if input.URL.Set {
		if err := task.SetURL(input.URL.Value, now); err != nil {
			return domain.Task{}, err
		}
	}
	if input.DueDate.Set {
		task.SetDueDate(input.DueDate.Value, now)
	}
	if input.DueTime.Set {
		if err := task.SetDueTime(input.DueTime.Value, now); err != nil {
			return domain.Task{}, err
		}
	}
	if input.RepeatFrequency.Set || input.RepeatInterval.Set || input.RepeatUntil.Set {
		frequency := task.RepeatFrequency
		interval := task.RepeatInterval
		repeatUntil := task.RepeatUntil
		if input.RepeatFrequency.Set {
			frequency = input.RepeatFrequency.Value
		}
		if input.RepeatInterval.Set {
			interval = input.RepeatInterval.Value
		}
		if input.RepeatUntil.Set {
			repeatUntil = input.RepeatUntil.Value
		}
		if err := task.SetRepeat(frequency, interval, repeatUntil, now); err != nil {
			return domain.Task{}, err
		}
	}
	if input.Flagged.Set {
		task.SetFlagged(input.Flagged.Value, now)
	}
	if input.Priority.Set {
		if err := task.SetPriority(input.Priority.Value, now); err != nil {
			return domain.Task{}, err
		}
	}
	if err := task.ValidateSchedule(); err != nil {
		return domain.Task{}, err
	}
	if input.Status.Set {
		if input.Status.Value == domain.TaskStatusDone {
			if err := task.CompleteOrAdvanceRepeat(now); err != nil {
				return domain.Task{}, err
			}
		} else if err := task.ApplyStatus(input.Status.Value, now); err != nil {
			return domain.Task{}, err
		}
	}

	return service.tasks.UpdateTask(ctx, task)
}

func (service *Service) DeleteTask(ctx context.Context, id int64) error {
	return service.tasks.DeleteTask(ctx, id)
}

func (service *Service) ensureProjectExists(ctx context.Context, projectID *int64) error {
	if projectID == nil {
		return nil
	}
	if *projectID <= 0 {
		return ErrNotFound
	}

	_, err := service.projects.GetProject(ctx, *projectID)
	return err
}

func (service *Service) ensureProjectParent(ctx context.Context, projectID int64, parentProjectID *int64) error {
	if parentProjectID == nil {
		return nil
	}
	if *parentProjectID <= 0 {
		return ErrInvalidHierarchy
	}
	if projectID > 0 && *parentProjectID == projectID {
		return ErrInvalidHierarchy
	}

	parent, err := service.projects.GetProject(ctx, *parentProjectID)
	if err != nil {
		return err
	}
	visited := map[int64]bool{parent.ID: true}
	for parent.ParentProjectID != nil {
		if projectID > 0 && *parent.ParentProjectID == projectID {
			return ErrInvalidHierarchy
		}
		if visited[*parent.ParentProjectID] {
			return ErrInvalidHierarchy
		}
		parent, err = service.projects.GetProject(ctx, *parent.ParentProjectID)
		if err != nil {
			return err
		}
		visited[parent.ID] = true
	}
	return nil
}

func (service *Service) ensureTaskParent(ctx context.Context, taskID int64, parentTaskID *int64) error {
	if parentTaskID == nil {
		return nil
	}
	if *parentTaskID <= 0 {
		return ErrInvalidHierarchy
	}
	if taskID > 0 && *parentTaskID == taskID {
		return ErrInvalidHierarchy
	}

	parent, err := service.tasks.GetTask(ctx, *parentTaskID)
	if err != nil {
		return err
	}
	visited := map[int64]bool{parent.ID: true}
	for parent.ParentTaskID != nil {
		if taskID > 0 && *parent.ParentTaskID == taskID {
			return ErrInvalidHierarchy
		}
		if visited[*parent.ParentTaskID] {
			return ErrInvalidHierarchy
		}
		parent, err = service.tasks.GetTask(ctx, *parent.ParentTaskID)
		if err != nil {
			return err
		}
		visited[parent.ID] = true
	}
	return nil
}

func (service *Service) taskListFilter(input ListTasksInput) (TaskListFilter, error) {
	if !input.View.Valid() {
		return TaskListFilter{}, ErrInvalidFilter
	}
	if input.Status != nil && !input.Status.Valid() {
		return TaskListFilter{}, domain.ErrInvalidTaskStatus
	}
	if input.ProjectID != nil && *input.ProjectID <= 0 {
		return TaskListFilter{}, ErrInvalidFilter
	}
	if !input.Sort.Valid() || !input.Direction.Valid() {
		return TaskListFilter{}, ErrInvalidFilter
	}

	now := service.now().In(service.location)
	return TaskListFilter{
		View:      input.View,
		Status:    input.Status,
		ProjectID: input.ProjectID,
		Sort:      input.Sort,
		Direction: input.Direction,
		Query:     input.Query,
		Today:     dateOnly(now),
		Now:       now,
	}, nil
}
