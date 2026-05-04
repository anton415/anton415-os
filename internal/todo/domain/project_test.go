package domain

import (
	"errors"
	"testing"
	"time"
)

func TestProjectPeriodNormalizesAndValidates(t *testing.T) {
	now := time.Date(2026, 4, 23, 10, 0, 0, 0, time.UTC)
	start := time.Date(2026, 4, 20, 18, 30, 0, 0, time.UTC)
	end := time.Date(2026, 4, 30, 8, 0, 0, 0, time.UTC)

	project, err := NewProject(nil, "  Launch  ", &start, &end, now)
	if err != nil {
		t.Fatalf("NewProject() error = %v", err)
	}
	if project.Name != "Launch" {
		t.Fatalf("Name = %q, want Launch", project.Name)
	}
	if project.StartDate == nil || project.StartDate.Hour() != 0 {
		t.Fatalf("StartDate = %v, want normalized date", project.StartDate)
	}
	if project.EndDate == nil || project.EndDate.Hour() != 0 {
		t.Fatalf("EndDate = %v, want normalized date", project.EndDate)
	}
	if project.Archived {
		t.Fatalf("Archived = true, want false")
	}

	_, err = NewProject(nil, "Launch", &end, &start, now)
	if !errors.Is(err, ErrInvalidProjectPeriod) {
		t.Fatalf("NewProject(invalid period) error = %v, want ErrInvalidProjectPeriod", err)
	}
}

func TestProjectArchiveAndRestore(t *testing.T) {
	createdAt := time.Date(2026, 4, 23, 10, 0, 0, 0, time.UTC)
	updatedAt := createdAt.Add(time.Hour)

	project, err := NewProject(nil, "Launch", nil, nil, createdAt)
	if err != nil {
		t.Fatalf("NewProject() error = %v", err)
	}

	project = ArchiveProject(project, updatedAt)
	if !project.Archived {
		t.Fatalf("Archived = false, want true")
	}
	if !project.UpdatedAt.Equal(updatedAt) {
		t.Fatalf("UpdatedAt = %v, want %v", project.UpdatedAt, updatedAt)
	}

	restoredAt := updatedAt.Add(time.Hour)
	project = RestoreProject(project, restoredAt)
	if project.Archived {
		t.Fatalf("Archived = true, want false")
	}
	if !project.UpdatedAt.Equal(restoredAt) {
		t.Fatalf("UpdatedAt = %v, want %v", project.UpdatedAt, restoredAt)
	}
}

func TestProjectParentValidation(t *testing.T) {
	now := time.Date(2026, 4, 23, 10, 0, 0, 0, time.UTC)
	parentID := int64(12)

	project, err := NewProject(&parentID, "Child", nil, nil, now)
	if err != nil {
		t.Fatalf("NewProject(parent) error = %v", err)
	}
	if project.ParentProjectID == nil || *project.ParentProjectID != parentID {
		t.Fatalf("ParentProjectID = %v, want %d", project.ParentProjectID, parentID)
	}

	zero := int64(0)
	_, err = NewProject(&zero, "Child", nil, nil, now)
	if !errors.Is(err, ErrInvalidProjectParent) {
		t.Fatalf("NewProject(zero parent) error = %v, want ErrInvalidProjectParent", err)
	}
}
