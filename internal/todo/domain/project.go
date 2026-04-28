package domain

import (
	"strings"
	"time"
)

type Project struct {
	ID        int64
	Name      string
	StartDate *time.Time
	EndDate   *time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
}

func NewProject(name string, startDate *time.Time, endDate *time.Time, now time.Time) (Project, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return Project{}, ErrInvalidProjectName
	}
	startDate = NormalizeDate(startDate)
	endDate = NormalizeDate(endDate)
	if !validDateRange(startDate, endDate) {
		return Project{}, ErrInvalidProjectPeriod
	}

	return Project{
		Name:      name,
		StartDate: startDate,
		EndDate:   endDate,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

func UpdateProject(project Project, name string, startDate *time.Time, endDate *time.Time, now time.Time) (Project, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return Project{}, ErrInvalidProjectName
	}
	startDate = NormalizeDate(startDate)
	endDate = NormalizeDate(endDate)
	if !validDateRange(startDate, endDate) {
		return Project{}, ErrInvalidProjectPeriod
	}

	project.Name = name
	project.StartDate = startDate
	project.EndDate = endDate
	project.UpdatedAt = now
	return project, nil
}

func validDateRange(startDate *time.Time, endDate *time.Time) bool {
	return startDate == nil || endDate == nil || !startDate.After(*endDate)
}
