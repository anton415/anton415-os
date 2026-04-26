package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

var (
	ErrInvalidCredentials        = errors.New("auth credentials are invalid")
	ErrProviderUnavailable       = errors.New("auth provider is not configured")
	ErrEmailNotAllowed           = errors.New("email is not allowed")
	ErrEmailVerificationRequired = errors.New("email verification is required")
	ErrEmailDeliveryDisabled     = errors.New("email delivery is not configured")
)

type Principal struct {
	Email    string
	Provider string
}

type Session struct {
	TokenHash string
	Email     string
	Provider  string
	CreatedAt time.Time
	ExpiresAt time.Time
}

type OAuthState struct {
	StateHash    string
	Provider     string
	CodeVerifier string
	RedirectPath string
	CreatedAt    time.Time
	ExpiresAt    time.Time
}

type EmailToken struct {
	TokenHash string
	Email     string
	CreatedAt time.Time
	ExpiresAt time.Time
}

type Repository interface {
	SaveOAuthState(ctx context.Context, state OAuthState) error
	ConsumeOAuthState(ctx context.Context, stateHash string, now time.Time) (OAuthState, error)
	SaveEmailToken(ctx context.Context, token EmailToken) error
	ConsumeEmailToken(ctx context.Context, tokenHash string, now time.Time) (EmailToken, error)
	CreateSession(ctx context.Context, session Session) error
	FindSession(ctx context.Context, tokenHash string, now time.Time) (Session, error)
	RevokeSession(ctx context.Context, tokenHash string, now time.Time) error
}

type MagicLinkSender interface {
	SendMagicLink(ctx context.Context, email string, link string) error
}

type OAuthProviderConfig struct {
	ID           string
	Name         string
	ClientID     string
	ClientSecret string
	AuthURL      string
	TokenURL     string
	UserInfoURL  string
	Scopes       []string
	EmailTrusted bool
}

type ProviderSummary struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Kind string `json:"kind"`
}

type Config struct {
	AllowedEmails   []string
	CallbackBaseURL string
	SessionTTL      time.Duration
	TokenTTL        time.Duration
	OAuthProviders  []OAuthProviderConfig
	EmailSender     MagicLinkSender
	HTTPClient      *http.Client
	Now             func() time.Time
}

type CreatedSession struct {
	Token     string
	ExpiresAt time.Time
	Principal Principal
}

type Service struct {
	repository      Repository
	allowedEmails   map[string]struct{}
	callbackBaseURL string
	sessionTTL      time.Duration
	tokenTTL        time.Duration
	oauthProviders  map[string]OAuthProviderConfig
	emailSender     MagicLinkSender
	httpClient      *http.Client
	now             func() time.Time
}

func NewService(repository Repository, cfg Config) *Service {
	now := cfg.Now
	if now == nil {
		now = time.Now
	}

	sessionTTL := cfg.SessionTTL
	if sessionTTL <= 0 {
		sessionTTL = 30 * 24 * time.Hour
	}

	tokenTTL := cfg.TokenTTL
	if tokenTTL <= 0 {
		tokenTTL = 15 * time.Minute
	}

	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 10 * time.Second}
	}

	allowedEmails := map[string]struct{}{}
	for _, email := range cfg.AllowedEmails {
		if normalized := NormalizeEmail(email); normalized != "" {
			allowedEmails[normalized] = struct{}{}
		}
	}

	oauthProviders := map[string]OAuthProviderConfig{}
	for _, provider := range cfg.OAuthProviders {
		if provider.configured() {
			oauthProviders[provider.ID] = provider
		}
	}

	return &Service{
		repository:      repository,
		allowedEmails:   allowedEmails,
		callbackBaseURL: strings.TrimRight(cfg.CallbackBaseURL, "/"),
		sessionTTL:      sessionTTL,
		tokenTTL:        tokenTTL,
		oauthProviders:  oauthProviders,
		emailSender:     cfg.EmailSender,
		httpClient:      httpClient,
		now:             now,
	}
}

func (service *Service) Providers() []ProviderSummary {
	providers := []ProviderSummary{}
	if len(service.allowedEmails) > 0 {
		providers = append(providers, ProviderSummary{ID: "email", Name: "Email link", Kind: "email"})
	}

	for _, id := range []string{"yandex", "github", "vk"} {
		if provider, ok := service.oauthProviders[id]; ok {
			providers = append(providers, ProviderSummary{ID: provider.ID, Name: provider.Name, Kind: "oauth"})
		}
	}

	return providers
}

func (service *Service) AuthCodeURL(ctx context.Context, providerID string, redirectPath string) (string, error) {
	provider, ok := service.oauthProviders[providerID]
	if !ok {
		return "", ErrProviderUnavailable
	}

	state, err := randomToken(32)
	if err != nil {
		return "", err
	}
	codeVerifier, err := randomToken(64)
	if err != nil {
		return "", err
	}

	now := service.now().UTC()
	if err := service.repository.SaveOAuthState(ctx, OAuthState{
		StateHash:    HashToken(state),
		Provider:     provider.ID,
		CodeVerifier: codeVerifier,
		RedirectPath: redirectPath,
		CreatedAt:    now,
		ExpiresAt:    now.Add(service.tokenTTL),
	}); err != nil {
		return "", err
	}

	values := url.Values{}
	values.Set("response_type", "code")
	values.Set("client_id", provider.ClientID)
	values.Set("redirect_uri", service.oauthCallbackURL(provider.ID))
	values.Set("state", state)
	values.Set("scope", strings.Join(provider.Scopes, " "))
	values.Set("code_challenge", codeChallenge(codeVerifier))
	values.Set("code_challenge_method", "S256")

	return provider.AuthURL + "?" + values.Encode(), nil
}

func (service *Service) CompleteOAuth(ctx context.Context, providerID string, stateValue string, code string) (CreatedSession, error) {
	provider, ok := service.oauthProviders[providerID]
	if !ok {
		return CreatedSession{}, ErrProviderUnavailable
	}
	if strings.TrimSpace(stateValue) == "" || strings.TrimSpace(code) == "" {
		return CreatedSession{}, ErrInvalidCredentials
	}

	now := service.now().UTC()
	state, err := service.repository.ConsumeOAuthState(ctx, HashToken(stateValue), now)
	if err != nil {
		return CreatedSession{}, ErrInvalidCredentials
	}
	if state.Provider != provider.ID {
		return CreatedSession{}, ErrInvalidCredentials
	}

	token, err := service.exchangeOAuthCode(ctx, provider, code, state.CodeVerifier)
	if err != nil {
		return CreatedSession{}, err
	}

	identity, err := service.oauthIdentity(ctx, provider, token)
	if err != nil {
		return CreatedSession{}, err
	}
	if identity.Email == "" {
		return CreatedSession{}, ErrEmailVerificationRequired
	}
	if !service.emailAllowed(identity.Email) {
		return CreatedSession{}, ErrEmailNotAllowed
	}
	if !identity.EmailVerified {
		return CreatedSession{}, ErrEmailVerificationRequired
	}

	return service.createSession(ctx, identity.Email, provider.ID)
}

func (service *Service) StartEmailLogin(ctx context.Context, email string) error {
	normalized := NormalizeEmail(email)
	if normalized == "" {
		return ErrInvalidCredentials
	}

	// Do not leak whether an arbitrary email is allowed.
	if !service.emailAllowed(normalized) {
		return nil
	}
	if service.emailSender == nil {
		return ErrEmailDeliveryDisabled
	}

	token, err := randomToken(32)
	if err != nil {
		return err
	}

	now := service.now().UTC()
	if err := service.repository.SaveEmailToken(ctx, EmailToken{
		TokenHash: HashToken(token),
		Email:     normalized,
		CreatedAt: now,
		ExpiresAt: now.Add(service.tokenTTL),
	}); err != nil {
		return err
	}

	link := service.callbackBaseURL + "/api/v1/auth/email/verify?token=" + url.QueryEscape(token)
	return service.emailSender.SendMagicLink(ctx, normalized, link)
}

func (service *Service) CompleteEmailLogin(ctx context.Context, token string) (CreatedSession, error) {
	if strings.TrimSpace(token) == "" {
		return CreatedSession{}, ErrInvalidCredentials
	}

	emailToken, err := service.repository.ConsumeEmailToken(ctx, HashToken(token), service.now().UTC())
	if err != nil {
		return CreatedSession{}, ErrInvalidCredentials
	}
	if !service.emailAllowed(emailToken.Email) {
		return CreatedSession{}, ErrEmailNotAllowed
	}

	return service.createSession(ctx, emailToken.Email, "email")
}

func (service *Service) PrincipalForToken(ctx context.Context, token string) (Principal, error) {
	if strings.TrimSpace(token) == "" {
		return Principal{}, ErrInvalidCredentials
	}

	session, err := service.repository.FindSession(ctx, HashToken(token), service.now().UTC())
	if err != nil {
		return Principal{}, ErrInvalidCredentials
	}
	if !service.emailAllowed(session.Email) {
		return Principal{}, ErrEmailNotAllowed
	}

	return Principal{Email: session.Email, Provider: session.Provider}, nil
}

func (service *Service) RevokeSession(ctx context.Context, token string) error {
	if strings.TrimSpace(token) == "" {
		return nil
	}
	return service.repository.RevokeSession(ctx, HashToken(token), service.now().UTC())
}

func (service *Service) createSession(ctx context.Context, email string, provider string) (CreatedSession, error) {
	token, err := randomToken(32)
	if err != nil {
		return CreatedSession{}, err
	}

	now := service.now().UTC()
	session := Session{
		TokenHash: HashToken(token),
		Email:     NormalizeEmail(email),
		Provider:  provider,
		CreatedAt: now,
		ExpiresAt: now.Add(service.sessionTTL),
	}
	if err := service.repository.CreateSession(ctx, session); err != nil {
		return CreatedSession{}, err
	}

	return CreatedSession{
		Token:     token,
		ExpiresAt: session.ExpiresAt,
		Principal: Principal{
			Email:    session.Email,
			Provider: session.Provider,
		},
	}, nil
}

func (service *Service) emailAllowed(email string) bool {
	if len(service.allowedEmails) == 0 {
		return false
	}
	_, ok := service.allowedEmails[NormalizeEmail(email)]
	return ok
}

func (service *Service) oauthCallbackURL(providerID string) string {
	return service.callbackBaseURL + "/api/v1/auth/" + providerID + "/callback"
}

type oauthTokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	Email       string `json:"email"`
}

func (service *Service) exchangeOAuthCode(ctx context.Context, provider OAuthProviderConfig, code string, codeVerifier string) (oauthTokenResponse, error) {
	values := url.Values{}
	values.Set("grant_type", "authorization_code")
	values.Set("client_id", provider.ClientID)
	values.Set("client_secret", provider.ClientSecret)
	values.Set("code", code)
	values.Set("redirect_uri", service.oauthCallbackURL(provider.ID))
	values.Set("code_verifier", codeVerifier)

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, provider.TokenURL, strings.NewReader(values.Encode()))
	if err != nil {
		return oauthTokenResponse{}, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	response, err := service.httpClient.Do(request)
	if err != nil {
		return oauthTokenResponse{}, err
	}
	defer response.Body.Close()

	body, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return oauthTokenResponse{}, err
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return oauthTokenResponse{}, fmt.Errorf("%w: token exchange failed", ErrInvalidCredentials)
	}

	var token oauthTokenResponse
	if err := json.Unmarshal(body, &token); err != nil {
		return oauthTokenResponse{}, err
	}
	if token.AccessToken == "" {
		return oauthTokenResponse{}, ErrInvalidCredentials
	}
	return token, nil
}

type oauthIdentity struct {
	Email         string
	EmailVerified bool
}

func (service *Service) oauthIdentity(ctx context.Context, provider OAuthProviderConfig, token oauthTokenResponse) (oauthIdentity, error) {
	switch provider.ID {
	case "github":
		return service.githubIdentity(ctx, token.AccessToken)
	case "vk":
		// VK OAuth may return email during token exchange, but the response does
		// not provide a reliable verification flag. Require email magic-link login.
		return oauthIdentity{Email: NormalizeEmail(token.Email), EmailVerified: false}, nil
	default:
		return service.defaultOAuthIdentity(ctx, provider, token.AccessToken)
	}
}

func (service *Service) defaultOAuthIdentity(ctx context.Context, provider OAuthProviderConfig, accessToken string) (oauthIdentity, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, provider.UserInfoURL, nil)
	if err != nil {
		return oauthIdentity{}, err
	}
	if provider.ID == "yandex" {
		request.Header.Set("Authorization", "OAuth "+accessToken)
	} else {
		request.Header.Set("Authorization", "Bearer "+accessToken)
	}
	request.Header.Set("Accept", "application/json")

	response, err := service.httpClient.Do(request)
	if err != nil {
		return oauthIdentity{}, err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return oauthIdentity{}, ErrInvalidCredentials
	}

	var payload struct {
		Email        string   `json:"email"`
		DefaultEmail string   `json:"default_email"`
		Emails       []string `json:"emails"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&payload); err != nil {
		return oauthIdentity{}, err
	}

	email := payload.Email
	if email == "" {
		email = payload.DefaultEmail
	}
	if email == "" && len(payload.Emails) > 0 {
		email = payload.Emails[0]
	}

	return oauthIdentity{Email: NormalizeEmail(email), EmailVerified: provider.EmailTrusted}, nil
}

func (service *Service) githubIdentity(ctx context.Context, accessToken string) (oauthIdentity, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/user/emails", nil)
	if err != nil {
		return oauthIdentity{}, err
	}
	request.Header.Set("Authorization", "Bearer "+accessToken)
	request.Header.Set("Accept", "application/vnd.github+json")

	response, err := service.httpClient.Do(request)
	if err != nil {
		return oauthIdentity{}, err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return oauthIdentity{}, ErrInvalidCredentials
	}

	var emails []struct {
		Email    string `json:"email"`
		Primary  bool   `json:"primary"`
		Verified bool   `json:"verified"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&emails); err != nil {
		return oauthIdentity{}, err
	}

	for _, item := range emails {
		if item.Primary && item.Verified {
			return oauthIdentity{Email: NormalizeEmail(item.Email), EmailVerified: true}, nil
		}
	}
	for _, item := range emails {
		if item.Verified {
			return oauthIdentity{Email: NormalizeEmail(item.Email), EmailVerified: true}, nil
		}
	}

	return oauthIdentity{}, ErrEmailVerificationRequired
}

func (provider OAuthProviderConfig) configured() bool {
	return provider.ID != "" &&
		provider.ClientID != "" &&
		provider.ClientSecret != "" &&
		provider.AuthURL != "" &&
		provider.TokenURL != ""
}

func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func randomToken(size int) (string, error) {
	buffer := make([]byte, size)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

func codeChallenge(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}
