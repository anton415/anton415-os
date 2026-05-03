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
	for category, percent := range expenseLimitPercents {
		if !category.Valid() {
			return FinanceSettings{}, ErrInvalidExpenseCategory
		}
		percents[category] = percent
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
