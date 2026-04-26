package platformhttp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/anton415/anton415-os/internal/platform/config"
)

func TestHealthReportsDegradedWithoutDatabase(t *testing.T) {
	router := NewRouter(Dependencies{Config: config.Config{AppVersion: "test"}})

	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusServiceUnavailable)
	}

	var body healthResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if body.Status != "degraded" {
		t.Fatalf("body status = %q, want degraded", body.Status)
	}
	if body.Checks["database"].Status != "unavailable" {
		t.Fatalf("database status = %q, want unavailable", body.Checks["database"].Status)
	}
}

func TestMeEndpointReportsUnauthenticatedSession(t *testing.T) {
	router := NewRouter(Dependencies{Config: config.Config{AppVersion: "test"}})

	request := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}

	var body struct {
		Data struct {
			Authenticated bool `json:"authenticated"`
		} `json:"data"`
	}
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if body.Data.Authenticated {
		t.Fatal("authenticated = true, want false")
	}
}

func TestTodoRequiresAuthentication(t *testing.T) {
	router := NewRouter(Dependencies{Config: config.Config{AppVersion: "test"}})

	request := httptest.NewRequest(http.MethodGet, "/api/v1/todo/tasks", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusUnauthorized)
	}
}
