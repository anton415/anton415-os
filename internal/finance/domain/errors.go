package domain

import "errors"

var (
	ErrInvalidExpenseCategory = errors.New("finance expense category is invalid")
	ErrInvalidExpenseAmounts  = errors.New("finance expense amounts are invalid")
	ErrInvalidMoney           = errors.New("finance money amount is invalid")
	ErrInvalidMonth           = errors.New("finance month is invalid")
	ErrInvalidPercent         = errors.New("finance percent is invalid")
	ErrInvalidYear            = errors.New("finance year is invalid")
)
