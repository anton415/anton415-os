package domain

import "errors"

var (
	ErrInvalidProjectName   = errors.New("project name is required")
	ErrInvalidProjectPeriod = errors.New("project period is invalid")
	ErrInvalidTaskTitle     = errors.New("task title is required")
	ErrInvalidTaskStatus    = errors.New("task status is invalid")
	ErrInvalidTaskSchedule  = errors.New("task schedule is invalid")
	ErrInvalidTaskRepeat    = errors.New("task repeat is invalid")
	ErrInvalidTaskPriority  = errors.New("task priority is invalid")
)
