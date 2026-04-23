package todohttp

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
	"time"

	"github.com/anton415/anton415-os/internal/todo/application"
	"github.com/anton415/anton415-os/internal/todo/domain"
)

func TestTaskCreateListAndValidation(t *testing.T) {
	router := newTestRouter()

	createResponse := httptest.NewRecorder()
	router.ServeHTTP(createResponse, httptest.NewRequest(http.MethodPost, "/tasks", bytes.NewBufferString(`{"title":"  Buy milk  "}`)))
	if createResponse.Code != http.StatusCreated {
		t.Fatalf("create status = %d, want %d; body=%s", createResponse.Code, http.StatusCreated, createResponse.Body.String())
	}

	var created struct {
		Data taskResponse `json:"data"`
	}
	if err := json.NewDecoder(createResponse.Body).Decode(&created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	if created.Data.Title != "Buy milk" {
		t.Fatalf("created title = %q, want Buy milk", created.Data.Title)
	}

	listResponse := httptest.NewRecorder()
	router.ServeHTTP(listResponse, httptest.NewRequest(http.MethodGet, "/tasks?view=inbox", nil))
	if listResponse.Code != http.StatusOK {
		t.Fatalf("list status = %d, want %d", listResponse.Code, http.StatusOK)
	}
	var listed struct {
		Data []taskResponse `json:"data"`
	}
	if err := json.NewDecoder(listResponse.Body).Decode(&listed); err != nil {
		t.Fatalf("decode list response: %v", err)
	}
	if len(listed.Data) != 1 || listed.Data[0].ID != created.Data.ID {
		t.Fatalf("listed tasks = %+v, want created task", listed.Data)
	}

	invalidResponse := httptest.NewRecorder()
	router.ServeHTTP(invalidResponse, httptest.NewRequest(http.MethodPost, "/tasks", bytes.NewBufferString(`{"title":"   "}`)))
	if invalidResponse.Code != http.StatusBadRequest {
		t.Fatalf("invalid status = %d, want %d", invalidResponse.Code, http.StatusBadRequest)
	}
}

func TestTaskNotFound(t *testing.T) {
	router := newTestRouter()

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodPatch, "/tasks/99", bytes.NewBufferString(`{"status":"done"}`)))

	if response.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusNotFound)
	}
}

func TestProjectCRUDAndDeleteConflict(t *testing.T) {
	router := newTestRouter()

	createProjectResponse := httptest.NewRecorder()
	router.ServeHTTP(createProjectResponse, httptest.NewRequest(http.MethodPost, "/projects", bytes.NewBufferString(`{"name":"Home"}`)))
	if createProjectResponse.Code != http.StatusCreated {
		t.Fatalf("create project status = %d, want %d", createProjectResponse.Code, http.StatusCreated)
	}

	var createdProject struct {
		Data projectResponse `json:"data"`
	}
	if err := json.NewDecoder(createProjectResponse.Body).Decode(&createdProject); err != nil {
		t.Fatalf("decode project response: %v", err)
	}

	updateProjectResponse := httptest.NewRecorder()
	router.ServeHTTP(updateProjectResponse, httptest.NewRequest(http.MethodPatch, "/projects/1", bytes.NewBufferString(`{"name":"Personal"}`)))
	if updateProjectResponse.Code != http.StatusOK {
		t.Fatalf("update project status = %d, want %d", updateProjectResponse.Code, http.StatusOK)
	}

	createTaskResponse := httptest.NewRecorder()
	router.ServeHTTP(createTaskResponse, httptest.NewRequest(http.MethodPost, "/tasks", bytes.NewBufferString(`{"title":"Bound","project_id":1}`)))
	if createTaskResponse.Code != http.StatusCreated {
		t.Fatalf("create task status = %d, want %d", createTaskResponse.Code, http.StatusCreated)
	}

	deleteProjectResponse := httptest.NewRecorder()
	router.ServeHTTP(deleteProjectResponse, httptest.NewRequest(http.MethodDelete, "/projects/1", nil))
	if deleteProjectResponse.Code != http.StatusConflict {
		t.Fatalf("delete project status = %d, want %d", deleteProjectResponse.Code, http.StatusConflict)
	}

	_ = createdProject
}

func newTestRouter() http.Handler {
	store := newMemoryStore()
	service := application.NewService(application.Dependencies{
		Projects: store,
		Tasks:    store,
		Now: func() time.Time {
			return time.Date(2026, 4, 23, 10, 0, 0, 0, time.UTC)
		},
		Location: time.UTC,
	})
	return NewRouter(service)
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

func (store *memoryStore) ListProjects(context.Context) ([]domain.Project, error) {
	projects := make([]domain.Project, 0, len(store.projects))
	for _, project := range store.projects {
		projects = append(projects, project)
	}
	slices.SortFunc(projects, func(left, right domain.Project) int {
		if left.ID < right.ID {
			return -1
		}
		if left.ID > right.ID {
			return 1
		}
		return 0
	})
	return projects, nil
}

func (store *memoryStore) GetProject(_ context.Context, id int64) (domain.Project, error) {
	project, ok := store.projects[id]
	if !ok {
		return domain.Project{}, application.ErrNotFound
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
		return domain.Project{}, application.ErrNotFound
	}
	store.projects[project.ID] = project
	return project, nil
}

func (store *memoryStore) DeleteProject(_ context.Context, id int64) error {
	if _, ok := store.projects[id]; !ok {
		return application.ErrNotFound
	}
	for _, task := range store.tasks {
		if task.ProjectID != nil && *task.ProjectID == id {
			return application.ErrProjectHasTasks
		}
	}
	delete(store.projects, id)
	return nil
}

func (store *memoryStore) ListTasks(_ context.Context, filter application.TaskListFilter) ([]domain.Task, error) {
	tasks := make([]domain.Task, 0, len(store.tasks))
	for _, task := range store.tasks {
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
	return application.ApplyTaskFilter(tasks, filter), nil
}

func (store *memoryStore) GetTask(_ context.Context, id int64) (domain.Task, error) {
	task, ok := store.tasks[id]
	if !ok {
		return domain.Task{}, application.ErrNotFound
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
		return domain.Task{}, application.ErrNotFound
	}
	store.tasks[task.ID] = task
	return task, nil
}

func (store *memoryStore) DeleteTask(_ context.Context, id int64) error {
	if _, ok := store.tasks[id]; !ok {
		return application.ErrNotFound
	}
	delete(store.tasks, id)
	return nil
}
