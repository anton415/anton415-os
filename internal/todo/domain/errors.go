package domain

import "errors"

var (
	ErrInvalidProjectName   = errors.New("project name is required")
	ErrInvalidProjectPeriod = errors.New("project period is invalid")
	ErrInvalidProjectParent = errors.New("project parent is invalid")
	ErrInvalidTaskTitle     = errors.New("task title is required")
	ErrInvalidTaskStatus    = errors.New("task status is invalid")
	ErrInvalidTaskSchedule  = errors.New("task schedule is invalid")
	ErrInvalidTaskRepeat    = errors.New("task repeat is invalid")
	ErrInvalidTaskParent    = errors.New("task parent is invalid")
	ErrInvalidTaskPriority  = errors.New("task priority is invalid")
	ErrInvalidTaskURL       = errors.New("task url is invalid")
)
