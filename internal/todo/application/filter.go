package application

import (
	"time"

	"github.com/anton415/anton415-os/internal/todo/domain"
)

type TaskView string

const (
	TaskViewInbox    TaskView = "inbox"
	TaskViewToday    TaskView = "today"
	TaskViewUpcoming TaskView = "upcoming"
)

func (view TaskView) Valid() bool {
	switch view {
	case "", TaskViewInbox, TaskViewToday, TaskViewUpcoming:
		return true
	default:
		return false
	}
}

type ListTasksInput struct {
	View      TaskView
	Status    *domain.TaskStatus
	ProjectID *int64
}

type TaskListFilter struct {
	View      TaskView
	Status    *domain.TaskStatus
	ProjectID *int64
	Today     time.Time
}

func ApplyTaskFilter(tasks []domain.Task, filter TaskListFilter) []domain.Task {
	filtered := make([]domain.Task, 0, len(tasks))
	for _, task := range tasks {
		if !taskMatchesFilter(task, filter) {
			continue
		}
		filtered = append(filtered, task)
	}
	return filtered
}

func taskMatchesFilter(task domain.Task, filter TaskListFilter) bool {
	switch filter.View {
	case TaskViewInbox:
		if task.ProjectID != nil || task.Status == domain.TaskStatusDone {
			return false
		}
	case TaskViewToday:
		if task.DueDate == nil || task.Status == domain.TaskStatusDone || !sameDate(*task.DueDate, filter.Today) {
			return false
		}
	case TaskViewUpcoming:
		if task.DueDate == nil || task.Status == domain.TaskStatusDone || !dateOnly(*task.DueDate).After(dateOnly(filter.Today)) {
			return false
		}
	}

	if filter.Status != nil && task.Status != *filter.Status {
		return false
	}
	if filter.ProjectID != nil && (task.ProjectID == nil || *task.ProjectID != *filter.ProjectID) {
		return false
	}

	return true
}

func sameDate(left, right time.Time) bool {
	leftYear, leftMonth, leftDay := left.Date()
	rightYear, rightMonth, rightDay := right.Date()
	return leftYear == rightYear && leftMonth == rightMonth && leftDay == rightDay
}

func dateOnly(value time.Time) time.Time {
	year, month, day := value.Date()
	return time.Date(year, month, day, 0, 0, 0, 0, value.Location())
}
