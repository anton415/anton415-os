package http

import (
	"testing"
	"time"

	"github.com/anton415/anton415-os/internal/auth"
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
		CookieName:   "anton415_session",
		CookieDomain: ".anton415.ru",
	}}

	cookie := handler.sessionCookie(authSession())

	if cookie.Domain != "anton415.ru" {
		t.Fatalf("Domain = %q, want anton415.ru", cookie.Domain)
	}
}

func authSession() auth.CreatedSession {
	return auth.CreatedSession{
		Token:     "token",
		ExpiresAt: time.Now().Add(time.Hour),
	}
}
