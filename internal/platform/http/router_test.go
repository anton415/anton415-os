package platformhttp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/anton415/anton415-hub/internal/platform/config"
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

func TestMeEndpointReportsDevBypassSession(t *testing.T) {
	router := NewRouter(Dependencies{Config: config.Config{
		AppVersion:    "test",
		AuthDevBypass: true,
		AuthDevEmail:  "local@example.com",
	}})

	request := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}

	var body struct {
		Data struct {
			Authenticated bool `json:"authenticated"`
			User          struct {
				Email    string `json:"email"`
				Provider string `json:"provider"`
			} `json:"user"`
		} `json:"data"`
	}
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if !body.Data.Authenticated {
		t.Fatal("authenticated = false, want true")
	}
	if body.Data.User.Email != "local@example.com" || body.Data.User.Provider != "dev" {
		t.Fatalf("user = %+v, want local dev user", body.Data.User)
	}
}

func TestProductRoutesRequireAuthentication(t *testing.T) {
	router := NewRouter(Dependencies{Config: config.Config{AppVersion: "test"}})

	for _, path := range []string{
		"/api/v1/todo/tasks",
		"/api/v1/finance/expenses?year=2026",
	} {
		t.Run(path, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, path, nil)
			response := httptest.NewRecorder()

			router.ServeHTTP(response, request)

			if response.Code != http.StatusUnauthorized {
				t.Fatalf("status = %d, want %d", response.Code, http.StatusUnauthorized)
			}
		})
	}
}

func TestSPAHandlerServesExistingAssetFromStaticDir(t *testing.T) {
	staticDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(staticDir, "index.html"), []byte("<!doctype html>index"), 0o644); err != nil {
		t.Fatalf("write index.html: %v", err)
	}
	if err := os.Mkdir(filepath.Join(staticDir, "assets"), 0o755); err != nil {
		t.Fatalf("mkdir assets: %v", err)
	}
	if err := os.WriteFile(filepath.Join(staticDir, "assets", "app.js"), []byte("console.log('asset')"), 0o644); err != nil {
		t.Fatalf("write app.js: %v", err)
	}

	request := httptest.NewRequest(http.MethodGet, "/assets/app.js", nil)
	response := httptest.NewRecorder()

	spaHandler(staticDir).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}
	if body := response.Body.String(); body != "console.log('asset')" {
		t.Fatalf("body = %q, want asset body", body)
	}
}

func TestSPAHandlerFallsBackToIndexForClientRoute(t *testing.T) {
	staticDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(staticDir, "index.html"), []byte("<!doctype html>index"), 0o644); err != nil {
		t.Fatalf("write index.html: %v", err)
	}

	request := httptest.NewRequest(http.MethodGet, "/todo/today", nil)
	response := httptest.NewRecorder()

	spaHandler(staticDir).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}
	if body := response.Body.String(); body != "<!doctype html>index" {
		t.Fatalf("body = %q, want index body", body)
	}
}

func TestSPAHandlerServesIndexForRoot(t *testing.T) {
	staticDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(staticDir, "index.html"), []byte("<!doctype html>index"), 0o644); err != nil {
		t.Fatalf("write index.html: %v", err)
	}

	request := httptest.NewRequest(http.MethodGet, "/", nil)
	response := httptest.NewRecorder()

	spaHandler(staticDir).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}
	if body := response.Body.String(); body != "<!doctype html>index" {
		t.Fatalf("body = %q, want index body", body)
	}
}
