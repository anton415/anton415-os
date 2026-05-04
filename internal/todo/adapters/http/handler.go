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

	"github.com/anton415/anton415-hub/internal/platform/httpjson"
	"github.com/anton415/anton415-hub/internal/todo/application"
	"github.com/anton415/anton415-hub/internal/todo/domain"
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

	startDate, endDate, err := projectDates(request.StartDate, request.EndDate)
	if err != nil {
		writeError(w, err)
		return
	}

	project, err := handler.service.CreateProject(r.Context(), application.CreateProjectInput{
		Name:      request.Name,
		StartDate: startDate,
		EndDate:   endDate,
	})
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

	startDate, endDate, err := projectDates(request.StartDate, request.EndDate)
	if err != nil {
		writeError(w, err)
		return
	}

	project, err := handler.service.UpdateProject(r.Context(), id, application.UpdateProjectInput{
		Name:      request.Name,
		StartDate: startDate,
		EndDate:   endDate,
	})
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
	repeatUntil, err := parseOptionalDate(request.RepeatUntil)
	if err != nil {
		writeError(w, err)
		return
	}

	task, err := handler.service.CreateTask(r.Context(), application.CreateTaskInput{
		ProjectID:       request.ProjectID,
		Title:           request.Title,
		Notes:           request.Notes,
		URL:             request.URL,
		Status:          domain.TaskStatus(request.Status),
		DueDate:         dueDate,
		DueTime:         request.DueTime,
		RepeatFrequency: domain.RepeatFrequency(request.RepeatFrequency),
		RepeatInterval:  intValue(request.RepeatInterval),
		RepeatUntil:     repeatUntil,
		Flagged:         request.Flagged,
		Priority:        domain.TaskPriority(request.Priority),
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
	Name      string  `json:"name"`
	StartDate *string `json:"start_date"`
	EndDate   *string `json:"end_date"`
}

type createTaskRequest struct {
	ProjectID       *int64  `json:"project_id"`
	Title           string  `json:"title"`
	Notes           *string `json:"notes"`
	URL             *string `json:"url"`
	Status          string  `json:"status"`
	DueDate         *string `json:"due_date"`
	DueTime         *string `json:"due_time"`
	RepeatFrequency string  `json:"repeat_frequency"`
	RepeatInterval  *int    `json:"repeat_interval"`
	RepeatUntil     *string `json:"repeat_until"`
	Flagged         bool    `json:"flagged"`
	Priority        string  `json:"priority"`
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
	ID        int64   `json:"id"`
	Name      string  `json:"name"`
	StartDate *string `json:"start_date"`
	EndDate   *string `json:"end_date"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
}

type taskResponse struct {
	ID              int64   `json:"id"`
	ProjectID       *int64  `json:"project_id"`
	Title           string  `json:"title"`
	Notes           *string `json:"notes"`
	URL             *string `json:"url"`
	Status          string  `json:"status"`
	DueDate         *string `json:"due_date"`
	DueTime         *string `json:"due_time"`
	RepeatFrequency string  `json:"repeat_frequency"`
	RepeatInterval  int     `json:"repeat_interval"`
	RepeatUntil     *string `json:"repeat_until"`
	Flagged         bool    `json:"flagged"`
	Priority        string  `json:"priority"`
	CreatedAt       string  `json:"created_at"`
	UpdatedAt       string  `json:"updated_at"`
	CompletedAt     *string `json:"completed_at"`
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
	if sortValue := strings.TrimSpace(query.Get("sort")); sortValue != "" {
		input.Sort = application.TaskSort(sortValue)
	}
	if directionValue := strings.TrimSpace(query.Get("direction")); directionValue != "" {
		input.Direction = application.SortDirection(directionValue)
	}
	input.Query = strings.TrimSpace(query.Get("q"))

	return input, nil
}

func updateTaskInput(raw map[string]json.RawMessage) (application.UpdateTaskInput, error) {
	if field, ok := unknownField(raw, "project_id", "title", "notes", "url", "status", "due_date", "due_time", "repeat_frequency", "repeat_interval", "repeat_until", "flagged", "priority"); ok {
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
	if value, ok := raw["url"]; ok {
		taskURL, err := nullableString(value)
		if err != nil {
			return application.UpdateTaskInput{}, err
		}
		input.URL = application.OptionalString{Set: true, Value: taskURL}
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
	if value, ok := raw["due_time"]; ok {
		dueTime, err := nullableString(value)
		if err != nil {
			return application.UpdateTaskInput{}, err
		}
		input.DueTime = application.OptionalString{Set: true, Value: dueTime}
	}
	if value, ok := raw["repeat_frequency"]; ok {
		repeatFrequency, err := requiredString(value)
		if err != nil {
			return application.UpdateTaskInput{}, err
		}
		input.RepeatFrequency = application.OptionalRepeatFrequency{Set: true, Value: domain.RepeatFrequency(repeatFrequency)}
	}
	if value, ok := raw["repeat_interval"]; ok {
		repeatInterval, err := requiredPositiveInt(value, "repeat_interval")
		if err != nil {
			return application.UpdateTaskInput{}, err
		}
		input.RepeatInterval = application.OptionalInt{Set: true, Value: repeatInterval}
	}
	if value, ok := raw["repeat_until"]; ok {
		repeatUntilValue, err := nullableString(value)
		if err != nil {
			return application.UpdateTaskInput{}, err
		}
		repeatUntil, err := parseOptionalDate(repeatUntilValue)
		if err != nil {
			return application.UpdateTaskInput{}, err
		}
		input.RepeatUntil = application.OptionalDate{Set: true, Value: repeatUntil}
	}
	if value, ok := raw["flagged"]; ok {
		flagged, err := requiredBool(value)
		if err != nil {
			return application.UpdateTaskInput{}, err
		}
		input.Flagged = application.OptionalBool{Set: true, Value: flagged}
	}
	if value, ok := raw["priority"]; ok {
		priority, err := requiredString(value)
		if err != nil {
			return application.UpdateTaskInput{}, err
		}
		input.Priority = application.OptionalTaskPriority{Set: true, Value: domain.TaskPriority(priority)}
	}

	return input, nil
}

func decodeRequest(w http.ResponseWriter, r *http.Request, value any) bool {
	if err := httpjson.DecodeRequest(w, r, value); err != nil {
		if errors.Is(err, httpjson.ErrRequestBodyTooLarge) {
			writeErrorResponse(w, http.StatusRequestEntityTooLarge, "payload_too_large", "request body is too large")
			return false
		}
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
		StartDate: formatDatePtr(project.StartDate),
		EndDate:   formatDatePtr(project.EndDate),
		CreatedAt: formatTimestamp(project.CreatedAt),
		UpdatedAt: formatTimestamp(project.UpdatedAt),
	}
}

func taskDTO(task domain.Task) taskResponse {
	return taskResponse{
		ID:              task.ID,
		ProjectID:       task.ProjectID,
		Title:           task.Title,
		Notes:           task.Notes,
		URL:             task.URL,
		Status:          string(task.Status),
		DueDate:         formatDatePtr(task.DueDate),
		DueTime:         task.DueTime,
		RepeatFrequency: string(task.RepeatFrequency),
		RepeatInterval:  task.RepeatInterval,
		RepeatUntil:     formatDatePtr(task.RepeatUntil),
		Flagged:         task.Flagged,
		Priority:        string(task.Priority),
		CreatedAt:       formatTimestamp(task.CreatedAt),
		UpdatedAt:       formatTimestamp(task.UpdatedAt),
		CompletedAt:     formatTimestampPtr(task.CompletedAt),
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
	case errors.Is(err, domain.ErrInvalidProjectPeriod):
		writeErrorResponse(w, http.StatusBadRequest, "validation_error", "project start date must be before end date")
	case errors.Is(err, domain.ErrInvalidTaskTitle):
		writeErrorResponse(w, http.StatusBadRequest, "validation_error", "task title is required")
	case errors.Is(err, domain.ErrInvalidTaskStatus):
		writeErrorResponse(w, http.StatusBadRequest, "validation_error", "task status must be todo, in_progress, or done")
	case errors.Is(err, domain.ErrInvalidTaskSchedule):
		writeErrorResponse(w, http.StatusBadRequest, "validation_error", "task schedule is invalid")
	case errors.Is(err, domain.ErrInvalidTaskRepeat):
		writeErrorResponse(w, http.StatusBadRequest, "validation_error", "task repeat is invalid")
	case errors.Is(err, domain.ErrInvalidTaskPriority):
		writeErrorResponse(w, http.StatusBadRequest, "validation_error", "task priority must be none, low, medium, or high")
	case errors.Is(err, domain.ErrInvalidTaskURL):
		writeErrorResponse(w, http.StatusBadRequest, "validation_error", "task url must be an http or https URL")
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

func projectDates(startDateValue *string, endDateValue *string) (*time.Time, *time.Time, error) {
	startDate, err := parseOptionalDate(startDateValue)
	if err != nil {
		return nil, nil, err
	}
	endDate, err := parseOptionalDate(endDateValue)
	if err != nil {
		return nil, nil, err
	}
	return startDate, endDate, nil
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

func requiredPositiveInt(raw json.RawMessage, field string) (int, error) {
	var value int
	if err := json.Unmarshal(raw, &value); err != nil {
		return 0, fmt.Errorf("%w: %s must be an integer", application.ErrInvalidFilter, field)
	}
	if value <= 0 {
		return 0, fmt.Errorf("%w: %s must be positive", application.ErrInvalidFilter, field)
	}
	return value, nil
}

func requiredBool(raw json.RawMessage) (bool, error) {
	var value bool
	if err := json.Unmarshal(raw, &value); err != nil {
		return false, fmt.Errorf("%w: value must be a boolean", application.ErrInvalidFilter)
	}
	return value, nil
}

func intValue(value *int) int {
	if value == nil {
		return 0
	}
	return *value
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
