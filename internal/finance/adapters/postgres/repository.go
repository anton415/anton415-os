package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/anton415/anton415-hub/internal/finance/domain"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (repo *Repository) ListExpenseActuals(ctx context.Context, year int) ([]domain.MonthlyExpenseActual, error) {
	rows, err := repo.pool.Query(ctx, `
		SELECT year, month, restaurants_kopecks, groceries_kopecks, personal_kopecks, utilities_kopecks,
		       transport_kopecks, gifts_kopecks, investments_kopecks, entertainment_kopecks, education_kopecks
		FROM finance_monthly_expense_actuals
		WHERE year = $1
		ORDER BY month
	`, year)
	if err != nil {
		return nil, fmt.Errorf("list finance expense actuals: %w", err)
	}
	defer rows.Close()

	actuals := []domain.MonthlyExpenseActual{}
	for rows.Next() {
		actual, err := scanExpenseActual(rows)
		if err != nil {
			return nil, err
		}
		actuals = append(actuals, actual)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list finance expense actuals rows: %w", err)
	}
	return actuals, nil
}

func (repo *Repository) UpsertExpenseActual(ctx context.Context, actual domain.MonthlyExpenseActual) error {
	_, err := repo.pool.Exec(ctx, `
		INSERT INTO finance_monthly_expense_actuals (
			year, month, restaurants_kopecks, groceries_kopecks, personal_kopecks, utilities_kopecks,
			transport_kopecks, gifts_kopecks, investments_kopecks, entertainment_kopecks, education_kopecks
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (year, month) DO UPDATE SET
			restaurants_kopecks = EXCLUDED.restaurants_kopecks,
			groceries_kopecks = EXCLUDED.groceries_kopecks,
			personal_kopecks = EXCLUDED.personal_kopecks,
			utilities_kopecks = EXCLUDED.utilities_kopecks,
			transport_kopecks = EXCLUDED.transport_kopecks,
			gifts_kopecks = EXCLUDED.gifts_kopecks,
			investments_kopecks = EXCLUDED.investments_kopecks,
			entertainment_kopecks = EXCLUDED.entertainment_kopecks,
			education_kopecks = EXCLUDED.education_kopecks
	`,
		actual.Year,
		actual.Month,
		amount(actual, domain.ExpenseCategoryRestaurants),
		amount(actual, domain.ExpenseCategoryGroceries),
		amount(actual, domain.ExpenseCategoryPersonal),
		amount(actual, domain.ExpenseCategoryUtilities),
		amount(actual, domain.ExpenseCategoryTransport),
		amount(actual, domain.ExpenseCategoryGifts),
		amount(actual, domain.ExpenseCategoryInvestments),
		amount(actual, domain.ExpenseCategoryEntertainment),
		amount(actual, domain.ExpenseCategoryEducation),
	)
	if err != nil {
		return fmt.Errorf("upsert finance expense actual: %w", err)
	}
	return nil
}

func (repo *Repository) DeleteExpenseActual(ctx context.Context, year int, month int) error {
	_, err := repo.pool.Exec(ctx, `
		DELETE FROM finance_monthly_expense_actuals
		WHERE year = $1 AND month = $2
	`, year, month)
	if err != nil {
		return fmt.Errorf("delete finance expense actual: %w", err)
	}
	return nil
}

func (repo *Repository) ListIncomeActuals(ctx context.Context, year int) ([]domain.MonthlyIncomeActual, error) {
	rows, err := repo.pool.Query(ctx, `
		SELECT year, month, salary_kopecks, bonus_percent_basis_points, total_kopecks
		FROM finance_monthly_income_actuals
		WHERE year = $1
		ORDER BY month
	`, year)
	if err != nil {
		return nil, fmt.Errorf("list finance income actuals: %w", err)
	}
	defer rows.Close()

	actuals := []domain.MonthlyIncomeActual{}
	for rows.Next() {
		actual, err := scanIncomeActual(rows)
		if err != nil {
			return nil, err
		}
		actuals = append(actuals, actual)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list finance income actuals rows: %w", err)
	}
	return actuals, nil
}

func (repo *Repository) UpsertIncomeActual(ctx context.Context, actual domain.MonthlyIncomeActual) error {
	_, err := repo.pool.Exec(ctx, `
		INSERT INTO finance_monthly_income_actuals (year, month, salary_kopecks, bonus_percent_basis_points, total_kopecks)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (year, month) DO UPDATE SET
			salary_kopecks = EXCLUDED.salary_kopecks,
			bonus_percent_basis_points = EXCLUDED.bonus_percent_basis_points,
			total_kopecks = EXCLUDED.total_kopecks
	`, actual.Year, actual.Month, actual.SalaryAmount.Kopecks(), actual.BonusPercent.BasisPoints(), actual.TotalAmount.Kopecks())
	if err != nil {
		return fmt.Errorf("upsert finance income actual: %w", err)
	}
	return nil
}

func (repo *Repository) DeleteIncomeActual(ctx context.Context, year int, month int) error {
	_, err := repo.pool.Exec(ctx, `
		DELETE FROM finance_monthly_income_actuals
		WHERE year = $1 AND month = $2
	`, year, month)
	if err != nil {
		return fmt.Errorf("delete finance income actual: %w", err)
	}
	return nil
}

func (repo *Repository) GetFinanceSettings(ctx context.Context) (domain.FinanceSettings, error) {
	hasIncomeSettings := false
	salaryAmount := domain.ZeroMoney()
	bonusPercent := domain.ZeroPercent()

	var salaryKopecks int64
	var bonusBasisPoints int64
	err := repo.pool.QueryRow(ctx, `
		SELECT salary_kopecks, bonus_percent_basis_points
		FROM finance_settings
		WHERE id = TRUE
	`).Scan(&salaryKopecks, &bonusBasisPoints)
	switch {
	case err == nil:
		hasIncomeSettings = true
		salaryAmount = domain.MustMoneyFromKopecks(salaryKopecks)
		bonusPercent = domain.MustPercentFromBasisPoints(bonusBasisPoints)
	case errors.Is(err, pgx.ErrNoRows):
	default:
		return domain.FinanceSettings{}, fmt.Errorf("get finance settings: %w", err)
	}

	rows, err := repo.pool.Query(ctx, `
		SELECT category, percent_basis_points
		FROM finance_expense_limit_settings
		ORDER BY category
	`)
	if err != nil {
		return domain.FinanceSettings{}, fmt.Errorf("list finance expense limit settings: %w", err)
	}
	defer rows.Close()

	percents := map[domain.ExpenseCategory]domain.Percent{}
	for rows.Next() {
		var categoryCode string
		var basisPoints int64
		if err := rows.Scan(&categoryCode, &basisPoints); err != nil {
			return domain.FinanceSettings{}, err
		}
		category, err := domain.ParseExpenseCategory(categoryCode)
		if err != nil {
			return domain.FinanceSettings{}, err
		}
		percent, err := domain.NewPercentFromBasisPoints(basisPoints)
		if err != nil {
			return domain.FinanceSettings{}, err
		}
		percents[category] = percent
	}
	if err := rows.Err(); err != nil {
		return domain.FinanceSettings{}, fmt.Errorf("list finance expense limit settings rows: %w", err)
	}

	settings, err := domain.NewFinanceSettings(hasIncomeSettings, salaryAmount, bonusPercent, percents)
	if err != nil {
		return domain.FinanceSettings{}, err
	}
	return settings, nil
}

func (repo *Repository) SaveFinanceSettings(ctx context.Context, settings domain.FinanceSettings) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin finance settings transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	if settings.HasIncomeSettings {
		_, err = tx.Exec(ctx, `
			INSERT INTO finance_settings (id, salary_kopecks, bonus_percent_basis_points)
			VALUES (TRUE, $1, $2)
			ON CONFLICT (id) DO UPDATE SET
				salary_kopecks = EXCLUDED.salary_kopecks,
				bonus_percent_basis_points = EXCLUDED.bonus_percent_basis_points
		`, settings.SalaryAmount.Kopecks(), settings.BonusPercent.BasisPoints())
	} else {
		_, err = tx.Exec(ctx, `DELETE FROM finance_settings WHERE id = TRUE`)
	}
	if err != nil {
		return fmt.Errorf("upsert finance settings: %w", err)
	}

	if _, err := tx.Exec(ctx, `DELETE FROM finance_expense_limit_settings`); err != nil {
		return fmt.Errorf("clear finance expense limit settings: %w", err)
	}

	percents := settings.ExpenseLimitPercents()
	for _, category := range domain.ExpenseCategories() {
		percent, ok := percents[category.Code]
		if !ok {
			continue
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO finance_expense_limit_settings (category, percent_basis_points)
			VALUES ($1, $2)
		`, string(category.Code), percent.BasisPoints()); err != nil {
			return fmt.Errorf("insert finance expense limit setting: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit finance settings transaction: %w", err)
	}
	return nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanExpenseActual(row rowScanner) (domain.MonthlyExpenseActual, error) {
	var (
		year          int
		month         int
		restaurants   int64
		groceries     int64
		personal      int64
		utilities     int64
		transport     int64
		gifts         int64
		investments   int64
		entertainment int64
		education     int64
	)
	if err := row.Scan(
		&year,
		&month,
		&restaurants,
		&groceries,
		&personal,
		&utilities,
		&transport,
		&gifts,
		&investments,
		&entertainment,
		&education,
	); err != nil {
		return domain.MonthlyExpenseActual{}, err
	}
	return domain.NewMonthlyExpenseActual(year, month, map[domain.ExpenseCategory]domain.Money{
		domain.ExpenseCategoryRestaurants:   domain.MustMoneyFromKopecks(restaurants),
		domain.ExpenseCategoryGroceries:     domain.MustMoneyFromKopecks(groceries),
		domain.ExpenseCategoryPersonal:      domain.MustMoneyFromKopecks(personal),
		domain.ExpenseCategoryUtilities:     domain.MustMoneyFromKopecks(utilities),
		domain.ExpenseCategoryTransport:     domain.MustMoneyFromKopecks(transport),
		domain.ExpenseCategoryGifts:         domain.MustMoneyFromKopecks(gifts),
		domain.ExpenseCategoryInvestments:   domain.MustMoneyFromKopecks(investments),
		domain.ExpenseCategoryEntertainment: domain.MustMoneyFromKopecks(entertainment),
		domain.ExpenseCategoryEducation:     domain.MustMoneyFromKopecks(education),
	})
}

func scanIncomeActual(row rowScanner) (domain.MonthlyIncomeActual, error) {
	var (
		year             int
		month            int
		salaryKopecks    int64
		bonusBasisPoints int64
		totalKopecks     int64
	)
	if err := row.Scan(&year, &month, &salaryKopecks, &bonusBasisPoints, &totalKopecks); err != nil {
		return domain.MonthlyIncomeActual{}, err
	}
	return domain.NewMonthlyIncomeActual(
		year,
		month,
		domain.MustMoneyFromKopecks(salaryKopecks),
		domain.MustPercentFromBasisPoints(bonusBasisPoints),
		domain.MustMoneyFromKopecks(totalKopecks),
	)
}

func amount(actual domain.MonthlyExpenseActual, category domain.ExpenseCategory) int64 {
	return actual.CategoryAmount(category).Kopecks()
}
