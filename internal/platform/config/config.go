package config

import (
	"fmt"
	"os"
	"strings"
	"time"
)

// Локальный порт 15432 выбран, чтобы не конфликтовать с уже установленным Postgres на 5432.
const defaultDatabaseURL = "postgres://anton415:anton415@localhost:15432/anton415_os?sslmode=disable"

type Config struct {
	AppEnv          string
	AppVersion      string
	DatabaseURL     string
	HTTPAddr        string
	LogLevel        string
	ShutdownTimeout time.Duration
	WebOrigin       string
}

func Load() (Config, error) {
	// Ошибки парсинга конфига считаются ошибками старта, а не runtime-состоянием.
	shutdownTimeout, err := durationFromEnv("SHUTDOWN_TIMEOUT", 10*time.Second)
	if err != nil {
		return Config{}, err
	}

	return Config{
		AppEnv:          stringFromEnv("APP_ENV", "development"),
		AppVersion:      stringFromEnv("APP_VERSION", "dev"),
		DatabaseURL:     stringFromEnv("DATABASE_URL", defaultDatabaseURL),
		HTTPAddr:        httpAddrFromEnv(),
		LogLevel:        stringFromEnv("LOG_LEVEL", "info"),
		ShutdownTimeout: shutdownTimeout,
		WebOrigin:       stringFromEnv("WEB_ORIGIN", "http://localhost:5173"),
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
