package logging

import (
	"log/slog"
	"os"
	"strings"
)

func New(level string) *slog.Logger {
	handlerOptions := &slog.HandlerOptions{Level: parseLevel(level)}
	return slog.New(slog.NewJSONHandler(os.Stdout, handlerOptions))
}

func parseLevel(value string) slog.Leveler {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
