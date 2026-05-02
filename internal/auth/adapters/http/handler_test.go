package http

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/anton415/anton415-hub/internal/auth"
)

func TestSuccessRedirectForKeepsConfiguredOrigin(t *testing.T) {
	config := Config{SuccessRedirect: "https://anton415.ru/todo"}

	got := config.successRedirectFor("/finance?tab=overview")
	want := "https://anton415.ru/finance?tab=overview"

	if got != want {
		t.Fatalf("successRedirectFor() = %q, want %q", got, want)
	}
}

func TestSuccessRedirectForRejectsExternalRedirects(t *testing.T) {
	config := Config{SuccessRedirect: "https://anton415.ru/todo"}

	got := config.successRedirectFor("//evil.example/path")
	want := "https://anton415.ru/todo"

	if got != want {
		t.Fatalf("successRedirectFor() = %q, want %q", got, want)
	}
}

func TestSuccessRedirectForUsesConfiguredDefaultWithoutRequestedPath(t *testing.T) {
	config := Config{SuccessRedirect: "https://anton415.ru/todo"}

	got := config.successRedirectFor("")
	want := "https://anton415.ru/todo"

	if got != want {
		t.Fatalf("successRedirectFor() = %q, want %q", got, want)
	}
}

func TestSessionCookieUsesConfiguredDomain(t *testing.T) {
	handler := Handler{config: Config{
		CookieName:   "anton415_hub_session",
		CookieDomain: ".anton415.ru",
	}}

	cookie := handler.sessionCookie(authSession())

	if cookie.Domain != "anton415.ru" {
		t.Fatalf("Domain = %q, want anton415.ru", cookie.Domain)
	}
}

func TestRateLimitAllowsConfiguredEmailStartRequests(t *testing.T) {
	now := time.Date(2026, 5, 2, 10, 0, 0, 0, time.UTC)
	service := &stubService{}
	router := NewRouter(service, Config{
		RateLimit: RateLimitConfig{
			Enabled: true,
			Limit:   2,
			Window:  time.Minute,
			Now: func() time.Time {
				return now
			},
		},
	})

	for i := 0; i < 2; i++ {
		response := performAuthRequest(router, http.MethodPost, "/email/start", `{"email":"anton@example.com"}`)

		if response.Code != http.StatusAccepted {
			t.Fatalf("request %d status = %d, want %d", i+1, response.Code, http.StatusAccepted)
		}
	}
	if service.startEmailCalls != 2 {
		t.Fatalf("StartEmailLogin calls = %d, want 2", service.startEmailCalls)
	}
}

func TestRateLimitBlocksEmailStartAfterLimit(t *testing.T) {
	now := time.Date(2026, 5, 2, 10, 0, 0, 0, time.UTC)
	service := &stubService{}
	router := NewRouter(service, Config{
		RateLimit: RateLimitConfig{
			Enabled: true,
			Limit:   1,
			Window:  time.Minute,
			Now: func() time.Time {
				return now
			},
		},
	})

	first := performAuthRequest(router, http.MethodPost, "/email/start", `{"email":" Anton@Example.com "}`)
	blocked := performAuthRequest(router, http.MethodPost, "/email/start", `{"email":"anton@example.com"}`)

	if first.Code != http.StatusAccepted {
		t.Fatalf("first status = %d, want %d", first.Code, http.StatusAccepted)
	}
	if blocked.Code != http.StatusTooManyRequests {
		t.Fatalf("blocked status = %d, want %d", blocked.Code, http.StatusTooManyRequests)
	}
	if blocked.Header().Get("Retry-After") != "60" {
		t.Fatalf("Retry-After = %q, want 60", blocked.Header().Get("Retry-After"))
	}
	if service.startEmailCalls != 1 {
		t.Fatalf("StartEmailLogin calls = %d, want blocked request to stop before service", service.startEmailCalls)
	}
}

func TestRateLimitResetsEmailStartAfterWindow(t *testing.T) {
	now := time.Date(2026, 5, 2, 10, 0, 0, 0, time.UTC)
	service := &stubService{}
	router := NewRouter(service, Config{
		RateLimit: RateLimitConfig{
			Enabled: true,
			Limit:   1,
			Window:  time.Minute,
			Now: func() time.Time {
				return now
			},
		},
	})

	first := performAuthRequest(router, http.MethodPost, "/email/start", `{"email":"anton@example.com"}`)
	blocked := performAuthRequest(router, http.MethodPost, "/email/start", `{"email":"anton@example.com"}`)
	now = now.Add(time.Minute)
	reset := performAuthRequest(router, http.MethodPost, "/email/start", `{"email":"anton@example.com"}`)

	if first.Code != http.StatusAccepted {
		t.Fatalf("first status = %d, want %d", first.Code, http.StatusAccepted)
	}
	if blocked.Code != http.StatusTooManyRequests {
		t.Fatalf("blocked status = %d, want %d", blocked.Code, http.StatusTooManyRequests)
	}
	if reset.Code != http.StatusAccepted {
		t.Fatalf("reset status = %d, want %d", reset.Code, http.StatusAccepted)
	}
	if service.startEmailCalls != 2 {
		t.Fatalf("StartEmailLogin calls = %d, want 2 allowed requests", service.startEmailCalls)
	}
}

func TestRateLimitBlocksOAuthStartByProviderAndClientIP(t *testing.T) {
	now := time.Date(2026, 5, 2, 10, 0, 0, 0, time.UTC)
	service := &stubService{authCodeURL: "https://oauth.example/authorize"}
	router := NewRouter(service, Config{
		RateLimit: RateLimitConfig{
			Enabled: true,
			Limit:   1,
			Window:  time.Minute,
			Now: func() time.Time {
				return now
			},
		},
	})

	first := performAuthRequest(router, http.MethodGet, "/yandex/start", "")
	blocked := performAuthRequest(router, http.MethodGet, "/yandex/start", "")
	otherProvider := performAuthRequest(router, http.MethodGet, "/github/start", "")

	if first.Code != http.StatusFound {
		t.Fatalf("first status = %d, want %d", first.Code, http.StatusFound)
	}
	if blocked.Code != http.StatusTooManyRequests {
		t.Fatalf("blocked status = %d, want %d", blocked.Code, http.StatusTooManyRequests)
	}
	if otherProvider.Code != http.StatusFound {
		t.Fatalf("other provider status = %d, want %d", otherProvider.Code, http.StatusFound)
	}
	if service.authCodeURLCalls != 2 {
		t.Fatalf("AuthCodeURL calls = %d, want first and other provider only", service.authCodeURLCalls)
	}
}

func authSession() auth.CreatedSession {
	return auth.CreatedSession{
		Token:     "token",
		ExpiresAt: time.Now().Add(time.Hour),
	}
}

func performAuthRequest(router http.Handler, method string, path string, body string) *httptest.ResponseRecorder {
	var requestBody *bytes.Reader
	if body == "" {
		requestBody = bytes.NewReader(nil)
	} else {
		requestBody = bytes.NewReader([]byte(body))
	}
	request := httptest.NewRequest(method, path, requestBody)
	request.RemoteAddr = "203.0.113.10:4242"
	if body != "" {
		request.Header.Set("Content-Type", "application/json")
	}
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)
	return response
}

type stubService struct {
	authCodeURL      string
	authCodeURLCalls int
	startEmailCalls  int
}

func (service *stubService) Providers() []auth.ProviderSummary {
	return nil
}

func (service *stubService) AuthCodeURL(_ context.Context, _ string, _ string) (string, error) {
	service.authCodeURLCalls++
	if service.authCodeURL != "" {
		return service.authCodeURL, nil
	}
	return "https://oauth.example/authorize", nil
}

func (service *stubService) CompleteOAuth(_ context.Context, _ string, _ string, _ string) (auth.CreatedSession, error) {
	return authSession(), nil
}

func (service *stubService) StartEmailLogin(_ context.Context, _ string) error {
	service.startEmailCalls++
	return nil
}

func (service *stubService) CompleteEmailLogin(_ context.Context, _ string) (auth.CreatedSession, error) {
	return authSession(), nil
}

func (service *stubService) PrincipalForToken(_ context.Context, _ string) (auth.Principal, error) {
	return auth.Principal{}, auth.ErrInvalidCredentials
}

func (service *stubService) RevokeSession(_ context.Context, _ string) error {
	return nil
}
