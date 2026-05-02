package application

import (
	"context"

	"github.com/anton415/anton415-hub/internal/finance/domain"
)

type ExpenseRepository interface {
	ListExpenseActuals(ctx context.Context, year int) ([]domain.MonthlyExpenseActual, error)
	UpsertExpenseActual(ctx context.Context, actual domain.MonthlyExpenseActual) error
	DeleteExpenseActual(ctx context.Context, year int, month int) error
}

type IncomeRepository interface {
	ListIncomeActuals(ctx context.Context, year int) ([]domain.MonthlyIncomeActual, error)
	UpsertIncomeActual(ctx context.Context, actual domain.MonthlyIncomeActual) error
	DeleteIncomeActual(ctx context.Context, year int, month int) error
}

type Dependencies struct {
	Expenses ExpenseRepository
	Income   IncomeRepository
}

type Service struct {
	expenses ExpenseRepository
	income   IncomeRepository
}

func NewService(deps Dependencies) *Service {
	return &Service{
		expenses: deps.Expenses,
		income:   deps.Income,
	}
}

type ExpensesYear struct {
	Year                   int
	Months                 []domain.MonthlyExpenseActual
	AnnualTotalsByCategory map[domain.ExpenseCategory]domain.Money
	AnnualTotal            domain.Money
	AnnualSpendingTotal    domain.Money
}

type IncomeYear struct {
	Year                int
	Months              []domain.MonthlyIncomeActual
	AnnualTotal         domain.Money
	AverageMonthlyTotal domain.Money
}

type SaveExpenseActualInput struct {
	CategoryAmounts map[domain.ExpenseCategory]domain.Money
}

type SaveIncomeActualInput struct {
	SalaryAmount domain.Money
	BonusPercent domain.Percent
	TotalAmount  domain.Money
}

func (service *Service) ListExpenses(ctx context.Context, year int) (ExpensesYear, error) {
	if err := domain.ValidateYear(year); err != nil {
		return ExpensesYear{}, err
	}

	actuals, err := service.expenses.ListExpenseActuals(ctx, year)
	if err != nil {
		return ExpensesYear{}, err
	}

	monthsByNumber := map[int]domain.MonthlyExpenseActual{}
	for _, actual := range actuals {
		if actual.Year == year {
			monthsByNumber[actual.Month] = actual
		}
	}

	result := ExpensesYear{
		Year:                   year,
		Months:                 make([]domain.MonthlyExpenseActual, 0, 12),
		AnnualTotalsByCategory: zeroByCategory(),
	}
	for month := 1; month <= 12; month++ {
		actual, ok := monthsByNumber[month]
		if !ok {
			var err error
			actual, err = domain.EmptyMonthlyExpenseActual(year, month)
			if err != nil {
				return ExpensesYear{}, err
			}
		}

		result.Months = append(result.Months, actual)
		result.AnnualTotal = result.AnnualTotal.Add(actual.Total())
		result.AnnualSpendingTotal = result.AnnualSpendingTotal.Add(actual.SpendingTotal())
		for _, category := range domain.ExpenseCategories() {
			current := result.AnnualTotalsByCategory[category.Code]
			result.AnnualTotalsByCategory[category.Code] = current.Add(actual.CategoryAmount(category.Code))
		}
	}

	return result, nil
}

func (service *Service) SaveExpense(ctx context.Context, year int, month int, input SaveExpenseActualInput) (domain.MonthlyExpenseActual, error) {
	actual, err := domain.NewMonthlyExpenseActual(year, month, input.CategoryAmounts)
	if err != nil {
		return domain.MonthlyExpenseActual{}, err
	}

	if actual.IsZero() {
		if err := service.expenses.DeleteExpenseActual(ctx, year, month); err != nil {
			return domain.MonthlyExpenseActual{}, err
		}
		return actual, nil
	}

	if err := service.expenses.UpsertExpenseActual(ctx, actual); err != nil {
		return domain.MonthlyExpenseActual{}, err
	}
	return actual, nil
}

func (service *Service) ListIncome(ctx context.Context, year int) (IncomeYear, error) {
	if err := domain.ValidateYear(year); err != nil {
		return IncomeYear{}, err
	}

	actuals, err := service.income.ListIncomeActuals(ctx, year)
	if err != nil {
		return IncomeYear{}, err
	}

	monthsByNumber := map[int]domain.MonthlyIncomeActual{}
	for _, actual := range actuals {
		if actual.Year == year {
			monthsByNumber[actual.Month] = actual
		}
	}

	result := IncomeYear{
		Year:   year,
		Months: make([]domain.MonthlyIncomeActual, 0, 12),
	}
	filledMonthCount := 0
	for month := 1; month <= 12; month++ {
		actual, ok := monthsByNumber[month]
		if !ok {
			var err error
			actual, err = domain.EmptyMonthlyIncomeActual(year, month)
			if err != nil {
				return IncomeYear{}, err
			}
		}

		result.Months = append(result.Months, actual)
		result.AnnualTotal = result.AnnualTotal.Add(actual.TotalAmount)
		if !actual.IsZero() {
			filledMonthCount++
		}
	}
	result.AverageMonthlyTotal = domain.AverageMoney(result.AnnualTotal, filledMonthCount)

	return result, nil
}

func (service *Service) SaveIncome(ctx context.Context, year int, month int, input SaveIncomeActualInput) (domain.MonthlyIncomeActual, error) {
	actual, err := domain.NewMonthlyIncomeActual(year, month, input.SalaryAmount, input.BonusPercent, input.TotalAmount)
	if err != nil {
		return domain.MonthlyIncomeActual{}, err
	}

	if actual.IsZero() {
		if err := service.income.DeleteIncomeActual(ctx, year, month); err != nil {
			return domain.MonthlyIncomeActual{}, err
		}
		return actual, nil
	}

	if err := service.income.UpsertIncomeActual(ctx, actual); err != nil {
		return domain.MonthlyIncomeActual{}, err
	}
	return actual, nil
}

func zeroByCategory() map[domain.ExpenseCategory]domain.Money {
	totals := map[domain.ExpenseCategory]domain.Money{}
	for _, category := range domain.ExpenseCategories() {
		totals[category.Code] = domain.ZeroMoney()
	}
	return totals
}
