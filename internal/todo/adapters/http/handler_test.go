package todohttp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
	"time"

	"github.com/anton415/anton415-hub/internal/todo/application"
	"github.com/anton415/anton415-hub/internal/todo/domain"
)

func TestTaskCreateListAndValidation(t *testing.T) {
	router := newTestRouter()

	createResponse := httptest.NewRecorder()
	router.ServeHTTP(createResponse, httptest.NewRequest(http.MethodPost, "/tasks", bytes.NewBufferString(`{"title":"  Buy milk  ","due_date":"2026-04-23","due_time":"09:30","repeat_frequency":"daily","repeat_interval":2,"repeat_until":"2026-04-30","flagged":true,"priority":"high"}`)))
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
	if created.Data.DueTime == nil || *created.Data.DueTime != "09:30" || created.Data.RepeatFrequency != "daily" || created.Data.RepeatInterval != 2 || !created.Data.Flagged || created.Data.Priority != "high" {
		t.Fatalf("created schedule fields = %+v, want due time/repeat/flag/priority", created.Data)
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

func TestTaskListAllCompletedAndProjectFilters(t *testing.T) {
	router := newTestRouter()

	createProjectRecorder := performRequest(router, http.MethodPost, "/projects", `{"name":"Home"}`)
	if createProjectRecorder.Code != http.StatusCreated {
		t.Fatalf("create project status = %d, want %d", createProjectRecorder.Code, http.StatusCreated)
	}
	project := decodeData[projectResponse](t, createProjectRecorder)

	inboxResponse := performRequest(router, http.MethodPost, "/tasks", `{"title":"Inbox"}`)
	doneResponse := performRequest(router, http.MethodPost, "/tasks", `{"title":"Done","status":"done"}`)
	projectTaskResponse := performRequest(router, http.MethodPost, "/tasks", fmt.Sprintf(`{"title":"Project","project_id":%d}`, project.ID))
	for label, response := range map[string]*httptest.ResponseRecorder{
		"inbox":   inboxResponse,
		"done":    doneResponse,
		"project": projectTaskResponse,
	} {
		if response.Code != http.StatusCreated {
			t.Fatalf("create %s task status = %d, want %d", label, response.Code, http.StatusCreated)
		}
	}

	inboxTask := decodeData[taskResponse](t, inboxResponse)
	doneTask := decodeData[taskResponse](t, doneResponse)
	projectTask := decodeData[taskResponse](t, projectTaskResponse)

	allResponse := performRequest(router, http.MethodGet, "/tasks", "")
	if allResponse.Code != http.StatusOK {
		t.Fatalf("list all status = %d, want %d", allResponse.Code, http.StatusOK)
	}
	allTasks := decodeData[[]taskResponse](t, allResponse)
	if got := responseTaskIDs(allTasks); !slices.Equal(got, []int64{inboxTask.ID, projectTask.ID, doneTask.ID}) {
		t.Fatalf("all ids = %v, want [%d %d %d]", got, inboxTask.ID, doneTask.ID, projectTask.ID)
	}

	completedResponse := performRequest(router, http.MethodGet, "/tasks?status=done", "")
	if completedResponse.Code != http.StatusOK {
		t.Fatalf("list completed status = %d, want %d", completedResponse.Code, http.StatusOK)
	}
	completedTasks := decodeData[[]taskResponse](t, completedResponse)
	if got := responseTaskIDs(completedTasks); !slices.Equal(got, []int64{doneTask.ID}) {
		t.Fatalf("completed ids = %v, want [%d]", got, doneTask.ID)
	}

	projectListResponse := performRequest(router, http.MethodGet, fmt.Sprintf("/tasks?project_id=%d", project.ID), "")
	if projectListResponse.Code != http.StatusOK {
		t.Fatalf("list project status = %d, want %d", projectListResponse.Code, http.StatusOK)
	}
	projectTasks := decodeData[[]taskResponse](t, projectListResponse)
	if got := responseTaskIDs(projectTasks); !slices.Equal(got, []int64{projectTask.ID}) {
		t.Fatalf("project ids = %v, want [%d]", got, projectTask.ID)
	}
}

func TestTaskUpdateClearsNullableFieldsAndRejectsBadInput(t *testing.T) {
	router := newTestRouter()

	createProjectResponse := performRequest(router, http.MethodPost, "/projects", `{"name":"Home"}`)
	if createProjectResponse.Code != http.StatusCreated {
		t.Fatalf("create project status = %d, want %d", createProjectResponse.Code, http.StatusCreated)
	}
	project := decodeData[projectResponse](t, createProjectResponse)

	createTaskResponse := performRequest(
		router,
		http.MethodPost,
		"/tasks",
		fmt.Sprintf(`{"title":"Plan","project_id":%d,"notes":" Notes ","due_date":"2026-04-24"}`, project.ID),
	)
	if createTaskResponse.Code != http.StatusCreated {
		t.Fatalf("create task status = %d, want %d", createTaskResponse.Code, http.StatusCreated)
	}
	task := decodeData[taskResponse](t, createTaskResponse)

	clearResponse := performRequest(router, http.MethodPatch, fmt.Sprintf("/tasks/%d", task.ID), `{"project_id":null,"notes":null,"due_date":null,"due_time":null}`)
	if clearResponse.Code != http.StatusOK {
		t.Fatalf("clear task status = %d, want %d; body=%s", clearResponse.Code, http.StatusOK, clearResponse.Body.String())
	}
	cleared := decodeData[taskResponse](t, clearResponse)
	if cleared.ProjectID != nil {
		t.Fatalf("ProjectID = %v, want nil", cleared.ProjectID)
	}
	if cleared.Notes != nil {
		t.Fatalf("Notes = %v, want nil", cleared.Notes)
	}
	if cleared.DueDate != nil {
		t.Fatalf("DueDate = %v, want nil", cleared.DueDate)
	}

	invalidRequests := map[string]string{
		"bad json":           `{"title":`,
		"invalid priority":   `{"priority":1}`,
		"invalid due date":   `{"due_date":"24-04-2026"}`,
		"invalid due time":   `{"due_date":"2026-04-24","due_time":"9am"}`,
		"invalid repeat":     `{"repeat_frequency":"daily","repeat_interval":0}`,
		"invalid status":     `{"status":"blocked"}`,
		"invalid project id": `{"project_id":0}`,
	}
	for label, body := range invalidRequests {
		response := performRequest(router, http.MethodPatch, fmt.Sprintf("/tasks/%d", task.ID), body)
		if response.Code != http.StatusBadRequest {
			t.Fatalf("%s status = %d, want %d; body=%s", label, response.Code, http.StatusBadRequest, response.Body.String())
		}
	}
}

func TestTaskDeleteStatusCodes(t *testing.T) {
	router := newTestRouter()

	createResponse := performRequest(router, http.MethodPost, "/tasks", `{"title":"Delete me"}`)
	if createResponse.Code != http.StatusCreated {
		t.Fatalf("create task status = %d, want %d", createResponse.Code, http.StatusCreated)
	}
	task := decodeData[taskResponse](t, createResponse)

	deleteResponse := performRequest(router, http.MethodDelete, fmt.Sprintf("/tasks/%d", task.ID), "")
	if deleteResponse.Code != http.StatusNoContent {
		t.Fatalf("delete status = %d, want %d", deleteResponse.Code, http.StatusNoContent)
	}

	notFoundResponse := performRequest(router, http.MethodDelete, "/tasks/99", "")
	if notFoundResponse.Code != http.StatusNotFound {
		t.Fatalf("delete missing status = %d, want %d", notFoundResponse.Code, http.StatusNotFound)
	}
}

func TestProjectCRUDAndDeleteConflict(t *testing.T) {
	router := newTestRouter()

	createProjectResponse := httptest.NewRecorder()
	router.ServeHTTP(createProjectResponse, httptest.NewRequest(http.MethodPost, "/projects", bytes.NewBufferString(`{"name":"Home","start_date":"2026-04-01","end_date":"2026-04-30"}`)))
	if createProjectResponse.Code != http.StatusCreated {
		t.Fatalf("create project status = %d, want %d", createProjectResponse.Code, http.StatusCreated)
	}

	var createdProject struct {
		Data projectResponse `json:"data"`
	}
	if err := json.NewDecoder(createProjectResponse.Body).Decode(&createdProject); err != nil {
		t.Fatalf("decode project response: %v", err)
	}
	if createdProject.Data.StartDate == nil || *createdProject.Data.StartDate != "2026-04-01" || createdProject.Data.EndDate == nil || *createdProject.Data.EndDate != "2026-04-30" {
		t.Fatalf("project period = %+v, want start and end dates", createdProject.Data)
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

func performRequest(router http.Handler, method string, target string, body string) *httptest.ResponseRecorder {
	response := httptest.NewRecorder()
	var requestBody *bytes.Buffer
	if body == "" {
		requestBody = bytes.NewBuffer(nil)
	} else {
		requestBody = bytes.NewBufferString(body)
	}
	router.ServeHTTP(response, httptest.NewRequest(method, target, requestBody))
	return response
}

func decodeData[T any](t *testing.T, response *httptest.ResponseRecorder) T {
	t.Helper()

	var envelope struct {
		Data T `json:"data"`
	}
	if err := json.NewDecoder(response.Body).Decode(&envelope); err != nil {
		t.Fatalf("decode data response: %v", err)
	}
	return envelope.Data
}

func responseTaskIDs(tasks []taskResponse) []int64 {
	ids := make([]int64, 0, len(tasks))
	for _, task := range tasks {
		ids = append(ids, task.ID)
	}
	return ids
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
