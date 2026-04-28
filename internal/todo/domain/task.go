package domain

import (
	"fmt"
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

type RepeatFrequency string

const (
	RepeatFrequencyNone    RepeatFrequency = "none"
	RepeatFrequencyDaily   RepeatFrequency = "daily"
	RepeatFrequencyWeekly  RepeatFrequency = "weekly"
	RepeatFrequencyMonthly RepeatFrequency = "monthly"
	RepeatFrequencyYearly  RepeatFrequency = "yearly"
)

func (frequency RepeatFrequency) Valid() bool {
	switch frequency {
	case "", RepeatFrequencyNone, RepeatFrequencyDaily, RepeatFrequencyWeekly, RepeatFrequencyMonthly, RepeatFrequencyYearly:
		return true
	default:
		return false
	}
}

func (frequency RepeatFrequency) Active() bool {
	return frequency != "" && frequency != RepeatFrequencyNone
}

type TaskPriority string

const (
	TaskPriorityNone   TaskPriority = "none"
	TaskPriorityLow    TaskPriority = "low"
	TaskPriorityMedium TaskPriority = "medium"
	TaskPriorityHigh   TaskPriority = "high"
)

func (priority TaskPriority) Valid() bool {
	switch priority {
	case "", TaskPriorityNone, TaskPriorityLow, TaskPriorityMedium, TaskPriorityHigh:
		return true
	default:
		return false
	}
}

type Task struct {
	ID              int64
	ProjectID       *int64
	Title           string
	Notes           *string
	Status          TaskStatus
	DueDate         *time.Time
	DueTime         *string
	RepeatFrequency RepeatFrequency
	RepeatInterval  int
	RepeatUntil     *time.Time
	Flagged         bool
	Priority        TaskPriority
	CreatedAt       time.Time
	UpdatedAt       time.Time
	CompletedAt     *time.Time
}

type NewTaskInput struct {
	ProjectID       *int64
	Title           string
	Notes           *string
	Status          TaskStatus
	DueDate         *time.Time
	DueTime         *string
	RepeatFrequency RepeatFrequency
	RepeatInterval  int
	RepeatUntil     *time.Time
	Flagged         bool
	Priority        TaskPriority
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
	priority := input.Priority
	if priority == "" {
		priority = TaskPriorityNone
	}
	if !priority.Valid() {
		return Task{}, ErrInvalidTaskPriority
	}

	dueDate := NormalizeDate(input.DueDate)
	dueTime, err := NormalizeDueTime(input.DueTime)
	if err != nil {
		return Task{}, err
	}
	repeatFrequency := input.RepeatFrequency
	if repeatFrequency == "" {
		repeatFrequency = RepeatFrequencyNone
	}
	repeatInterval := input.RepeatInterval
	if repeatInterval == 0 {
		repeatInterval = 1
	}
	repeatUntil := NormalizeDate(input.RepeatUntil)

	task := Task{
		ProjectID:       input.ProjectID,
		Title:           title,
		Notes:           NormalizeOptionalText(input.Notes),
		Status:          TaskStatusTodo,
		DueDate:         dueDate,
		DueTime:         dueTime,
		RepeatFrequency: repeatFrequency,
		RepeatInterval:  repeatInterval,
		RepeatUntil:     repeatUntil,
		Flagged:         input.Flagged,
		Priority:        priority,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := task.ValidateSchedule(); err != nil {
		return Task{}, err
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

func (task *Task) SetDueTime(dueTime *string, now time.Time) error {
	normalized, err := NormalizeDueTime(dueTime)
	if err != nil {
		return err
	}
	task.DueTime = normalized
	task.UpdatedAt = now
	return nil
}

func (task *Task) SetRepeat(frequency RepeatFrequency, interval int, repeatUntil *time.Time, now time.Time) error {
	if frequency == "" {
		frequency = RepeatFrequencyNone
	}
	if interval == 0 {
		interval = 1
	}
	if !frequency.Valid() {
		return ErrInvalidTaskRepeat
	}
	if interval <= 0 {
		return ErrInvalidTaskRepeat
	}
	task.RepeatFrequency = frequency
	task.RepeatInterval = interval
	task.RepeatUntil = NormalizeDate(repeatUntil)
	if !task.RepeatFrequency.Active() {
		task.RepeatInterval = 1
		task.RepeatUntil = nil
	}
	task.UpdatedAt = now
	return nil
}

func (task *Task) SetFlagged(flagged bool, now time.Time) {
	task.Flagged = flagged
	task.UpdatedAt = now
}

func (task *Task) SetPriority(priority TaskPriority, now time.Time) error {
	if priority == "" {
		priority = TaskPriorityNone
	}
	if !priority.Valid() {
		return ErrInvalidTaskPriority
	}
	task.Priority = priority
	task.UpdatedAt = now
	return nil
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

func (task *Task) CompleteOrAdvanceRepeat(now time.Time) error {
	if !task.RepeatFrequency.Active() {
		return task.ApplyStatus(TaskStatusDone, now)
	}

	nextDate := task.NextRepeatDate()
	if nextDate == nil {
		return task.ApplyStatus(TaskStatusDone, now)
	}

	task.DueDate = nextDate
	task.Status = TaskStatusTodo
	task.CompletedAt = nil
	task.UpdatedAt = now
	return nil
}

func (task Task) NextRepeatDate() *time.Time {
	if !task.RepeatFrequency.Active() || task.DueDate == nil {
		return nil
	}

	interval := task.RepeatInterval
	if interval <= 0 {
		interval = 1
	}

	var next time.Time
	switch task.RepeatFrequency {
	case RepeatFrequencyDaily:
		next = task.DueDate.AddDate(0, 0, interval)
	case RepeatFrequencyWeekly:
		next = task.DueDate.AddDate(0, 0, 7*interval)
	case RepeatFrequencyMonthly:
		next = task.DueDate.AddDate(0, interval, 0)
	case RepeatFrequencyYearly:
		next = task.DueDate.AddDate(interval, 0, 0)
	default:
		return nil
	}

	next = *NormalizeDate(&next)
	if task.RepeatUntil != nil && next.After(*task.RepeatUntil) {
		return nil
	}
	return &next
}

func (task Task) ValidateSchedule() error {
	if task.DueTime != nil && task.DueDate == nil {
		return ErrInvalidTaskSchedule
	}
	if !task.RepeatFrequency.Valid() {
		return ErrInvalidTaskRepeat
	}
	if task.RepeatInterval <= 0 {
		return ErrInvalidTaskRepeat
	}
	if task.RepeatFrequency.Active() {
		if task.DueDate == nil {
			return ErrInvalidTaskRepeat
		}
		if task.RepeatUntil != nil && task.RepeatUntil.Before(*task.DueDate) {
			return ErrInvalidTaskRepeat
		}
	}
	if !task.Priority.Valid() {
		return ErrInvalidTaskPriority
	}
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

func NormalizeDueTime(value *string) (*string, error) {
	if value == nil {
		return nil, nil
	}

	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil, nil
	}

	parsed, err := time.Parse("15:04", trimmed)
	if err != nil {
		return nil, fmt.Errorf("%w: due time must use HH:MM", ErrInvalidTaskSchedule)
	}
	normalized := parsed.Format("15:04")
	return &normalized, nil
}
