package application

import (
	"cmp"
	"slices"
	"strings"
	"time"

	"github.com/anton415/anton415-hub/internal/todo/domain"
)

type TaskView string

const (
	TaskViewInbox     TaskView = "inbox"
	TaskViewToday     TaskView = "today"
	TaskViewUpcoming  TaskView = "upcoming"
	TaskViewOverdue   TaskView = "overdue"
	TaskViewScheduled TaskView = "scheduled"
	TaskViewFlagged   TaskView = "flagged"
)

func (view TaskView) Valid() bool {
	switch view {
	case "", TaskViewInbox, TaskViewToday, TaskViewUpcoming, TaskViewOverdue, TaskViewScheduled, TaskViewFlagged:
		return true
	default:
		return false
	}
}

type TaskSort string

const (
	TaskSortSmart    TaskSort = "smart"
	TaskSortDue      TaskSort = "due"
	TaskSortCreated  TaskSort = "created"
	TaskSortTitle    TaskSort = "title"
	TaskSortPriority TaskSort = "priority"
)

func (sort TaskSort) Valid() bool {
	switch sort {
	case "", TaskSortSmart, TaskSortDue, TaskSortCreated, TaskSortTitle, TaskSortPriority:
		return true
	default:
		return false
	}
}

type SortDirection string

const (
	SortDirectionAsc  SortDirection = "asc"
	SortDirectionDesc SortDirection = "desc"
)

func (direction SortDirection) Valid() bool {
	switch direction {
	case "", SortDirectionAsc, SortDirectionDesc:
		return true
	default:
		return false
	}
}

type ListTasksInput struct {
	View      TaskView
	Status    *domain.TaskStatus
	ProjectID *int64
	Sort      TaskSort
	Direction SortDirection
	Query     string
}

type TaskListFilter struct {
	View      TaskView
	Status    *domain.TaskStatus
	ProjectID *int64
	Sort      TaskSort
	Direction SortDirection
	Query     string
	Today     time.Time
	Now       time.Time
}

func ApplyTaskFilter(tasks []domain.Task, filter TaskListFilter) []domain.Task {
	filtered := make([]domain.Task, 0, len(tasks))
	for _, task := range tasks {
		if !taskMatchesFilter(task, filter) {
			continue
		}
		filtered = append(filtered, task)
	}
	sortTasks(filtered, filter)
	return filtered
}

func taskMatchesFilter(task domain.Task, filter TaskListFilter) bool {
	switch filter.View {
	case TaskViewInbox:
		if task.ProjectID != nil || task.Status == domain.TaskStatusDone {
			return false
		}
	case TaskViewToday:
		if task.DueDate == nil || task.Status == domain.TaskStatusDone || dateOnly(*task.DueDate).After(dateOnly(filter.Today)) {
			return false
		}
	case TaskViewUpcoming:
		if task.DueDate == nil || task.Status == domain.TaskStatusDone || !dateOnly(*task.DueDate).After(dateOnly(filter.Today)) {
			return false
		}
	case TaskViewOverdue:
		if task.Status == domain.TaskStatusDone || !taskOverdue(task, filter) {
			return false
		}
	case TaskViewScheduled:
		if task.DueDate == nil || task.Status == domain.TaskStatusDone {
			return false
		}
	case TaskViewFlagged:
		if !task.Flagged || task.Status == domain.TaskStatusDone {
			return false
		}
	}

	if filter.Status != nil && task.Status != *filter.Status {
		return false
	}
	if filter.ProjectID != nil && (task.ProjectID == nil || *task.ProjectID != *filter.ProjectID) {
		return false
	}
	query := strings.TrimSpace(strings.ToLower(filter.Query))
	if query != "" {
		title := strings.ToLower(task.Title)
		notes := ""
		if task.Notes != nil {
			notes = strings.ToLower(*task.Notes)
		}
		if !strings.Contains(title, query) && !strings.Contains(notes, query) {
			return false
		}
	}

	return true
}

func taskOverdue(task domain.Task, filter TaskListFilter) bool {
	if task.DueDate == nil {
		return false
	}
	dueDate := dateOnly(*task.DueDate)
	today := dateOnly(filter.Today)
	if dueDate.Before(today) {
		return true
	}
	if dueDate.After(today) || task.DueTime == nil {
		return false
	}
	return *task.DueTime < filter.Now.In(filter.Now.Location()).Format("15:04")
}

func dateOnly(value time.Time) time.Time {
	year, month, day := value.Date()
	return time.Date(year, month, day, 0, 0, 0, 0, value.Location())
}

func sortTasks(tasks []domain.Task, filter TaskListFilter) {
	sortMode := filter.Sort
	if sortMode == "" {
		sortMode = TaskSortSmart
	}
	direction := filter.Direction
	if direction == "" {
		direction = SortDirectionAsc
	}

	slices.SortStableFunc(tasks, func(left, right domain.Task) int {
		result := compareTasks(left, right, sortMode)
		if direction == SortDirectionDesc && sortMode != TaskSortSmart {
			result = -result
		}
		if result != 0 {
			return result
		}
		return cmp.Compare(left.ID, right.ID)
	})
}

func compareTasks(left, right domain.Task, sortMode TaskSort) int {
	switch sortMode {
	case TaskSortDue:
		return compareDue(left, right)
	case TaskSortCreated:
		return compareTime(left.CreatedAt, right.CreatedAt)
	case TaskSortTitle:
		return cmp.Compare(strings.ToLower(left.Title), strings.ToLower(right.Title))
	case TaskSortPriority:
		return cmp.Compare(priorityRank(left.Priority), priorityRank(right.Priority))
	default:
		if result := cmp.Compare(doneRank(left.Status), doneRank(right.Status)); result != 0 {
			return result
		}
		if result := compareDue(left, right); result != 0 {
			return result
		}
		if result := cmp.Compare(priorityRank(right.Priority), priorityRank(left.Priority)); result != 0 {
			return result
		}
		if result := cmp.Compare(boolRank(right.Flagged), boolRank(left.Flagged)); result != 0 {
			return result
		}
		return -compareTime(left.CreatedAt, right.CreatedAt)
	}
}

func compareDue(left, right domain.Task) int {
	if result := compareNullableDate(left.DueDate, right.DueDate); result != 0 {
		return result
	}
	return compareNullableString(left.DueTime, right.DueTime)
}

func compareNullableDate(left *time.Time, right *time.Time) int {
	switch {
	case left == nil && right == nil:
		return 0
	case left == nil:
		return 1
	case right == nil:
		return -1
	default:
		return compareTime(*left, *right)
	}
}

func compareNullableString(left *string, right *string) int {
	switch {
	case left == nil && right == nil:
		return 0
	case left == nil:
		return 1
	case right == nil:
		return -1
	default:
		return cmp.Compare(*left, *right)
	}
}

func compareTime(left, right time.Time) int {
	if left.Before(right) {
		return -1
	}
	if left.After(right) {
		return 1
	}
	return 0
}

func doneRank(status domain.TaskStatus) int {
	if status == domain.TaskStatusDone {
		return 1
	}
	return 0
}

func boolRank(value bool) int {
	if value {
		return 1
	}
	return 0
}

func priorityRank(priority domain.TaskPriority) int {
	switch priority {
	case domain.TaskPriorityHigh:
		return 3
	case domain.TaskPriorityMedium:
		return 2
	case domain.TaskPriorityLow:
		return 1
	default:
		return 0
	}
}
