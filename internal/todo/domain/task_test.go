package domain

import (
	"errors"
	"testing"
	"time"
)

func TestNewTaskTrimsTitleAndDefaultsStatus(t *testing.T) {
	now := time.Date(2026, 4, 23, 10, 0, 0, 0, time.UTC)

	task, err := NewTask(NewTaskInput{Title: "  Write plan  "}, now)
	if err != nil {
		t.Fatalf("NewTask() error = %v", err)
	}

	if task.Title != "Write plan" {
		t.Fatalf("Title = %q, want %q", task.Title, "Write plan")
	}
	if task.Status != TaskStatusTodo {
		t.Fatalf("Status = %q, want %q", task.Status, TaskStatusTodo)
	}
	if task.CompletedAt != nil {
		t.Fatal("CompletedAt is set for todo task")
	}
}

func TestNewTaskRejectsEmptyTitle(t *testing.T) {
	_, err := NewTask(NewTaskInput{Title: "   "}, time.Now())
	if !errors.Is(err, ErrInvalidTaskTitle) {
		t.Fatalf("NewTask() error = %v, want ErrInvalidTaskTitle", err)
	}
}

func TestTaskOptionalFieldsNormalizeAndClear(t *testing.T) {
	now := time.Date(2026, 4, 23, 10, 0, 0, 0, time.UTC)
	projectID := int64(7)
	notes := "  Bring oat milk  "
	taskURL := "  example.com/grocery-list  "
	dueDate := time.Date(2026, 4, 24, 18, 30, 0, 0, time.FixedZone("test", 3*60*60))

	task, err := NewTask(NewTaskInput{
		ProjectID: &projectID,
		Title:     "Buy milk",
		Notes:     &notes,
		URL:       &taskURL,
		DueDate:   &dueDate,
	}, now)
	if err != nil {
		t.Fatalf("NewTask() error = %v", err)
	}
	if task.ProjectID == nil || *task.ProjectID != projectID {
		t.Fatalf("ProjectID = %v, want %d", task.ProjectID, projectID)
	}
	if task.Notes == nil || *task.Notes != "Bring oat milk" {
		t.Fatalf("Notes = %v, want trimmed notes", task.Notes)
	}
	if task.URL == nil || *task.URL != "https://example.com/grocery-list" {
		t.Fatalf("URL = %v, want normalized https URL", task.URL)
	}
	if task.DueDate == nil || task.DueDate.Hour() != 0 || task.DueDate.Minute() != 0 {
		t.Fatalf("DueDate = %v, want date-only value", task.DueDate)
	}

	task.SetProject(nil, now.Add(time.Minute))
	task.SetNotes(nil, now.Add(2*time.Minute))
	if err := task.SetURL(nil, now.Add(3*time.Minute)); err != nil {
		t.Fatalf("SetURL(nil) error = %v", err)
	}
	task.SetDueDate(nil, now.Add(4*time.Minute))

	if task.ProjectID != nil {
		t.Fatalf("ProjectID = %v, want nil", task.ProjectID)
	}
	if task.Notes != nil {
		t.Fatalf("Notes = %v, want nil", task.Notes)
	}
	if task.URL != nil {
		t.Fatalf("URL = %v, want nil", task.URL)
	}
	if task.DueDate != nil {
		t.Fatalf("DueDate = %v, want nil", task.DueDate)
	}
}

func TestTaskURLValidationRejectsUnsafeURLs(t *testing.T) {
	for _, value := range []string{"javascript:alert(1)", "ftp://example.com/file", "https://exa mple.com"} {
		_, err := NewTask(NewTaskInput{Title: "Open link", URL: &value}, time.Now())
		if !errors.Is(err, ErrInvalidTaskURL) {
			t.Fatalf("NewTask(URL=%q) error = %v, want ErrInvalidTaskURL", value, err)
		}
	}
}

func TestTaskScheduleValidationAndRepeatNextDate(t *testing.T) {
	now := time.Date(2026, 4, 23, 10, 0, 0, 0, time.UTC)
	dueDate := time.Date(2026, 4, 24, 18, 30, 0, 0, time.UTC)
	dueTime := "9:05"
	repeatUntil := time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC)

	task, err := NewTask(NewTaskInput{
		Title:           "Repeat bill",
		DueDate:         &dueDate,
		DueTime:         &dueTime,
		RepeatFrequency: RepeatFrequencyWeekly,
		RepeatInterval:  2,
		RepeatUntil:     &repeatUntil,
		Flagged:         true,
		Priority:        TaskPriorityHigh,
	}, now)
	if err != nil {
		t.Fatalf("NewTask() error = %v", err)
	}
	if task.DueTime == nil || *task.DueTime != "09:05" {
		t.Fatalf("DueTime = %v, want 09:05", task.DueTime)
	}
	if task.RepeatUntil == nil || !task.RepeatUntil.Equal(time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("RepeatUntil = %v, want normalized date", task.RepeatUntil)
	}
	next := task.NextRepeatDate()
	if next == nil || !next.Equal(time.Date(2026, 5, 8, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("NextRepeatDate = %v, want 2026-05-08", next)
	}
	if !task.Flagged || task.Priority != TaskPriorityHigh {
		t.Fatalf("Flagged/Priority = %v/%s, want true/high", task.Flagged, task.Priority)
	}
}

func TestTaskScheduleValidationRejectsInvalidCombinations(t *testing.T) {
	now := time.Date(2026, 4, 23, 10, 0, 0, 0, time.UTC)
	dueTime := "10:00"
	_, err := NewTask(NewTaskInput{Title: "Timed", DueTime: &dueTime}, now)
	if !errors.Is(err, ErrInvalidTaskSchedule) {
		t.Fatalf("NewTask(time without date) error = %v, want ErrInvalidTaskSchedule", err)
	}

	dueDate := time.Date(2026, 4, 24, 0, 0, 0, 0, time.UTC)
	repeatUntil := time.Date(2026, 4, 23, 0, 0, 0, 0, time.UTC)
	_, err = NewTask(NewTaskInput{
		Title:           "Bad repeat",
		DueDate:         &dueDate,
		RepeatFrequency: RepeatFrequencyDaily,
		RepeatInterval:  1,
		RepeatUntil:     &repeatUntil,
	}, now)
	if !errors.Is(err, ErrInvalidTaskRepeat) {
		t.Fatalf("NewTask(repeat until before due) error = %v, want ErrInvalidTaskRepeat", err)
	}
}

func TestCompleteOrAdvanceRepeat(t *testing.T) {
	now := time.Date(2026, 4, 23, 10, 0, 0, 0, time.UTC)
	dueDate := time.Date(2026, 4, 23, 0, 0, 0, 0, time.UTC)
	repeatUntil := time.Date(2026, 4, 24, 0, 0, 0, 0, time.UTC)
	task, err := NewTask(NewTaskInput{
		Title:           "Daily habit",
		DueDate:         &dueDate,
		RepeatFrequency: RepeatFrequencyDaily,
		RepeatUntil:     &repeatUntil,
	}, now)
	if err != nil {
		t.Fatalf("NewTask() error = %v", err)
	}

	if err := task.CompleteOrAdvanceRepeat(now.Add(time.Hour)); err != nil {
		t.Fatalf("CompleteOrAdvanceRepeat() error = %v", err)
	}
	if task.Status != TaskStatusTodo || task.CompletedAt != nil {
		t.Fatalf("Status/CompletedAt = %s/%v, want todo/nil", task.Status, task.CompletedAt)
	}
	if task.DueDate == nil || !task.DueDate.Equal(repeatUntil) {
		t.Fatalf("DueDate = %v, want repeat until date", task.DueDate)
	}

	if err := task.CompleteOrAdvanceRepeat(now.Add(2 * time.Hour)); err != nil {
		t.Fatalf("CompleteOrAdvanceRepeat(final) error = %v", err)
	}
	if task.Status != TaskStatusDone || task.CompletedAt == nil {
		t.Fatalf("Status/CompletedAt = %s/%v, want done/set", task.Status, task.CompletedAt)
	}
}

func TestApplyStatusDoneSetsCompletedAt(t *testing.T) {
	now := time.Date(2026, 4, 23, 10, 0, 0, 0, time.UTC)
	task, err := NewTask(NewTaskInput{Title: "Ship todo"}, now)
	if err != nil {
		t.Fatalf("NewTask() error = %v", err)
	}

	doneAt := now.Add(time.Hour)
	if err := task.ApplyStatus(TaskStatusDone, doneAt); err != nil {
		t.Fatalf("ApplyStatus() error = %v", err)
	}

	if task.CompletedAt == nil || !task.CompletedAt.Equal(doneAt) {
		t.Fatalf("CompletedAt = %v, want %v", task.CompletedAt, doneAt)
	}
}

func TestApplyStatusAwayFromDoneClearsCompletedAt(t *testing.T) {
	now := time.Date(2026, 4, 23, 10, 0, 0, 0, time.UTC)
	task, err := NewTask(NewTaskInput{Title: "Ship todo", Status: TaskStatusDone}, now)
	if err != nil {
		t.Fatalf("NewTask() error = %v", err)
	}

	next := now.Add(time.Hour)
	if err := task.ApplyStatus(TaskStatusInProgress, next); err != nil {
		t.Fatalf("ApplyStatus() error = %v", err)
	}

	if task.CompletedAt != nil {
		t.Fatalf("CompletedAt = %v, want nil", task.CompletedAt)
	}
	if task.Status != TaskStatusInProgress {
		t.Fatalf("Status = %q, want %q", task.Status, TaskStatusInProgress)
	}
}
