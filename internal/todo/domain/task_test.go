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
