package config

import (
	"fmt"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// Локальный порт 15432 выбран, чтобы не конфликтовать с уже установленным Postgres на 5432.
const defaultDatabaseURL = "postgres://anton415:anton415@localhost:15432/anton415_hub?sslmode=disable"

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
	AuthCookieDomain    string
	AuthSessionTTL      time.Duration
	AuthTokenTTL        time.Duration
	AuthCookieSecure    bool
	AuthDevBypass       bool
	AuthDevEmail        string
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
		DatabaseURL:         databaseURLFromEnv(),
		HTTPAddr:            httpAddrFromEnv(),
		LogLevel:            stringFromEnv("LOG_LEVEL", "info"),
		ShutdownTimeout:     shutdownTimeout,
		WebOrigin:           webOrigin,
		StaticDir:           stringFromEnv("STATIC_DIR", ""),
		AuthAllowedEmails:   listFromEnv("AUTH_ALLOWED_EMAILS"),
		AuthCallbackBaseURL: stringFromEnv("AUTH_CALLBACK_BASE_URL", "http://localhost:8080"),
		AuthSuccessRedirect: stringFromEnv("AUTH_SUCCESS_REDIRECT", webOrigin+"/todo"),
		AuthFailureRedirect: stringFromEnv("AUTH_FAILURE_REDIRECT", webOrigin+"/"),
		AuthSessionCookie:   stringFromEnv("AUTH_SESSION_COOKIE", "anton415_hub_session"),
		AuthCookieDomain:    stringFromEnv("AUTH_COOKIE_DOMAIN", ""),
		AuthSessionTTL:      sessionTTL,
		AuthTokenTTL:        tokenTTL,
		AuthCookieSecure:    boolFromEnv("AUTH_COOKIE_SECURE", appEnv == "production"),
		AuthDevBypass:       appEnv != "production" && boolFromEnv("AUTH_DEV_BYPASS", false),
		AuthDevEmail:        stringFromEnv("AUTH_DEV_EMAIL", "dev@localhost"),
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

func databaseURLFromEnv() string {
	if value := strings.TrimSpace(os.Getenv("DATABASE_URL")); value != "" {
		return value
	}

	password := strings.TrimSpace(os.Getenv("POSTGRES_PASSWORD"))
	if password == "" {
		return defaultDatabaseURL
	}

	dbURL := url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(stringFromEnv("POSTGRES_USER", "anton415"), password),
		Host:   net.JoinHostPort(stringFromEnv("POSTGRES_HOST", "localhost"), stringFromEnv("POSTGRES_PORT", "15432")),
		Path:   stringFromEnv("POSTGRES_DB", "anton415_hub"),
	}
	query := dbURL.Query()
	query.Set("sslmode", stringFromEnv("POSTGRES_SSLMODE", "disable"))
	dbURL.RawQuery = query.Encode()
	return dbURL.String()
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
