package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Локальный порт 15432 выбран, чтобы не конфликтовать с уже установленным Postgres на 5432.
const defaultDatabaseURL = "postgres://anton415:anton415@localhost:15432/anton415_os?sslmode=disable"

type Config struct {
	AppEnv              string
	AppVersion          string
	DatabaseURL         string
	HTTPAddr            string
	LogLevel            string
	ShutdownTimeout     time.Duration
	WebOrigin           string
	StaticDir           string
	AuthAllowedEmails   []string
	AuthCallbackBaseURL string
	AuthSuccessRedirect string
	AuthFailureRedirect string
	AuthSessionCookie   string
	AuthSessionTTL      time.Duration
	AuthTokenTTL        time.Duration
	AuthCookieSecure    bool
	EmailFrom           string
	SMTPHost            string
	SMTPPort            string
	SMTPUsername        string
	SMTPPassword        string
	YandexOAuth         OAuthClientConfig
	GitHubOAuth         OAuthClientConfig
	VKOAuth             OAuthClientConfig
}

type OAuthClientConfig struct {
	ClientID     string
	ClientSecret string
	AuthURL      string
	TokenURL     string
	UserInfoURL  string
}

func Load() (Config, error) {
	// Ошибки парсинга конфига считаются ошибками старта, а не runtime-состоянием.
	shutdownTimeout, err := durationFromEnv("SHUTDOWN_TIMEOUT", 10*time.Second)
	if err != nil {
		return Config{}, err
	}
	sessionTTL, err := durationFromEnv("AUTH_SESSION_TTL", 30*24*time.Hour)
	if err != nil {
		return Config{}, err
	}
	tokenTTL, err := durationFromEnv("AUTH_TOKEN_TTL", 15*time.Minute)
	if err != nil {
		return Config{}, err
	}

	appEnv := stringFromEnv("APP_ENV", "development")
	webOrigin := stringFromEnv("WEB_ORIGIN", "http://localhost:5173")

	return Config{
		AppEnv:              appEnv,
		AppVersion:          stringFromEnv("APP_VERSION", "dev"),
		DatabaseURL:         stringFromEnv("DATABASE_URL", defaultDatabaseURL),
		HTTPAddr:            httpAddrFromEnv(),
		LogLevel:            stringFromEnv("LOG_LEVEL", "info"),
		ShutdownTimeout:     shutdownTimeout,
		WebOrigin:           webOrigin,
		StaticDir:           stringFromEnv("STATIC_DIR", ""),
		AuthAllowedEmails:   listFromEnv("AUTH_ALLOWED_EMAILS"),
		AuthCallbackBaseURL: stringFromEnv("AUTH_CALLBACK_BASE_URL", "http://localhost:8080"),
		AuthSuccessRedirect: stringFromEnv("AUTH_SUCCESS_REDIRECT", webOrigin+"/todo"),
		AuthFailureRedirect: stringFromEnv("AUTH_FAILURE_REDIRECT", webOrigin+"/"),
		AuthSessionCookie:   stringFromEnv("AUTH_SESSION_COOKIE", "anton415_session"),
		AuthSessionTTL:      sessionTTL,
		AuthTokenTTL:        tokenTTL,
		AuthCookieSecure:    boolFromEnv("AUTH_COOKIE_SECURE", appEnv == "production"),
		EmailFrom:           stringFromEnv("EMAIL_FROM", ""),
		SMTPHost:            stringFromEnv("SMTP_HOST", ""),
		SMTPPort:            stringFromEnv("SMTP_PORT", "587"),
		SMTPUsername:        stringFromEnv("SMTP_USERNAME", ""),
		SMTPPassword:        stringFromEnv("SMTP_PASSWORD", ""),
		YandexOAuth: OAuthClientConfig{
			ClientID:     stringFromEnv("YANDEX_OAUTH_CLIENT_ID", ""),
			ClientSecret: stringFromEnv("YANDEX_OAUTH_CLIENT_SECRET", ""),
			AuthURL:      stringFromEnv("YANDEX_OAUTH_AUTH_URL", "https://oauth.yandex.com/authorize"),
			TokenURL:     stringFromEnv("YANDEX_OAUTH_TOKEN_URL", "https://oauth.yandex.com/token"),
			UserInfoURL:  stringFromEnv("YANDEX_OAUTH_USERINFO_URL", "https://login.yandex.ru/info?format=json"),
		},
		GitHubOAuth: OAuthClientConfig{
			ClientID:     stringFromEnv("GITHUB_OAUTH_CLIENT_ID", ""),
			ClientSecret: stringFromEnv("GITHUB_OAUTH_CLIENT_SECRET", ""),
			AuthURL:      stringFromEnv("GITHUB_OAUTH_AUTH_URL", "https://github.com/login/oauth/authorize"),
			TokenURL:     stringFromEnv("GITHUB_OAUTH_TOKEN_URL", "https://github.com/login/oauth/access_token"),
			UserInfoURL:  stringFromEnv("GITHUB_OAUTH_USERINFO_URL", "https://api.github.com/user"),
		},
		VKOAuth: OAuthClientConfig{
			ClientID:     stringFromEnv("VK_OAUTH_CLIENT_ID", ""),
			ClientSecret: stringFromEnv("VK_OAUTH_CLIENT_SECRET", ""),
			AuthURL:      stringFromEnv("VK_OAUTH_AUTH_URL", "https://oauth.vk.com/authorize"),
			TokenURL:     stringFromEnv("VK_OAUTH_TOKEN_URL", "https://oauth.vk.com/access_token"),
			UserInfoURL:  stringFromEnv("VK_OAUTH_USERINFO_URL", "https://api.vk.com/method/users.get?v=5.199"),
		},
	}, nil
}

func httpAddrFromEnv() string {
	if value := strings.TrimSpace(os.Getenv("HTTP_ADDR")); value != "" {
		return value
	}
	// PORT оставлен для совместимости с платформами, где порт передается одной переменной.
	if value := strings.TrimSpace(os.Getenv("PORT")); value != "" {
		return ":" + value
	}
	return ":8080"
}

func stringFromEnv(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func listFromEnv(key string) []string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return nil
	}

	items := strings.Split(value, ",")
	result := make([]string, 0, len(items))
	for _, item := range items {
		normalized := strings.ToLower(strings.TrimSpace(item))
		if normalized != "" {
			result = append(result, normalized)
		}
	}
	return result
}

func boolFromEnv(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func durationFromEnv(key string, fallback time.Duration) (time.Duration, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}

	parsed, err := time.ParseDuration(value)
	if err != nil {
		return 0, fmt.Errorf("parse %s: %w", key, err)
	}

	return parsed, nil
}
