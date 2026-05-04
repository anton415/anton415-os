package postgres

import (
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anton415/anton415-hub/internal/todo/application"
	"github.com/anton415/anton415-hub/internal/todo/domain"
)

func TestListTasksQueryAllTasksUsesStableSort(t *testing.T) {
	query, args := listTasksQuery(application.TaskListFilter{})

	if !strings.Contains(query, "(project_id IS NULL OR p.archived = false)") {
		t.Fatalf("query = %q, expected archived project tasks to be hidden", query)
	}
	if !strings.Contains(query, "CASE WHEN status = 'done' THEN 1 ELSE 0 END") {
		t.Fatalf("query = %q, expected done tasks to sort last", query)
	}
	if !strings.Contains(query, "due_date NULLS LAST") {
		t.Fatalf("query = %q, expected due date ordering", query)
	}
	if !strings.Contains(query, "due_time NULLS LAST") {
		t.Fatalf("query = %q, expected due time ordering", query)
	}
	if len(args) != 0 {
		t.Fatalf("args = %v, want none", args)
	}
}

func TestListProjectsQueryDefaultAndArchivedFilters(t *testing.T) {
	activeQuery, activeArgs := listProjectsQuery(application.ProjectListFilter{})
	if !strings.Contains(activeQuery, "archived = false") {
		t.Fatalf("active query = %q, expected active project filter", activeQuery)
	}
	if len(activeArgs) != 0 {
		t.Fatalf("active args = %#v, want none", activeArgs)
	}

	allQuery, allArgs := listProjectsQuery(application.ProjectListFilter{IncludeArchived: true})
	if strings.Contains(allQuery, " WHERE ") {
		t.Fatalf("all query = %q, did not expect archived filter", allQuery)
	}
	if len(allArgs) != 0 {
		t.Fatalf("all args = %#v, want none", allArgs)
	}

	archived := true
	archivedQuery, archivedArgs := listProjectsQuery(application.ProjectListFilter{Archived: &archived})
	if !strings.Contains(archivedQuery, "archived = $1") {
		t.Fatalf("archived query = %q, expected archived parameter filter", archivedQuery)
	}
	if !reflect.DeepEqual(archivedArgs, []any{true}) {
		t.Fatalf("archived args = %#v, want true arg", archivedArgs)
	}
}

func TestListTasksQueryTodayStatusAndProjectFilters(t *testing.T) {
	doneStatus := domain.TaskStatusDone
	projectID := int64(7)
	today := time.Date(2026, 4, 23, 10, 0, 0, 0, time.UTC)

	query, args := listTasksQuery(application.TaskListFilter{
		View:      application.TaskViewToday,
		Status:    &doneStatus,
		ProjectID: &projectID,
		Today:     today,
	})

	for _, expected := range []string{
		"due_date <= $1::date",
		"status <> 'done'",
		"status = $2",
		"project_id = $3",
	} {
		if !strings.Contains(query, expected) {
			t.Fatalf("query = %q, expected %q", query, expected)
		}
	}

	wantArgs := []any{"2026-04-23", domain.TaskStatusDone, int64(7)}
	if !reflect.DeepEqual(args, wantArgs) {
		t.Fatalf("args = %#v, want %#v", args, wantArgs)
	}
}

func TestListTasksQueryOverdueSearchAndSort(t *testing.T) {
	today := time.Date(2026, 4, 23, 10, 0, 0, 0, time.UTC)

	query, args := listTasksQuery(application.TaskListFilter{
		View:      application.TaskViewOverdue,
		Today:     today,
		Now:       today,
		Query:     "milk",
		Sort:      application.TaskSortPriority,
		Direction: application.SortDirectionDesc,
	})

	for _, expected := range []string{
		"due_date < $1::date",
		"due_time IS NOT NULL AND due_time < $2::time",
		"lower(title) LIKE $3",
		"lower(coalesce(notes, '')) LIKE $3",
		"lower(coalesce(url, '')) LIKE $3",
		"CASE priority WHEN 'high' THEN 3",
		"DESC",
	} {
		if !strings.Contains(query, expected) {
			t.Fatalf("query = %q, expected %q", query, expected)
		}
	}
	wantArgs := []any{"2026-04-23", "10:00", "%milk%"}
	if !reflect.DeepEqual(args, wantArgs) {
		t.Fatalf("args = %#v, want %#v", args, wantArgs)
	}
}

func TestListTasksQueryExplicitSortKeepsDoneTasksLast(t *testing.T) {
	projectID := int64(7)

	query, args := listTasksQuery(application.TaskListFilter{
		ProjectID: &projectID,
		Sort:      application.TaskSortPriority,
		Direction: application.SortDirectionDesc,
	})

	doneIndex := strings.Index(query, "CASE WHEN status = 'done' THEN 1 ELSE 0 END ASC")
	priorityIndex := strings.Index(query, priorityRankSQL()+" DESC")
	if doneIndex == -1 || priorityIndex == -1 || doneIndex > priorityIndex {
		t.Fatalf("query = %q, expected done tasks to sort last before priority ordering", query)
	}
	for _, expected := range []string{"project_id = $1", "id DESC"} {
		if !strings.Contains(query, expected) {
			t.Fatalf("query = %q, expected %q", query, expected)
		}
	}
	if !reflect.DeepEqual(args, []any{int64(7)}) {
		t.Fatalf("args = %#v, want project id arg", args)
	}
}

func TestListTasksQueryUpcomingAndInboxFilters(t *testing.T) {
	today := time.Date(2026, 4, 23, 10, 0, 0, 0, time.UTC)

	upcomingQuery, upcomingArgs := listTasksQuery(application.TaskListFilter{
		View:  application.TaskViewUpcoming,
		Today: today,
	})
	for _, expected := range []string{"due_date > $1::date", "status <> 'done'"} {
		if !strings.Contains(upcomingQuery, expected) {
			t.Fatalf("upcoming query = %q, expected %q", upcomingQuery, expected)
		}
	}
	if !reflect.DeepEqual(upcomingArgs, []any{"2026-04-23"}) {
		t.Fatalf("upcoming args = %#v, want date arg", upcomingArgs)
	}

	inboxQuery, inboxArgs := listTasksQuery(application.TaskListFilter{View: application.TaskViewInbox})
	for _, expected := range []string{"project_id IS NULL", "status <> 'done'"} {
		if !strings.Contains(inboxQuery, expected) {
			t.Fatalf("inbox query = %q, expected %q", inboxQuery, expected)
		}
	}
	if len(inboxArgs) != 0 {
		t.Fatalf("inbox args = %v, want none", inboxArgs)
	}
}
