package domain

import (
	"strings"
	"time"
)

type TaskStatus string

const (
	TaskStatusTodo       TaskStatus = "todo"
	TaskStatusInProgress TaskStatus = "in_progress"
	TaskStatusDone       TaskStatus = "done"
)

func (status TaskStatus) Valid() bool {
	switch status {
	case TaskStatusTodo, TaskStatusInProgress, TaskStatusDone:
		return true
	default:
		return false
	}
}

type Task struct {
	ID          int64
	ProjectID   *int64
	Title       string
	Notes       *string
	Status      TaskStatus
	DueDate     *time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
	CompletedAt *time.Time
}

type NewTaskInput struct {
	ProjectID *int64
	Title     string
	Notes     *string
	Status    TaskStatus
	DueDate   *time.Time
}

func NewTask(input NewTaskInput, now time.Time) (Task, error) {
	title, err := NormalizeRequiredText(input.Title, ErrInvalidTaskTitle)
	if err != nil {
		return Task{}, err
	}

	status := input.Status
	if status == "" {
		status = TaskStatusTodo
	}
	if !status.Valid() {
		return Task{}, ErrInvalidTaskStatus
	}

	task := Task{
		ProjectID: input.ProjectID,
		Title:     title,
		Notes:     NormalizeOptionalText(input.Notes),
		Status:    TaskStatusTodo,
		DueDate:   NormalizeDate(input.DueDate),
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := task.ApplyStatus(status, now); err != nil {
		return Task{}, err
	}

	return task, nil
}

func (task *Task) Rename(title string, now time.Time) error {
	title, err := NormalizeRequiredText(title, ErrInvalidTaskTitle)
	if err != nil {
		return err
	}

	task.Title = title
	task.UpdatedAt = now
	return nil
}

func (task *Task) SetNotes(notes *string, now time.Time) {
	task.Notes = NormalizeOptionalText(notes)
	task.UpdatedAt = now
}

func (task *Task) SetProject(projectID *int64, now time.Time) {
	task.ProjectID = projectID
	task.UpdatedAt = now
}

func (task *Task) SetDueDate(dueDate *time.Time, now time.Time) {
	task.DueDate = NormalizeDate(dueDate)
	task.UpdatedAt = now
}

func (task *Task) ApplyStatus(status TaskStatus, now time.Time) error {
	if !status.Valid() {
		return ErrInvalidTaskStatus
	}

	task.Status = status
	if status == TaskStatusDone {
		if task.CompletedAt == nil {
			completedAt := now
			task.CompletedAt = &completedAt
		}
	} else {
		task.CompletedAt = nil
	}
	task.UpdatedAt = now
	return nil
}

func NormalizeRequiredText(value string, err error) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", err
	}
	return value, nil
}

func NormalizeOptionalText(value *string) *string {
	if value == nil {
		return nil
	}

	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func NormalizeDate(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}

	year, month, day := value.Date()
	normalized := time.Date(year, month, day, 0, 0, 0, 0, value.Location())
	return &normalized
}
