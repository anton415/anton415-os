package application

import (
	"context"
	"testing"

	"github.com/anton415/anton415-os/internal/finance/domain"
)

func TestServiceListExpensesReturnsTwelveMonthsAndTotals(t *testing.T) {
	store := newMemoryStore()
	service := NewService(Dependencies{Expenses: store, Income: store})
	_, err := service.SaveExpense(context.Background(), 2026, 4, SaveExpenseActualInput{
		CategoryAmounts: map[domain.ExpenseCategory]domain.Money{
			domain.ExpenseCategoryRestaurants: domain.MustMoneyFromKopecks(150000),
			domain.ExpenseCategoryInvestments: domain.MustMoneyFromKopecks(100000),
		},
	})
	if err != nil {
		t.Fatalf("SaveExpense() error = %v", err)
	}

	year, err := service.ListExpenses(context.Background(), 2026)
	if err != nil {
		t.Fatalf("ListExpenses() error = %v", err)
	}

	if len(year.Months) != 12 {
		t.Fatalf("len(Months) = %d, want 12", len(year.Months))
	}
	if got := year.Months[3].Total().Decimal(); got != "2500.00" {
		t.Fatalf("April total = %s, want 2500.00", got)
	}
	if got := year.AnnualTotal.Decimal(); got != "2500.00" {
		t.Fatalf("AnnualTotal = %s, want 2500.00", got)
	}
	if got := year.AnnualSpendingTotal.Decimal(); got != "1500.00" {
		t.Fatalf("AnnualSpendingTotal = %s, want 1500.00", got)
	}
}

func TestServiceDeletesZeroExpenseAndIncomeMonths(t *testing.T) {
	store := newMemoryStore()
	service := NewService(Dependencies{Expenses: store, Income: store})
	ctx := context.Background()

	_, err := service.SaveExpense(ctx, 2026, 4, SaveExpenseActualInput{
		CategoryAmounts: map[domain.ExpenseCategory]domain.Money{
			domain.ExpenseCategoryRestaurants: domain.MustMoneyFromKopecks(150000),
		},
	})
	if err != nil {
		t.Fatalf("SaveExpense(non-zero) error = %v", err)
	}
	_, err = service.SaveExpense(ctx, 2026, 4, SaveExpenseActualInput{})
	if err != nil {
		t.Fatalf("SaveExpense(zero) error = %v", err)
	}
	if _, ok := store.expenses[[2]int{2026, 4}]; ok {
		t.Fatal("expense month still stored after zero save")
	}

	_, err = service.SaveIncome(ctx, 2026, 4, SaveIncomeActualInput{
		SalaryAmount: domain.MustMoneyFromKopecks(20000000),
		BonusPercent: domain.MustPercentFromBasisPoints(2500),
		TotalAmount:  domain.MustMoneyFromKopecks(25000000),
	})
	if err != nil {
		t.Fatalf("SaveIncome(non-zero) error = %v", err)
	}
	_, err = service.SaveIncome(ctx, 2026, 4, SaveIncomeActualInput{})
	if err != nil {
		t.Fatalf("SaveIncome(zero) error = %v", err)
	}
	if _, ok := store.income[[2]int{2026, 4}]; ok {
		t.Fatal("income month still stored after zero save")
	}
}

func TestServiceListIncomeReturnsAverageForNonZeroIncomeMonths(t *testing.T) {
	store := newMemoryStore()
	service := NewService(Dependencies{Expenses: store, Income: store})
	ctx := context.Background()

	_, _ = service.SaveIncome(ctx, 2026, 1, SaveIncomeActualInput{
		SalaryAmount: domain.MustMoneyFromKopecks(10000),
		BonusPercent: domain.MustPercentFromBasisPoints(1000),
		TotalAmount:  domain.MustMoneyFromKopecks(11000),
	})
	_, _ = service.SaveIncome(ctx, 2026, 2, SaveIncomeActualInput{
		SalaryAmount: domain.MustMoneyFromKopecks(20000),
		BonusPercent: domain.MustPercentFromBasisPoints(1000),
		TotalAmount:  domain.MustMoneyFromKopecks(22000),
	})

	year, err := service.ListIncome(ctx, 2026)
	if err != nil {
		t.Fatalf("ListIncome() error = %v", err)
	}

	if len(year.Months) != 12 {
		t.Fatalf("len(Months) = %d, want 12", len(year.Months))
	}
	if got := year.Months[0].SalaryAmount.Decimal(); got != "100.00" {
		t.Fatalf("January salary = %s, want 100.00", got)
	}
	if got := year.Months[0].BonusPercent.Decimal(); got != "10.00" {
		t.Fatalf("January bonus percent = %s, want 10.00", got)
	}
	if got := year.AnnualTotal.Decimal(); got != "330.00" {
		t.Fatalf("AnnualTotal = %s, want 330.00", got)
	}
	if got := year.AverageMonthlyTotal.Decimal(); got != "165.00" {
		t.Fatalf("AverageMonthlyTotal = %s, want 165.00", got)
	}
}

type memoryStore struct {
	expenses map[[2]int]domain.MonthlyExpenseActual
	income   map[[2]int]domain.MonthlyIncomeActual
}

func newMemoryStore() *memoryStore {
	return &memoryStore{
		expenses: map[[2]int]domain.MonthlyExpenseActual{},
		income:   map[[2]int]domain.MonthlyIncomeActual{},
	}
}

func (store *memoryStore) ListExpenseActuals(_ context.Context, year int) ([]domain.MonthlyExpenseActual, error) {
	actuals := []domain.MonthlyExpenseActual{}
	for key, actual := range store.expenses {
		if key[0] == year {
			actuals = append(actuals, actual)
		}
	}
	return actuals, nil
}

func (store *memoryStore) UpsertExpenseActual(_ context.Context, actual domain.MonthlyExpenseActual) error {
	store.expenses[[2]int{actual.Year, actual.Month}] = actual
	return nil
}

func (store *memoryStore) DeleteExpenseActual(_ context.Context, year int, month int) error {
	delete(store.expenses, [2]int{year, month})
	return nil
}

func (store *memoryStore) ListIncomeActuals(_ context.Context, year int) ([]domain.MonthlyIncomeActual, error) {
	actuals := []domain.MonthlyIncomeActual{}
	for key, actual := range store.income {
		if key[0] == year {
			actuals = append(actuals, actual)
		}
	}
	return actuals, nil
}

func (store *memoryStore) UpsertIncomeActual(_ context.Context, actual domain.MonthlyIncomeActual) error {
	store.income[[2]int{actual.Year, actual.Month}] = actual
	return nil
}

func (store *memoryStore) DeleteIncomeActual(_ context.Context, year int, month int) error {
	delete(store.income, [2]int{year, month})
	return nil
}
