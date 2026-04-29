package domain

func ValidateYear(year int) error {
	if year < 1 || year > 9999 {
		return ErrInvalidYear
	}
	return nil
}

func ValidateMonth(month int) error {
	if month < 1 || month > 12 {
		return ErrInvalidMonth
	}
	return nil
}
