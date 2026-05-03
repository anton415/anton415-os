package financehttp

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/anton415/anton415-hub/internal/finance/application"
	"github.com/anton415/anton415-hub/internal/finance/domain"
	"github.com/anton415/anton415-hub/internal/platform/httpjson"
)

type Service interface {
	ListExpenses(ctx context.Context, year int) (application.ExpensesYear, error)
	SaveExpense(ctx context.Context, year int, month int, input application.SaveExpenseActualInput) (domain.MonthlyExpenseActual, error)
	ListIncome(ctx context.Context, year int) (application.IncomeYear, error)
	SaveIncome(ctx context.Context, year int, month int, input application.SaveIncomeActualInput) (domain.MonthlyIncomeActual, error)
	ListSettings(ctx context.Context) (domain.FinanceSettings, error)
	SaveSettings(ctx context.Context, input application.SaveFinanceSettingsInput) (domain.FinanceSettings, error)
}

type Handler struct {
	service Service
}

func NewRouter(service Service) http.Handler {
	handler := Handler{service: service}
	r := chi.NewRouter()

	r.Get("/expenses", handler.listExpenses)
	r.Put("/expenses/{year}/{month}", handler.saveExpense)
	r.Get("/income", handler.listIncome)
	r.Put("/income/{year}/{month}", handler.saveIncome)
	r.Get("/settings", handler.getSettings)
	r.Put("/settings", handler.saveSettings)

	return r
}

func (handler Handler) listExpenses(w http.ResponseWriter, r *http.Request) {
	year, ok := queryYear(w, r)
	if !ok {
		return
	}

	expenses, err := handler.service.ListExpenses(r.Context(), year)
	if err != nil {
		writeError(w, err)
		return
	}

	writeData(w, http.StatusOK, expensesYearDTO(expenses))
}

func (handler Handler) saveExpense(w http.ResponseWriter, r *http.Request) {
	year, month, ok := pathYearMonth(w, r)
	if !ok {
		return
	}

	var request updateExpenseRequest
	if !decodeRequest(w, r, &request) {
		return
	}

	amounts, err := categoryAmounts(request.CategoryAmounts)
	if err != nil {
		writeError(w, err)
		return
	}

	actual, err := handler.service.SaveExpense(r.Context(), year, month, application.SaveExpenseActualInput{
		CategoryAmounts: amounts,
	})
	if err != nil {
		writeError(w, err)
		return
	}

	writeData(w, http.StatusOK, expenseMonthDTO(actual))
}

func (handler Handler) listIncome(w http.ResponseWriter, r *http.Request) {
	year, ok := queryYear(w, r)
	if !ok {
		return
	}

	income, err := handler.service.ListIncome(r.Context(), year)
	if err != nil {
		writeError(w, err)
		return
	}

	writeData(w, http.StatusOK, incomeYearDTO(income))
}

func (handler Handler) saveIncome(w http.ResponseWriter, r *http.Request) {
	year, month, ok := pathYearMonth(w, r)
	if !ok {
		return
	}

	var request updateIncomeRequest
	if !decodeRequest(w, r, &request) {
		return
	}

	salaryAmount, err := parseOptionalMoney(request.SalaryAmount)
	if err != nil {
		writeError(w, err)
		return
	}
	bonusPercent, err := parseOptionalPercent(request.BonusPercent)
	if err != nil {
		writeError(w, err)
		return
	}
	totalAmount, err := parseOptionalMoney(request.TotalAmount)
	if err != nil {
		writeError(w, err)
		return
	}

	actual, err := handler.service.SaveIncome(r.Context(), year, month, application.SaveIncomeActualInput{
		SalaryAmount: salaryAmount,
		BonusPercent: bonusPercent,
		TotalAmount:  totalAmount,
	})
	if err != nil {
		writeError(w, err)
		return
	}

	writeData(w, http.StatusOK, incomeMonthDTO(actual))
}

func (handler Handler) getSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := handler.service.ListSettings(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}

	writeData(w, http.StatusOK, settingsDTO(settings))
}

func (handler Handler) saveSettings(w http.ResponseWriter, r *http.Request) {
	var request updateSettingsRequest
	if !decodeRequest(w, r, &request) {
		return
	}

	salaryAmount, err := parseOptionalMoney(request.SalaryAmount)
	if err != nil {
		writeError(w, err)
		return
	}
	bonusPercent, err := parseOptionalPercent(request.BonusPercent)
	if err != nil {
		writeError(w, err)
		return
	}
	expenseLimitPercents, err := categoryPercents(request.ExpenseLimitPercents)
	if err != nil {
		writeError(w, err)
		return
	}

	settings, err := handler.service.SaveSettings(r.Context(), application.SaveFinanceSettingsInput{
		SalaryAmount:         salaryAmount,
		BonusPercent:         bonusPercent,
		ExpenseLimitPercents: expenseLimitPercents,
	})
	if err != nil {
		writeError(w, err)
		return
	}

	writeData(w, http.StatusOK, settingsDTO(settings))
}

type updateExpenseRequest struct {
	CategoryAmounts map[string]string `json:"category_amounts"`
}

type updateIncomeRequest struct {
	SalaryAmount string `json:"salary_amount"`
	BonusPercent string `json:"bonus_percent"`
	TotalAmount  string `json:"total_amount"`
}

type updateSettingsRequest struct {
	SalaryAmount         string            `json:"salary_amount"`
	BonusPercent         string            `json:"bonus_percent"`
	ExpenseLimitPercents map[string]string `json:"expense_limit_percents"`
}

type categoryResponse struct {
	Code           string `json:"code"`
	Label          string `json:"label"`
	Classification string `json:"classification"`
}

type expenseMonthResponse struct {
	Month               int               `json:"month"`
	CategoryAmounts     map[string]string `json:"category_amounts"`
	TotalAmount         string            `json:"total_amount"`
	SpendingTotalAmount string            `json:"spending_total_amount"`
}

type expensesYearResponse struct {
	Year                      int                    `json:"year"`
	Currency                  string                 `json:"currency"`
	Categories                []categoryResponse     `json:"categories"`
	Months                    []expenseMonthResponse `json:"months"`
	AnnualTotalsByCategory    map[string]string      `json:"annual_totals_by_category"`
	AnnualTotalAmount         string                 `json:"annual_total_amount"`
	AnnualSpendingTotalAmount string                 `json:"annual_spending_total_amount"`
}

type incomeMonthResponse struct {
	Month        int    `json:"month"`
	SalaryAmount string `json:"salary_amount"`
	BonusPercent string `json:"bonus_percent"`
	TotalAmount  string `json:"total_amount"`
}

type incomeYearResponse struct {
	Year                      int                   `json:"year"`
	Currency                  string                `json:"currency"`
	Months                    []incomeMonthResponse `json:"months"`
	AnnualTotalAmount         string                `json:"annual_total_amount"`
	AverageMonthlyTotalAmount string                `json:"average_monthly_total_amount"`
}

type financeSettingsResponse struct {
	Currency             string            `json:"currency"`
	SalaryAmount         *string           `json:"salary_amount,omitempty"`
	BonusPercent         *string           `json:"bonus_percent,omitempty"`
	ExpenseLimitPercents map[string]string `json:"expense_limit_percents"`
}

type responseEnvelope struct {
	Data any `json:"data"`
}

type errorEnvelope struct {
	Error apiError `json:"error"`
}

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func queryYear(w http.ResponseWriter, r *http.Request) (int, bool) {
	return parseYear(w, r.URL.Query().Get("year"))
}

func pathYearMonth(w http.ResponseWriter, r *http.Request) (int, int, bool) {
	year, ok := parseYear(w, chi.URLParam(r, "year"))
	if !ok {
		return 0, 0, false
	}
	month, err := strconv.Atoi(chi.URLParam(r, "month"))
	if err != nil || domain.ValidateMonth(month) != nil {
		writeError(w, domain.ErrInvalidMonth)
		return 0, 0, false
	}
	return year, month, true
}

func parseYear(w http.ResponseWriter, value string) (int, bool) {
	year, err := strconv.Atoi(value)
	if err != nil || domain.ValidateYear(year) != nil {
		writeError(w, domain.ErrInvalidYear)
		return 0, false
	}
	return year, true
}

func decodeRequest(w http.ResponseWriter, r *http.Request, value any) bool {
	if err := httpjson.DecodeRequest(w, r, value); err != nil {
		if errors.Is(err, httpjson.ErrRequestBodyTooLarge) {
			writeErrorResponse(w, http.StatusRequestEntityTooLarge, "payload_too_large", "request body is too large")
			return false
		}
		writeErrorResponse(w, http.StatusBadRequest, "bad_request", "request body must be valid JSON")
		return false
	}
	return true
}

func categoryAmounts(raw map[string]string) (map[domain.ExpenseCategory]domain.Money, error) {
	amounts := map[domain.ExpenseCategory]domain.Money{}
	for key, value := range raw {
		category, err := domain.ParseExpenseCategory(key)
		if err != nil {
			return nil, err
		}
		amount, err := domain.ParseMoney(value)
		if err != nil {
			return nil, err
		}
		amounts[category] = amount
	}
	return amounts, nil
}

func categoryPercents(raw map[string]string) (map[domain.ExpenseCategory]domain.Percent, error) {
	percents := map[domain.ExpenseCategory]domain.Percent{}
	for key, value := range raw {
		if value == "" {
			continue
		}
		category, err := domain.ParseExpenseCategory(key)
		if err != nil {
			return nil, err
		}
		percent, err := domain.ParsePercent(value)
		if err != nil {
			return nil, err
		}
		percents[category] = percent
	}
	return percents, nil
}

func parseOptionalMoney(value string) (domain.Money, error) {
	if value == "" {
		return domain.ZeroMoney(), nil
	}
	return domain.ParseMoney(value)
}

func parseOptionalPercent(value string) (domain.Percent, error) {
	if value == "" {
		return domain.ZeroPercent(), nil
	}
	return domain.ParsePercent(value)
}

func expensesYearDTO(expenses application.ExpensesYear) expensesYearResponse {
	months := make([]expenseMonthResponse, 0, len(expenses.Months))
	for _, month := range expenses.Months {
		months = append(months, expenseMonthDTO(month))
	}

	return expensesYearResponse{
		Year:                      expenses.Year,
		Currency:                  "RUB",
		Categories:                categoryDTOs(),
		Months:                    months,
		AnnualTotalsByCategory:    moneyMapDTO(expenses.AnnualTotalsByCategory),
		AnnualTotalAmount:         expenses.AnnualTotal.Decimal(),
		AnnualSpendingTotalAmount: expenses.AnnualSpendingTotal.Decimal(),
	}
}

func expenseMonthDTO(month domain.MonthlyExpenseActual) expenseMonthResponse {
	return expenseMonthResponse{
		Month:               month.Month,
		CategoryAmounts:     moneyMapDTO(month.CategoryAmounts()),
		TotalAmount:         month.Total().Decimal(),
		SpendingTotalAmount: month.SpendingTotal().Decimal(),
	}
}

func incomeYearDTO(income application.IncomeYear) incomeYearResponse {
	months := make([]incomeMonthResponse, 0, len(income.Months))
	for _, month := range income.Months {
		months = append(months, incomeMonthDTO(month))
	}

	return incomeYearResponse{
		Year:                      income.Year,
		Currency:                  "RUB",
		Months:                    months,
		AnnualTotalAmount:         income.AnnualTotal.Decimal(),
		AverageMonthlyTotalAmount: income.AverageMonthlyTotal.Decimal(),
	}
}

func incomeMonthDTO(month domain.MonthlyIncomeActual) incomeMonthResponse {
	return incomeMonthResponse{
		Month:        month.Month,
		SalaryAmount: month.SalaryAmount.Decimal(),
		BonusPercent: month.BonusPercent.Decimal(),
		TotalAmount:  month.TotalAmount.Decimal(),
	}
}

func settingsDTO(settings domain.FinanceSettings) financeSettingsResponse {
	var salaryAmount *string
	var bonusPercent *string
	if settings.HasIncomeSettings {
		salary := settings.SalaryAmount.Decimal()
		bonus := settings.BonusPercent.Decimal()
		salaryAmount = &salary
		bonusPercent = &bonus
	}

	return financeSettingsResponse{
		Currency:             "RUB",
		SalaryAmount:         salaryAmount,
		BonusPercent:         bonusPercent,
		ExpenseLimitPercents: percentMapDTO(settings.ExpenseLimitPercents()),
	}
}

func categoryDTOs() []categoryResponse {
	categories := domain.ExpenseCategories()
	response := make([]categoryResponse, 0, len(categories))
	for _, category := range categories {
		response = append(response, categoryResponse{
			Code:           string(category.Code),
			Label:          category.Label,
			Classification: string(category.Classification),
		})
	}
	return response
}

func percentMapDTO(percents map[domain.ExpenseCategory]domain.Percent) map[string]string {
	response := map[string]string{}
	for _, category := range domain.ExpenseCategories() {
		percent, ok := percents[category.Code]
		if !ok {
			continue
		}
		response[string(category.Code)] = percent.Decimal()
	}
	return response
}

func moneyMapDTO(amounts map[domain.ExpenseCategory]domain.Money) map[string]string {
	response := map[string]string{}
	for _, category := range domain.ExpenseCategories() {
		response[string(category.Code)] = amounts[category.Code].Decimal()
	}
	return response
}

func writeData(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(responseEnvelope{Data: data}); err != nil {
		slog.Error("write finance json response", slog.String("error", err.Error()))
	}
}

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrInvalidYear):
		writeErrorResponse(w, http.StatusBadRequest, "validation_error", "year must be between 1 and 9999")
	case errors.Is(err, domain.ErrInvalidMonth):
		writeErrorResponse(w, http.StatusBadRequest, "validation_error", "month must be between 1 and 12")
	case errors.Is(err, domain.ErrInvalidExpenseCategory):
		writeErrorResponse(w, http.StatusBadRequest, "validation_error", "expense category is not supported")
	case errors.Is(err, domain.ErrInvalidMoney):
		writeErrorResponse(w, http.StatusBadRequest, "validation_error", "money amount must be a non-negative RUB decimal with up to 2 digits")
	case errors.Is(err, domain.ErrInvalidPercent):
		writeErrorResponse(w, http.StatusBadRequest, "validation_error", "percent must be a non-negative decimal with up to 2 digits")
	default:
		slog.Error("finance handler error", slog.String("error", err.Error()))
		writeErrorResponse(w, http.StatusInternalServerError, "internal_error", "internal server error")
	}
}

func writeErrorResponse(w http.ResponseWriter, status int, code string, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(errorEnvelope{Error: apiError{Code: code, Message: message}}); err != nil {
		slog.Error("write finance error response", slog.String("error", err.Error()))
	}
}
