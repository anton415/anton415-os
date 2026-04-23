package domain

import "errors"

var (
	ErrInvalidProjectName = errors.New("project name is required")
	ErrInvalidTaskTitle   = errors.New("task title is required")
	ErrInvalidTaskStatus  = errors.New("task status is invalid")
)
