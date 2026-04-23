package todohttp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/anton415/anton415-os/internal/todo/application"
	"github.com/anton415/anton415-os/internal/todo/domain"
)

type Service interface {
	ListProjects(ctx context.Context) ([]domain.Project, error)
	CreateProject(ctx context.Context, input application.CreateProjectInput) (domain.Project, error)
	UpdateProject(ctx context.Context, id int64, input application.UpdateProjectInput) (domain.Project, error)
	DeleteProject(ctx context.Context, id int64) error
	ListTasks(ctx context.Context, input application.ListTasksInput) ([]domain.Task, error)
	CreateTask(ctx context.Context, input application.CreateTaskInput) (domain.Task, error)
	UpdateTask(ctx context.Context, id int64, input application.UpdateTaskInput) (domain.Task, error)
	DeleteTask(ctx context.Context, id int64) error
}

type Handler struct {
	service Service
}

func NewRouter(service Service) http.Handler {
	handler := Handler{service: service}
	r := chi.NewRouter()

	r.Get("/projects", handler.listProjects)
	r.Post("/projects", handler.createProject)
	r.Patch("/projects/{id}", handler.updateProject)
	r.Delete("/projects/{id}", handler.deleteProject)

	r.Get("/tasks", handler.listTasks)
	r.Post("/tasks", handler.createTask)
	r.Patch("/tasks/{id}", handler.updateTask)
	r.Delete("/tasks/{id}", handler.deleteTask)

	return r
}

func (handler Handler) listProjects(w http.ResponseWriter, r *http.Request) {
	projects, err := handler.service.ListProjects(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}

	response := make([]projectResponse, 0, len(projects))
	for _, project := range projects {
		response = append(response, projectDTO(project))
	}
	writeData(w, http.StatusOK, response)
}

func (handler Handler) createProject(w http.ResponseWriter, r *http.Request) {
	var request projectRequest
	if !decodeRequest(w, r, &request) {
		return
	}

	project, err := handler.service.CreateProject(r.Context(), application.CreateProjectInput{Name: request.Name})
	if err != nil {
		writeError(w, err)
		return
	}

	writeData(w, http.StatusCreated, projectDTO(project))
}

func (handler Handler) updateProject(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}

	var request projectRequest
	if !decodeRequest(w, r, &request) {
		return
	}

	project, err := handler.service.UpdateProject(r.Context(), id, application.UpdateProjectInput{Name: request.Name})
	if err != nil {
		writeError(w, err)
		return
	}

	writeData(w, http.StatusOK, projectDTO(project))
}

func (handler Handler) deleteProject(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}

	if err := handler.service.DeleteProject(r.Context(), id); err != nil {
		writeError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (handler Handler) listTasks(w http.ResponseWriter, r *http.Request) {
	input, err := listTasksInput(r)
	if err != nil {
		writeError(w, err)
		return
	}

	tasks, err := handler.service.ListTasks(r.Context(), input)
	if err != nil {
		writeError(w, err)
		return
	}

	response := make([]taskResponse, 0, len(tasks))
	for _, task := range tasks {
		response = append(response, taskDTO(task))
	}
	writeData(w, http.StatusOK, response)
}

func (handler Handler) createTask(w http.ResponseWriter, r *http.Request) {
	var request createTaskRequest
	if !decodeRequest(w, r, &request) {
		return
	}

	dueDate, err := parseOptionalDate(request.DueDate)
	if err != nil {
		writeError(w, err)
		return
	}

	task, err := handler.service.CreateTask(r.Context(), application.CreateTaskInput{
		ProjectID: request.ProjectID,
		Title:     request.Title,
		Notes:     request.Notes,
		Status:    domain.TaskStatus(request.Status),
		DueDate:   dueDate,
	})
	if err != nil {
		writeError(w, err)
		return
	}

	writeData(w, http.StatusCreated, taskDTO(task))
}

func (handler Handler) updateTask(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}

	var raw map[string]json.RawMessage
	if !decodeRequest(w, r, &raw) {
		return
	}

	input, err := updateTaskInput(raw)
	if err != nil {
		writeError(w, err)
		return
	}

	task, err := handler.service.UpdateTask(r.Context(), id, input)
	if err != nil {
		writeError(w, err)
		return
	}

	writeData(w, http.StatusOK, taskDTO(task))
}

func (handler Handler) deleteTask(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}

	if err := handler.service.DeleteTask(r.Context(), id); err != nil {
		writeError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type projectRequest struct {
	Name string `json:"name"`
}

type createTaskRequest struct {
	ProjectID *int64  `json:"project_id"`
	Title     string  `json:"title"`
	Notes     *string `json:"notes"`
	Status    string  `json:"status"`
	DueDate   *string `json:"due_date"`
}

type responseEnvelope struct {
	Data any `json:"data"`
}

type errorEnvelope struct {
	Error apiError `json:"error"`
}

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type projectResponse struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type taskResponse struct {
	ID          int64   `json:"id"`
	ProjectID   *int64  `json:"project_id"`
	Title       string  `json:"title"`
	Notes       *string `json:"notes"`
	Status      string  `json:"status"`
	DueDate     *string `json:"due_date"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
	CompletedAt *string `json:"completed_at"`
}

func listTasksInput(r *http.Request) (application.ListTasksInput, error) {
	query := r.URL.Query()
	input := application.ListTasksInput{
		View: application.TaskView(query.Get("view")),
	}

	if statusValue := strings.TrimSpace(query.Get("status")); statusValue != "" {
		status := domain.TaskStatus(statusValue)
		input.Status = &status
	}

	if projectIDValue := strings.TrimSpace(query.Get("project_id")); projectIDValue != "" {
		projectID, err := strconv.ParseInt(projectIDValue, 10, 64)
		if err != nil || projectID <= 0 {
			return application.ListTasksInput{}, application.ErrInvalidFilter
		}
		input.ProjectID = &projectID
	}

	return input, nil
}

func updateTaskInput(raw map[string]json.RawMessage) (application.UpdateTaskInput, error) {
	if field, ok := unknownField(raw, "project_id", "title", "notes", "status", "due_date"); ok {
		return application.UpdateTaskInput{}, fmt.Errorf("%w: unknown field %q", application.ErrInvalidFilter, field)
	}

	var input application.UpdateTaskInput
	if value, ok := raw["project_id"]; ok {
		projectID, err := nullableInt64(value)
		if err != nil {
			return application.UpdateTaskInput{}, err
		}
		input.ProjectID = application.OptionalInt64{Set: true, Value: projectID}
	}
	if value, ok := raw["title"]; ok {
		title, err := nullableString(value)
		if err != nil {
			return application.UpdateTaskInput{}, err
		}
		input.Title = application.OptionalString{Set: true, Value: title}
	}
	if value, ok := raw["notes"]; ok {
		notes, err := nullableString(value)
		if err != nil {
			return application.UpdateTaskInput{}, err
		}
		input.Notes = application.OptionalString{Set: true, Value: notes}
	}
	if value, ok := raw["status"]; ok {
		status, err := requiredString(value)
		if err != nil {
			return application.UpdateTaskInput{}, err
		}
		input.Status = application.OptionalTaskStatus{Set: true, Value: domain.TaskStatus(status)}
	}
	if value, ok := raw["due_date"]; ok {
		dueDateValue, err := nullableString(value)
		if err != nil {
			return application.UpdateTaskInput{}, err
		}
		dueDate, err := parseOptionalDate(dueDateValue)
		if err != nil {
			return application.UpdateTaskInput{}, err
		}
		input.DueDate = application.OptionalDate{Set: true, Value: dueDate}
	}

	return input, nil
}

func decodeRequest(w http.ResponseWriter, r *http.Request, value any) bool {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		writeErrorResponse(w, http.StatusBadRequest, "bad_request", "request body must be valid JSON")
		return false
	}
	return true
}

func pathID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		writeErrorResponse(w, http.StatusBadRequest, "bad_request", "id must be a positive integer")
		return 0, false
	}
	return id, true
}

func projectDTO(project domain.Project) projectResponse {
	return projectResponse{
		ID:        project.ID,
		Name:      project.Name,
		CreatedAt: formatTimestamp(project.CreatedAt),
		UpdatedAt: formatTimestamp(project.UpdatedAt),
	}
}

func taskDTO(task domain.Task) taskResponse {
	return taskResponse{
		ID:          task.ID,
		ProjectID:   task.ProjectID,
		Title:       task.Title,
		Notes:       task.Notes,
		Status:      string(task.Status),
		DueDate:     formatDatePtr(task.DueDate),
		CreatedAt:   formatTimestamp(task.CreatedAt),
		UpdatedAt:   formatTimestamp(task.UpdatedAt),
		CompletedAt: formatTimestampPtr(task.CompletedAt),
	}
}

func writeData(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(responseEnvelope{Data: data}); err != nil {
		slog.Error("write todo json response", slog.String("error", err.Error()))
	}
}

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrInvalidProjectName):
		writeErrorResponse(w, http.StatusBadRequest, "validation_error", "project name is required")
	case errors.Is(err, domain.ErrInvalidTaskTitle):
		writeErrorResponse(w, http.StatusBadRequest, "validation_error", "task title is required")
	case errors.Is(err, domain.ErrInvalidTaskStatus):
		writeErrorResponse(w, http.StatusBadRequest, "validation_error", "task status must be todo, in_progress, or done")
	case errors.Is(err, application.ErrInvalidFilter):
		writeErrorResponse(w, http.StatusBadRequest, "validation_error", "todo filter is invalid")
	case errors.Is(err, application.ErrNotFound):
		writeErrorResponse(w, http.StatusNotFound, "not_found", "todo resource was not found")
	case errors.Is(err, application.ErrProjectHasTasks):
		writeErrorResponse(w, http.StatusConflict, "project_has_tasks", "delete or move the project's tasks before deleting the project")
	default:
		slog.Error("todo handler error", slog.String("error", err.Error()))
		writeErrorResponse(w, http.StatusInternalServerError, "internal_error", "internal server error")
	}
}

func writeErrorResponse(w http.ResponseWriter, status int, code string, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(errorEnvelope{Error: apiError{Code: code, Message: message}}); err != nil {
		slog.Error("write todo error response", slog.String("error", err.Error()))
	}
}

func parseOptionalDate(value *string) (*time.Time, error) {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil, nil
	}

	parsed, err := time.ParseInLocation(time.DateOnly, strings.TrimSpace(*value), time.Local)
	if err != nil {
		return nil, fmt.Errorf("%w: due_date must use YYYY-MM-DD", application.ErrInvalidFilter)
	}
	return domain.NormalizeDate(&parsed), nil
}

func nullableInt64(raw json.RawMessage) (*int64, error) {
	if isJSONNull(raw) {
		return nil, nil
	}

	var value int64
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, fmt.Errorf("%w: project_id must be an integer or null", application.ErrInvalidFilter)
	}
	if value <= 0 {
		return nil, fmt.Errorf("%w: project_id must be positive", application.ErrInvalidFilter)
	}
	return &value, nil
}

func nullableString(raw json.RawMessage) (*string, error) {
	if isJSONNull(raw) {
		return nil, nil
	}

	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, fmt.Errorf("%w: value must be a string or null", application.ErrInvalidFilter)
	}
	return &value, nil
}

func requiredString(raw json.RawMessage) (string, error) {
	value, err := nullableString(raw)
	if err != nil {
		return "", err
	}
	if value == nil {
		return "", fmt.Errorf("%w: value must be a string", application.ErrInvalidFilter)
	}
	return *value, nil
}

func unknownField(raw map[string]json.RawMessage, allowed ...string) (string, bool) {
	allowedFields := map[string]bool{}
	for _, field := range allowed {
		allowedFields[field] = true
	}
	for field := range raw {
		if !allowedFields[field] {
			return field, true
		}
	}
	return "", false
}

func isJSONNull(raw json.RawMessage) bool {
	return strings.EqualFold(strings.TrimSpace(string(raw)), "null")
}

func formatTimestamp(value time.Time) string {
	return value.UTC().Format(time.RFC3339)
}

func formatTimestampPtr(value *time.Time) *string {
	if value == nil {
		return nil
	}
	formatted := formatTimestamp(*value)
	return &formatted
}

func formatDatePtr(value *time.Time) *string {
	if value == nil {
		return nil
	}
	formatted := value.Format(time.DateOnly)
	return &formatted
}
