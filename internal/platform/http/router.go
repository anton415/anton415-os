package platformhttp

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/anton415/anton415-os/internal/platform/config"
)

type Dependencies struct {
	Config config.Config
	DB     *pgxpool.Pool
	Logger *slog.Logger
}

type healthResponse struct {
	Service string                 `json:"service"`
	Status  string                 `json:"status"`
	Version string                 `json:"version"`
	Checks  map[string]healthCheck `json:"checks"`
}

type healthCheck struct {
	Status  string `json:"status"`
	Latency string `json:"latency,omitempty"`
	Error   string `json:"error,omitempty"`
}

func NewRouter(deps Dependencies) http.Handler {
	if deps.Logger == nil {
		deps.Logger = slog.Default()
	}

	r := chi.NewRouter()
	// Middleware остается минимальным: базовая трассировка запроса, логирование,
	// восстановление после panic и CORS для локального web shell.
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(requestLogger(deps.Logger))
	r.Use(middleware.Recoverer)
	r.Use(cors(deps.Config.WebOrigin))

	r.Get("/health", healthHandler(deps))
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/me", meHandler)
	})

	return r
}

func healthHandler(deps Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Health-check проверяет не только процесс API, но и доступность Postgres.
		// Это полезно для локальной разработки и будущих runtime checks.
		dbCheck := checkDatabase(r.Context(), deps.DB)
		status := "ok"
		httpStatus := http.StatusOK

		if dbCheck.Status != "ok" {
			status = "degraded"
			httpStatus = http.StatusServiceUnavailable
		}

		writeJSON(w, httpStatus, healthResponse{
			Service: "anton415-os-api",
			Status:  status,
			Version: deps.Config.AppVersion,
			Checks: map[string]healthCheck{
				"database": dbCheck,
			},
		})
	}
}

func checkDatabase(parent context.Context, pool *pgxpool.Pool) healthCheck {
	if pool == nil {
		return healthCheck{Status: "unavailable", Error: "database pool is not configured"}
	}

	startedAt := time.Now()
	ctx, cancel := context.WithTimeout(parent, 2*time.Second)
	defer cancel()

	if err := pool.Ping(ctx); err != nil {
		return healthCheck{Status: "unavailable", Latency: time.Since(startedAt).String(), Error: err.Error()}
	}

	return healthCheck{Status: "ok", Latency: time.Since(startedAt).String()}
}

func meHandler(w http.ResponseWriter, _ *http.Request) {
	// Это не авторизация. Endpoint фиксирует single-user режим до появления реального auth.
	writeJSON(w, http.StatusOK, map[string]string{
		"id":          "single-user",
		"displayName": "Anton",
		"mode":        "single-user",
		"auth":        "not_configured",
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		slog.Error("write json response", slog.String("error", err.Error()))
	}
}
