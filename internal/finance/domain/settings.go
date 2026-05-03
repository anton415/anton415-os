package domain

type FinanceSettings struct {
	HasIncomeSettings    bool
	SalaryAmount         Money
	BonusPercent         Percent
	expenseLimitPercents map[ExpenseCategory]Percent
}

func EmptyFinanceSettings() FinanceSettings {
	settings, err := NewFinanceSettings(false, ZeroMoney(), ZeroPercent(), nil)
	if err != nil {
		panic(err)
	}
	return settings
}

func NewFinanceSettings(
	hasIncomeSettings bool,
	salaryAmount Money,
	bonusPercent Percent,
	expenseLimitPercents map[ExpenseCategory]Percent,
) (FinanceSettings, error) {
	percents := map[ExpenseCategory]Percent{}
	totalBasisPoints := int64(0)
	for category, percent := range expenseLimitPercents {
		if !category.Valid() || !category.SupportsLimit() {
			return FinanceSettings{}, ErrInvalidExpenseCategory
		}
		if percent.IsZero() {
			continue
		}
		percents[category] = percent
		totalBasisPoints += percent.BasisPoints()
	}
	if totalBasisPoints != 0 && totalBasisPoints != 10000 {
		return FinanceSettings{}, ErrInvalidExpenseLimitTotal
	}

	return FinanceSettings{
		HasIncomeSettings:    hasIncomeSettings,
		SalaryAmount:         salaryAmount,
		BonusPercent:         bonusPercent,
		expenseLimitPercents: percents,
	}, nil
}

func (settings FinanceSettings) ExpenseLimitPercents() map[ExpenseCategory]Percent {
	percents := make(map[ExpenseCategory]Percent, len(settings.expenseLimitPercents))
	for category, percent := range settings.expenseLimitPercents {
		percents[category] = percent
	}
	return percents
}
