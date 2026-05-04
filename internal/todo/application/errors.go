package application

import "errors"

var (
	ErrInvalidFilter    = errors.New("todo filter is invalid")
	ErrInvalidHierarchy = errors.New("todo hierarchy is invalid")
	ErrNotFound         = errors.New("todo resource was not found")
	ErrProjectHasTasks  = errors.New("project still has tasks")
)
