package config

import (
	"testing"
	"time"
)

func TestLoadUsesDefaults(t *testing.T) {
	t.Setenv("APP_ENV", "")
	t.Setenv("APP_VERSION", "")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("HTTP_ADDR", "")
	t.Setenv("PORT", "")
	t.Setenv("LOG_LEVEL", "")
	t.Setenv("SHUTDOWN_TIMEOUT", "")
	t.Setenv("WEB_ORIGIN", "")
	t.Setenv("AUTH_ALLOWED_EMAILS", "")
	t.Setenv("AUTH_SESSION_TTL", "")
	t.Setenv("AUTH_TOKEN_TTL", "")
	t.Setenv("AUTH_COOKIE_SECURE", "")
	t.Setenv("AUTH_DEV_BYPASS", "")
	t.Setenv("AUTH_DEV_EMAIL", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.AppEnv != "development" {
		t.Fatalf("AppEnv = %q, want development", cfg.AppEnv)
	}
	if cfg.HTTPAddr != ":8080" {
		t.Fatalf("HTTPAddr = %q, want :8080", cfg.HTTPAddr)
	}
	if cfg.DatabaseURL != defaultDatabaseURL {
		t.Fatalf("DatabaseURL = %q, want default", cfg.DatabaseURL)
	}
	if cfg.ShutdownTimeout != 10*time.Second {
		t.Fatalf("ShutdownTimeout = %s, want 10s", cfg.ShutdownTimeout)
	}
	if cfg.AuthCookieSecure {
		t.Fatal("AuthCookieSecure = true, want false for development defaults")
	}
	if cfg.AuthSessionTTL != 30*24*time.Hour {
		t.Fatalf("AuthSessionTTL = %s, want 720h", cfg.AuthSessionTTL)
	}
	if cfg.AuthDevBypass {
		t.Fatal("AuthDevBypass = true, want false by default")
	}
}

func TestLoadUsesPortWhenHTTPAddrIsUnset(t *testing.T) {
	t.Setenv("HTTP_ADDR", "")
	t.Setenv("PORT", "9090")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.HTTPAddr != ":9090" {
		t.Fatalf("HTTPAddr = %q, want :9090", cfg.HTTPAddr)
	}
}

func TestLoadRejectsInvalidDuration(t *testing.T) {
	t.Setenv("SHUTDOWN_TIMEOUT", "soon")

	if _, err := Load(); err == nil {
		t.Fatal("Load() error = nil, want error")
	}
}

func TestLoadParsesAuthSettings(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("AUTH_ALLOWED_EMAILS", " Anton@Example.com, alt@example.com ")
	t.Setenv("AUTH_COOKIE_SECURE", "")
	t.Setenv("AUTH_SESSION_TTL", "24h")
	t.Setenv("AUTH_TOKEN_TTL", "5m")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if !cfg.AuthCookieSecure {
		t.Fatal("AuthCookieSecure = false, want true for production defaults")
	}
	if cfg.AuthSessionTTL != 24*time.Hour {
		t.Fatalf("AuthSessionTTL = %s, want 24h", cfg.AuthSessionTTL)
	}
	if cfg.AuthTokenTTL != 5*time.Minute {
		t.Fatalf("AuthTokenTTL = %s, want 5m", cfg.AuthTokenTTL)
	}
	if len(cfg.AuthAllowedEmails) != 2 || cfg.AuthAllowedEmails[0] != "anton@example.com" {
		t.Fatalf("AuthAllowedEmails = %#v, want normalized emails", cfg.AuthAllowedEmails)
	}
}

func TestLoadEnablesDevAuthBypassOnlyOutsideProduction(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("AUTH_DEV_BYPASS", "true")
	t.Setenv("AUTH_DEV_EMAIL", "local@example.com")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if !cfg.AuthDevBypass {
		t.Fatal("AuthDevBypass = false, want true in development")
	}
	if cfg.AuthDevEmail != "local@example.com" {
		t.Fatalf("AuthDevEmail = %q, want local@example.com", cfg.AuthDevEmail)
	}

	t.Setenv("APP_ENV", "production")
	t.Setenv("AUTH_DEV_BYPASS", "true")
	cfg, err = Load()
	if err != nil {
		t.Fatalf("Load() production error = %v", err)
	}
	if cfg.AuthDevBypass {
		t.Fatal("AuthDevBypass = true, want false in production")
	}
}
