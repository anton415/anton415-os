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
	dueDate := time.Date(2026, 4, 24, 18, 30, 0, 0, time.FixedZone("test", 3*60*60))

	task, err := NewTask(NewTaskInput{
		ProjectID: &projectID,
		Title:     "Buy milk",
		Notes:     &notes,
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
	if task.DueDate == nil || task.DueDate.Hour() != 0 || task.DueDate.Minute() != 0 {
		t.Fatalf("DueDate = %v, want date-only value", task.DueDate)
	}

	task.SetProject(nil, now.Add(time.Minute))
	task.SetNotes(nil, now.Add(2*time.Minute))
	task.SetDueDate(nil, now.Add(3*time.Minute))

	if task.ProjectID != nil {
		t.Fatalf("ProjectID = %v, want nil", task.ProjectID)
	}
	if task.Notes != nil {
		t.Fatalf("Notes = %v, want nil", task.Notes)
	}
	if task.DueDate != nil {
		t.Fatalf("DueDate = %v, want nil", task.DueDate)
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
