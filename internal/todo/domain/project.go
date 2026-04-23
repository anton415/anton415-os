package domain

import (
	"strings"
	"time"
)

type Project struct {
	ID        int64
	Name      string
	CreatedAt time.Time
	UpdatedAt time.Time
}

func NewProject(name string, now time.Time) (Project, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return Project{}, ErrInvalidProjectName
	}

	return Project{
		Name:      name,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

func RenameProject(project Project, name string, now time.Time) (Project, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return Project{}, ErrInvalidProjectName
	}

	project.Name = name
	project.UpdatedAt = now
	return project, nil
}
