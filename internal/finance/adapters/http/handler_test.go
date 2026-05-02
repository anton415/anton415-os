package financehttp

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/anton415/anton415-hub/internal/finance/application"
	"github.com/anton415/anton415-hub/internal/finance/domain"
)

func TestExpenseListSaveAndValidation(t *testing.T) {
	router := newTestRouter()

	emptyResponse := performRequest(router, http.MethodGet, "/expenses?year=2026", "")
	if emptyResponse.Code != http.StatusOK {
		t.Fatalf("empty list status = %d, want %d", emptyResponse.Code, http.StatusOK)
	}
	empty := decodeData[expensesYearResponse](t, emptyResponse)
	if len(empty.Months) != 12 || empty.Months[0].CategoryAmounts["restaurants"] != "0.00" {
		t.Fatalf("empty months = %+v, want 12 zero months", empty.Months)
	}

	saveResponse := performRequest(router, http.MethodPut, "/expenses/2026/4", `{"category_amounts":{"restaurants":"1500.00","investments":"1000.00"}}`)
	if saveResponse.Code != http.StatusOK {
		t.Fatalf("save status = %d, want %d; body=%s", saveResponse.Code, http.StatusOK, saveResponse.Body.String())
	}
	saved := decodeData[expenseMonthResponse](t, saveResponse)
	if saved.TotalAmount != "2500.00" || saved.SpendingTotalAmount != "1500.00" {
		t.Fatalf("saved totals = %+v, want total 2500 and spending 1500", saved)
	}

	invalidRequests := map[string]string{
		"unknown category": `{"category_amounts":{"unknown":"1.00"}}`,
		"negative amount":  `{"category_amounts":{"restaurants":"-1.00"}}`,
		"too many cents":   `{"category_amounts":{"restaurants":"1.001"}}`,
	}
	for label, body := range invalidRequests {
		response := performRequest(router, http.MethodPut, "/expenses/2026/4", body)
		if response.Code != http.StatusBadRequest {
			t.Fatalf("%s status = %d, want %d; body=%s", label, response.Code, http.StatusBadRequest, response.Body.String())
		}
	}
}

func TestIncomeListSaveAndValidation(t *testing.T) {
	router := newTestRouter()

	saveResponse := performRequest(router, http.MethodPut, "/income/2026/4", `{"salary_amount":"200000.00","bonus_percent":"25.00","total_amount":"250000.00"}`)
	if saveResponse.Code != http.StatusOK {
		t.Fatalf("save status = %d, want %d; body=%s", saveResponse.Code, http.StatusOK, saveResponse.Body.String())
	}
	saved := decodeData[incomeMonthResponse](t, saveResponse)
	if saved.SalaryAmount != "200000.00" || saved.BonusPercent != "25.00" || saved.TotalAmount != "250000.00" {
		t.Fatalf("saved income = %+v, want salary 200000.00 bonus 25.00 total 250000.00", saved)
	}

	listResponse := performRequest(router, http.MethodGet, "/income?year=2026", "")
	if listResponse.Code != http.StatusOK {
		t.Fatalf("list status = %d, want %d", listResponse.Code, http.StatusOK)
	}
	income := decodeData[incomeYearResponse](t, listResponse)
	if len(income.Months) != 12 || income.AnnualTotalAmount != "250000.00" || income.AverageMonthlyTotalAmount != "250000.00" {
		t.Fatalf("income year = %+v, want one filled month", income)
	}

	invalidResponse := performRequest(router, http.MethodPut, "/income/2026/13", `{"total_amount":"1.00"}`)
	if invalidResponse.Code != http.StatusBadRequest {
		t.Fatalf("invalid month status = %d, want %d", invalidResponse.Code, http.StatusBadRequest)
	}

	invalidAmountResponse := performRequest(router, http.MethodPut, "/income/2026/4", `{"total_amount":"1.001"}`)
	if invalidAmountResponse.Code != http.StatusBadRequest {
		t.Fatalf("invalid amount status = %d, want %d", invalidAmountResponse.Code, http.StatusBadRequest)
	}

	invalidPercentResponse := performRequest(router, http.MethodPut, "/income/2026/4", `{"bonus_percent":"1.001"}`)
	if invalidPercentResponse.Code != http.StatusBadRequest {
		t.Fatalf("invalid percent status = %d, want %d", invalidPercentResponse.Code, http.StatusBadRequest)
	}
}

func performRequest(router http.Handler, method string, target string, body string) *httptest.ResponseRecorder {
	response := httptest.NewRecorder()
	requestBody := bytes.NewBufferString(body)
	router.ServeHTTP(response, httptest.NewRequest(method, target, requestBody))
	return response
}

func decodeData[T any](t *testing.T, response *httptest.ResponseRecorder) T {
	t.Helper()

	var envelope struct {
		Data T `json:"data"`
	}
	if err := json.NewDecoder(response.Body).Decode(&envelope); err != nil {
		t.Fatalf("decode data response: %v", err)
	}
	return envelope.Data
}

func newTestRouter() http.Handler {
	store := newMemoryStore()
	service := application.NewService(application.Dependencies{Expenses: store, Income: store})
	return NewRouter(service)
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
