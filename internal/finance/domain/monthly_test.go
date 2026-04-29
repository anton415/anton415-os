package domain

import (
	"errors"
	"testing"
)

func TestMonthlyExpenseActualFillsCategoriesAndComputesTotals(t *testing.T) {
	actual, err := NewMonthlyExpenseActual(2026, 4, map[ExpenseCategory]Money{
		ExpenseCategoryRestaurants: MustMoneyFromKopecks(150000),
		ExpenseCategoryGroceries:   MustMoneyFromKopecks(250000),
		ExpenseCategoryInvestments: MustMoneyFromKopecks(100000),
	})
	if err != nil {
		t.Fatalf("NewMonthlyExpenseActual() error = %v", err)
	}

	if got := len(actual.CategoryAmounts()); got != len(ExpenseCategories()) {
		t.Fatalf("len(CategoryAmounts()) = %d, want %d", got, len(ExpenseCategories()))
	}
	if got := actual.CategoryAmount(ExpenseCategoryPersonal).Decimal(); got != "0.00" {
		t.Fatalf("personal amount = %s, want 0.00", got)
	}
	if got := actual.Total().Decimal(); got != "5000.00" {
		t.Fatalf("Total() = %s, want 5000.00", got)
	}
	if got := actual.SpendingTotal().Decimal(); got != "4000.00" {
		t.Fatalf("SpendingTotal() = %s, want 4000.00", got)
	}
	if actual.IsZero() {
		t.Fatal("IsZero() = true, want false")
	}
}

func TestMonthlyActualValidation(t *testing.T) {
	_, err := NewMonthlyExpenseActual(0, 4, nil)
	if !errors.Is(err, ErrInvalidYear) {
		t.Fatalf("NewMonthlyExpenseActual(bad year) error = %v, want ErrInvalidYear", err)
	}

	_, err = NewMonthlyIncomeActual(2026, 13, ZeroMoney(), ZeroPercent(), ZeroMoney())
	if !errors.Is(err, ErrInvalidMonth) {
		t.Fatalf("NewMonthlyIncomeActual(bad month) error = %v, want ErrInvalidMonth", err)
	}

	_, err = NewMonthlyExpenseActual(2026, 4, map[ExpenseCategory]Money{
		ExpenseCategory("unknown"): ZeroMoney(),
	})
	if !errors.Is(err, ErrInvalidExpenseCategory) {
		t.Fatalf("NewMonthlyExpenseActual(unknown category) error = %v, want ErrInvalidExpenseCategory", err)
	}
}

func TestMonthlyIncomeActualStoresIncomeComponents(t *testing.T) {
	actual, err := NewMonthlyIncomeActual(
		2026,
		4,
		MustMoneyFromKopecks(25000000),
		MustPercentFromBasisPoints(650),
		MustMoneyFromKopecks(26650000),
	)
	if err != nil {
		t.Fatalf("NewMonthlyIncomeActual() error = %v", err)
	}

	if got := actual.SalaryAmount.Decimal(); got != "250000.00" {
		t.Fatalf("SalaryAmount = %s, want 250000.00", got)
	}
	if got := actual.BonusPercent.Decimal(); got != "6.50" {
		t.Fatalf("BonusPercent = %s, want 6.50", got)
	}
	if got := actual.TotalAmount.Decimal(); got != "266500.00" {
		t.Fatalf("TotalAmount = %s, want 266500.00", got)
	}
	if actual.IsZero() {
		t.Fatal("IsZero() = true, want false")
	}
}
