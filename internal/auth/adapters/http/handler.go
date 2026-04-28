package http

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/anton415/anton415-os/internal/auth"
)

type Service interface {
	Providers() []auth.ProviderSummary
	AuthCodeURL(ctx context.Context, providerID string, redirectPath string) (string, error)
	CompleteOAuth(ctx context.Context, providerID string, state string, code string) (auth.CreatedSession, error)
	StartEmailLogin(ctx context.Context, email string) error
	CompleteEmailLogin(ctx context.Context, token string) (auth.CreatedSession, error)
	PrincipalForToken(ctx context.Context, token string) (auth.Principal, error)
	RevokeSession(ctx context.Context, token string) error
}

type Config struct {
	CookieName      string
	CookieDomain    string
	CookieSecure    bool
	SuccessRedirect string
	FailureRedirect string
	DevBypass       bool
	DevEmail        string
}

type Handler struct {
	service Service
	config  Config
}

func NewRouter(service Service, config Config) http.Handler {
	handler := Handler{service: service, config: config}
	r := chi.NewRouter()

	r.Get("/providers", handler.providers)
	r.Get("/{provider}/start", handler.startOAuth)
	r.Get("/{provider}/callback", handler.completeOAuth)
	r.Post("/email/start", handler.startEmail)
	r.Get("/email/verify", handler.completeEmail)
	r.Post("/logout", handler.logout)

	return r
}

func SessionMiddleware(service Service, config Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if config.DevBypass {
				r = r.WithContext(context.WithValue(r.Context(), principalContextKey{}, devPrincipal(config.DevEmail)))
				next.ServeHTTP(w, r)
				return
			}

			cookie, err := r.Cookie(config.cookieName())
			if err != nil || strings.TrimSpace(cookie.Value) == "" {
				next.ServeHTTP(w, r)
				return
			}

			principal, err := service.PrincipalForToken(r.Context(), cookie.Value)
			if err == nil {
				r = r.WithContext(context.WithValue(r.Context(), principalContextKey{}, principal))
			}

			next.ServeHTTP(w, r)
		})
	}
}

func devPrincipal(email string) auth.Principal {
	email = strings.TrimSpace(email)
	if email == "" {
		email = "dev@localhost"
	}
	return auth.Principal{
		Email:    email,
		Provider: "dev",
	}
}

func RequireAuthenticated(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := PrincipalFromContext(r.Context()); !ok {
			writeErrorResponse(w, http.StatusUnauthorized, "unauthorized", "authentication is required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func MeHandler(w http.ResponseWriter, r *http.Request) {
	if principal, ok := PrincipalFromContext(r.Context()); ok {
		writeData(w, http.StatusOK, map[string]any{
			"authenticated": true,
			"user": map[string]string{
				"email":    principal.Email,
				"provider": principal.Provider,
			},
		})
		return
	}

	writeData(w, http.StatusOK, map[string]any{
		"authenticated": false,
		"user":          nil,
	})
}

func PrincipalFromContext(ctx context.Context) (auth.Principal, bool) {
	principal, ok := ctx.Value(principalContextKey{}).(auth.Principal)
	return principal, ok
}

func (handler Handler) providers(w http.ResponseWriter, _ *http.Request) {
	writeData(w, http.StatusOK, handler.service.Providers())
}

func (handler Handler) startOAuth(w http.ResponseWriter, r *http.Request) {
	redirectPath := safeRedirectPath(r.URL.Query().Get("redirect"))
	authURL, err := handler.service.AuthCodeURL(r.Context(), chi.URLParam(r, "provider"), redirectPath)
	if err != nil {
		writeAuthError(w, err)
		return
	}

	http.Redirect(w, r, authURL, http.StatusFound)
}

func (handler Handler) completeOAuth(w http.ResponseWriter, r *http.Request) {
	if r.URL.Query().Get("error") != "" {
		handler.redirectFailure(w, r, "oauth_denied")
		return
	}

	session, err := handler.service.CompleteOAuth(
		r.Context(),
		chi.URLParam(r, "provider"),
		r.URL.Query().Get("state"),
		r.URL.Query().Get("code"),
	)
	if err != nil {
		slog.Warn("oauth login failed", slog.String("error", err.Error()))
		handler.redirectFailure(w, r, authErrorCode(err))
		return
	}

	http.SetCookie(w, handler.sessionCookie(session))
	http.Redirect(w, r, handler.config.successRedirectFor(session.RedirectPath), http.StatusFound)
}

func (handler Handler) startEmail(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Email string `json:"email"`
	}
	if !decodeRequest(w, r, &request) {
		return
	}

	if err := handler.service.StartEmailLogin(r.Context(), request.Email); err != nil {
		writeAuthError(w, err)
		return
	}

	writeData(w, http.StatusAccepted, map[string]bool{"accepted": true})
}

func (handler Handler) completeEmail(w http.ResponseWriter, r *http.Request) {
	session, err := handler.service.CompleteEmailLogin(r.Context(), r.URL.Query().Get("token"))
	if err != nil {
		handler.redirectFailure(w, r, authErrorCode(err))
		return
	}

	http.SetCookie(w, handler.sessionCookie(session))
	http.Redirect(w, r, handler.config.successRedirect(), http.StatusFound)
}

func (handler Handler) logout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(handler.config.cookieName()); err == nil {
		if err := handler.service.RevokeSession(r.Context(), cookie.Value); err != nil {
			slog.Warn("revoke auth session", slog.String("error", err.Error()))
		}
	}

	http.SetCookie(w, handler.clearSessionCookie())
	w.WriteHeader(http.StatusNoContent)
}

func (handler Handler) redirectFailure(w http.ResponseWriter, r *http.Request, code string) {
	http.Redirect(w, r, appendQuery(handler.config.failureRedirect(), "auth_error", code), http.StatusFound)
}

func (handler Handler) sessionCookie(session auth.CreatedSession) *http.Cookie {
	return &http.Cookie{
		Name:     handler.config.cookieName(),
		Value:    session.Token,
		Domain:   handler.config.cookieDomain(),
		Path:     "/",
		Expires:  session.ExpiresAt,
		MaxAge:   maxAge(session.ExpiresAt),
		HttpOnly: true,
		Secure:   handler.config.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	}
}

func (handler Handler) clearSessionCookie() *http.Cookie {
	return &http.Cookie{
		Name:     handler.config.cookieName(),
		Value:    "",
		Domain:   handler.config.cookieDomain(),
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   handler.config.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	}
}

func decodeRequest(w http.ResponseWriter, r *http.Request, value any) bool {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		writeErrorResponse(w, http.StatusBadRequest, "bad_request", "request body must be valid JSON")
		return false
	}
	return true
}

func writeAuthError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, auth.ErrProviderUnavailable):
		writeErrorResponse(w, http.StatusNotFound, "provider_unavailable", "authentication provider is not configured")
	case errors.Is(err, auth.ErrEmailDeliveryDisabled):
		writeErrorResponse(w, http.StatusServiceUnavailable, "email_delivery_disabled", "email delivery is not configured")
	case errors.Is(err, auth.ErrEmailNotAllowed):
		writeErrorResponse(w, http.StatusForbidden, "email_not_allowed", "email is not allowed")
	case errors.Is(err, auth.ErrEmailVerificationRequired):
		writeErrorResponse(w, http.StatusForbidden, "email_verification_required", "email verification is required")
	case errors.Is(err, auth.ErrInvalidCredentials):
		writeErrorResponse(w, http.StatusUnauthorized, "invalid_credentials", "authentication failed")
	default:
		slog.Error("auth handler error", slog.String("error", err.Error()))
		writeErrorResponse(w, http.StatusInternalServerError, "internal_error", "internal server error")
	}
}

func writeData(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(map[string]any{"data": data}); err != nil {
		slog.Error("write auth json response", slog.String("error", err.Error()))
	}
}

func writeErrorResponse(w http.ResponseWriter, status int, code string, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(map[string]any{
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	}); err != nil {
		slog.Error("write auth error response", slog.String("error", err.Error()))
	}
}

func authErrorCode(err error) string {
	switch {
	case errors.Is(err, auth.ErrEmailNotAllowed):
		return "email_not_allowed"
	case errors.Is(err, auth.ErrEmailVerificationRequired):
		return "email_verification_required"
	case errors.Is(err, auth.ErrProviderUnavailable):
		return "provider_unavailable"
	default:
		return "auth_failed"
	}
}

func (config Config) cookieName() string {
	if strings.TrimSpace(config.CookieName) == "" {
		return "anton415_session"
	}
	return config.CookieName
}

func (config Config) cookieDomain() string {
	return strings.TrimPrefix(strings.TrimSpace(config.CookieDomain), ".")
}

func (config Config) successRedirect() string {
	if strings.TrimSpace(config.SuccessRedirect) == "" {
		return "/todo"
	}
	return config.SuccessRedirect
}

func (config Config) successRedirectFor(redirectPath string) string {
	configured := config.successRedirect()
	if strings.TrimSpace(redirectPath) == "" {
		return configured
	}

	targetPath := safeRedirectPath(redirectPath)
	base, err := url.Parse(configured)
	if err != nil || base.Scheme == "" || base.Host == "" {
		return targetPath
	}

	target, err := url.Parse(targetPath)
	if err != nil {
		return configured
	}
	base.Path = target.Path
	base.RawQuery = target.RawQuery
	base.Fragment = ""
	return base.String()
}

func (config Config) failureRedirect() string {
	if strings.TrimSpace(config.FailureRedirect) == "" {
		return "/"
	}
	return config.FailureRedirect
}

func safeRedirectPath(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || !strings.HasPrefix(value, "/") || strings.HasPrefix(value, "//") {
		return "/todo"
	}

	parsed, err := url.Parse(value)
	if err != nil || parsed.IsAbs() || parsed.Host != "" || parsed.Path == "" || strings.HasPrefix(parsed.Path, "//") {
		return "/todo"
	}
	return parsed.RequestURI()
}

func appendQuery(rawURL string, key string, value string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	query := parsed.Query()
	query.Set(key, value)
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

func maxAge(expiresAt time.Time) int {
	seconds := int(time.Until(expiresAt).Seconds())
	if seconds < 0 {
		return 0
	}
	return seconds
}

type principalContextKey struct{}
