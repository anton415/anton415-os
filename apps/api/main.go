package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/anton415/anton415-os/internal/platform/config"
	"github.com/anton415/anton415-os/internal/platform/db"
	platformhttp "github.com/anton415/anton415-os/internal/platform/http"
	"github.com/anton415/anton415-os/internal/platform/logging"
)

func main() {
	// Конфиг читается только из окружения, чтобы локальный запуск, Docker Compose
	// и будущий cloud runtime использовали один и тот же механизм настройки.
	cfg, err := config.Load()
	if err != nil {
		slog.Error("load config", slog.String("error", err.Error()))
		os.Exit(1)
	}

	logger := logging.New(cfg.LogLevel)
	slog.SetDefault(logger)

	rootCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// При старте API сразу проверяет доступность Postgres. Если база недоступна,
	// процесс падает явно, а не стартует в частично рабочем состоянии.
	dbCtx, cancelDB := context.WithTimeout(rootCtx, 10*time.Second)
	pool, err := db.Connect(dbCtx, cfg.DatabaseURL)
	cancelDB()
	if err != nil {
		logger.Error("connect database", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer pool.Close()

	server := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           platformhttp.NewRouter(platformhttp.Dependencies{Config: cfg, DB: pool, Logger: logger}),
		ReadHeaderTimeout: 5 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		// HTTP-сервер запускается в отдельной goroutine, чтобы main мог ждать
		// либо ошибку сервера, либо сигнал остановки процесса.
		logger.Info("api server starting", slog.String("addr", cfg.HTTPAddr), slog.String("env", cfg.AppEnv))
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
		close(serverErr)
	}()

	select {
	case <-rootCtx.Done():
		logger.Info("shutdown signal received")
	case err := <-serverErr:
		if err != nil {
			logger.Error("api server failed", slog.String("error", err.Error()))
			os.Exit(1)
		}
	}

	shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancelShutdown()

	// Graceful shutdown дает активным запросам короткое окно на завершение.
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", slog.String("error", err.Error()))
		os.Exit(1)
	}

	logger.Info("api server stopped")
}
