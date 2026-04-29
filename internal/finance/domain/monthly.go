package domain

type MonthlyExpenseActual struct {
	Year            int
	Month           int
	categoryAmounts map[ExpenseCategory]Money
}

func NewMonthlyExpenseActual(year int, month int, amounts map[ExpenseCategory]Money) (MonthlyExpenseActual, error) {
	if err := ValidateYear(year); err != nil {
		return MonthlyExpenseActual{}, err
	}
	if err := ValidateMonth(month); err != nil {
		return MonthlyExpenseActual{}, err
	}

	for category := range amounts {
		if !category.Valid() {
			return MonthlyExpenseActual{}, ErrInvalidExpenseCategory
		}
	}

	normalized := map[ExpenseCategory]Money{}
	for _, info := range expenseCategoryInfos {
		amount, ok := amounts[info.Code]
		if !ok {
			amount = ZeroMoney()
		}
		normalized[info.Code] = amount
	}

	return MonthlyExpenseActual{
		Year:            year,
		Month:           month,
		categoryAmounts: normalized,
	}, nil
}

func EmptyMonthlyExpenseActual(year int, month int) (MonthlyExpenseActual, error) {
	return NewMonthlyExpenseActual(year, month, map[ExpenseCategory]Money{})
}

func (actual MonthlyExpenseActual) CategoryAmounts() map[ExpenseCategory]Money {
	amounts := make(map[ExpenseCategory]Money, len(actual.categoryAmounts))
	for category, amount := range actual.categoryAmounts {
		amounts[category] = amount
	}
	return amounts
}

func (actual MonthlyExpenseActual) CategoryAmount(category ExpenseCategory) Money {
	amount, ok := actual.categoryAmounts[category]
	if !ok {
		return ZeroMoney()
	}
	return amount
}

func (actual MonthlyExpenseActual) Total() Money {
	total := ZeroMoney()
	for _, amount := range actual.categoryAmounts {
		total = total.Add(amount)
	}
	return total
}

func (actual MonthlyExpenseActual) SpendingTotal() Money {
	total := ZeroMoney()
	for category, amount := range actual.categoryAmounts {
		if category.Classification() == ExpenseCategoryClassificationExpense {
			total = total.Add(amount)
		}
	}
	return total
}

func (actual MonthlyExpenseActual) IsZero() bool {
	return actual.Total().IsZero()
}

type MonthlyIncomeActual struct {
	Year         int
	Month        int
	SalaryAmount Money
	BonusPercent Percent
	TotalAmount  Money
}

func NewMonthlyIncomeActual(year int, month int, salaryAmount Money, bonusPercent Percent, totalAmount Money) (MonthlyIncomeActual, error) {
	if err := ValidateYear(year); err != nil {
		return MonthlyIncomeActual{}, err
	}
	if err := ValidateMonth(month); err != nil {
		return MonthlyIncomeActual{}, err
	}
	return MonthlyIncomeActual{
		Year:         year,
		Month:        month,
		SalaryAmount: salaryAmount,
		BonusPercent: bonusPercent,
		TotalAmount:  totalAmount,
	}, nil
}

func EmptyMonthlyIncomeActual(year int, month int) (MonthlyIncomeActual, error) {
	return NewMonthlyIncomeActual(year, month, ZeroMoney(), ZeroPercent(), ZeroMoney())
}

func (actual MonthlyIncomeActual) IsZero() bool {
	return actual.SalaryAmount.IsZero() && actual.BonusPercent.IsZero() && actual.TotalAmount.IsZero()
}
