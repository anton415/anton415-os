package platformhttp

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/anton415/anton415-hub/internal/auth"
	authhttp "github.com/anton415/anton415-hub/internal/auth/adapters/http"
	authpostgres "github.com/anton415/anton415-hub/internal/auth/adapters/postgres"
	financehttp "github.com/anton415/anton415-hub/internal/finance/adapters/http"
	financepostgres "github.com/anton415/anton415-hub/internal/finance/adapters/postgres"
	financeapp "github.com/anton415/anton415-hub/internal/finance/application"
	"github.com/anton415/anton415-hub/internal/platform/config"
	todohttp "github.com/anton415/anton415-hub/internal/todo/adapters/http"
	todopostgres "github.com/anton415/anton415-hub/internal/todo/adapters/postgres"
	todoapp "github.com/anton415/anton415-hub/internal/todo/application"
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
		authService := newAuthService(deps.Config, deps.DB)
		authConfig := authhttp.Config{
			CookieName:      deps.Config.AuthSessionCookie,
			CookieDomain:    deps.Config.AuthCookieDomain,
			CookieSecure:    deps.Config.AuthCookieSecure,
			SuccessRedirect: deps.Config.AuthSuccessRedirect,
			FailureRedirect: deps.Config.AuthFailureRedirect,
			DevBypass:       deps.Config.AuthDevBypass,
			DevEmail:        deps.Config.AuthDevEmail,
		}

		r.Use(authhttp.SessionMiddleware(authService, authConfig))
		r.Get("/me", authhttp.MeHandler)
		r.Mount("/auth", authhttp.NewRouter(authService, authConfig))

		todoRepository := todopostgres.NewRepository(deps.DB)
		todoService := todoapp.NewService(todoapp.Dependencies{
			Projects: todoRepository,
			Tasks:    todoRepository,
			Location: time.Local,
		})
		financeRepository := financepostgres.NewRepository(deps.DB)
		financeService := financeapp.NewService(financeapp.Dependencies{
			Expenses: financeRepository,
			Income:   financeRepository,
		})
		r.Group(func(r chi.Router) {
			r.Use(authhttp.RequireAuthenticated)
			r.Mount("/todo", todohttp.NewRouter(todoService))
			r.Mount("/finance", financehttp.NewRouter(financeService))
		})
	})

	if deps.Config.StaticDir != "" {
		r.Handle("/*", spaHandler(deps.Config.StaticDir))
	}

	return r
}

func newAuthService(cfg config.Config, pool *pgxpool.Pool) *auth.Service {
	var sender auth.MagicLinkSender
	if cfg.SMTPHost != "" && cfg.EmailFrom != "" {
		sender = auth.NewSMTPSender(auth.SMTPSenderConfig{
			Host:     cfg.SMTPHost,
			Port:     cfg.SMTPPort,
			Username: cfg.SMTPUsername,
			Password: cfg.SMTPPassword,
			From:     cfg.EmailFrom,
		})
	}

	return auth.NewService(authpostgres.NewRepository(pool), auth.Config{
		AllowedEmails:   cfg.AuthAllowedEmails,
		CallbackBaseURL: cfg.AuthCallbackBaseURL,
		SessionTTL:      cfg.AuthSessionTTL,
		TokenTTL:        cfg.AuthTokenTTL,
		EmailSender:     sender,
		OAuthProviders: []auth.OAuthProviderConfig{
			{
				ID:           "yandex",
				Name:         "Yandex ID",
				ClientID:     cfg.YandexOAuth.ClientID,
				ClientSecret: cfg.YandexOAuth.ClientSecret,
				AuthURL:      cfg.YandexOAuth.AuthURL,
				TokenURL:     cfg.YandexOAuth.TokenURL,
				UserInfoURL:  cfg.YandexOAuth.UserInfoURL,
				Scopes:       []string{"login:email", "login:info"},
				EmailTrusted: true,
			},
			{
				ID:           "github",
				Name:         "GitHub",
				ClientID:     cfg.GitHubOAuth.ClientID,
				ClientSecret: cfg.GitHubOAuth.ClientSecret,
				AuthURL:      cfg.GitHubOAuth.AuthURL,
				TokenURL:     cfg.GitHubOAuth.TokenURL,
				UserInfoURL:  cfg.GitHubOAuth.UserInfoURL,
				Scopes:       []string{"read:user", "user:email"},
				EmailTrusted: true,
			},
			{
				ID:           "vk",
				Name:         "VK ID",
				ClientID:     cfg.VKOAuth.ClientID,
				ClientSecret: cfg.VKOAuth.ClientSecret,
				AuthURL:      cfg.VKOAuth.AuthURL,
				TokenURL:     cfg.VKOAuth.TokenURL,
				UserInfoURL:  cfg.VKOAuth.UserInfoURL,
				Scopes:       []string{"email"},
				EmailTrusted: false,
			},
		},
	})
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
			Service: "anton415-hub-api",
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

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		slog.Error("write json response", slog.String("error", err.Error()))
	}
}

func spaHandler(staticDir string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assetPath := staticAssetPath(r.URL.Path)
		if assetPath == "" {
			http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
			return
		}

		filePath := filepath.Join(staticDir, filepath.FromSlash(assetPath))
		if info, err := os.Stat(filePath); err == nil && !info.IsDir() {
			http.ServeFile(w, r, filePath)
			return
		}

		http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
	})
}

func staticAssetPath(requestPath string) string {
	cleaned := path.Clean("/" + requestPath)
	if cleaned == "/" || cleaned == "." {
		return ""
	}
	return strings.TrimPrefix(cleaned, "/")
}
