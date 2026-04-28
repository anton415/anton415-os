package auth

import (
	"context"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestEmailMagicLinkCreatesSingleUseSession(t *testing.T) {
	now := time.Date(2026, 4, 26, 12, 0, 0, 0, time.UTC)
	repo := newMemoryRepository()
	sender := &captureSender{}
	service := NewService(repo, Config{
		AllowedEmails:   []string{"anton@example.com"},
		CallbackBaseURL: "https://anton415.ru",
		EmailSender:     sender,
		Now: func() time.Time {
			return now
		},
	})

	if err := service.StartEmailLogin(context.Background(), " Anton@Example.com "); err != nil {
		t.Fatalf("StartEmailLogin() error = %v", err)
	}
	if sender.link == "" {
		t.Fatal("magic link was not sent")
	}

	session, err := service.CompleteEmailLogin(context.Background(), tokenFromMagicLink(t, sender.link))
	if err != nil {
		t.Fatalf("CompleteEmailLogin() error = %v", err)
	}
	if session.Principal.Email != "anton@example.com" {
		t.Fatalf("session email = %q, want anton@example.com", session.Principal.Email)
	}

	if _, err := service.CompleteEmailLogin(context.Background(), tokenFromMagicLink(t, sender.link)); err == nil {
		t.Fatal("CompleteEmailLogin() error = nil, want single-use token failure")
	}
}

func TestEmailMagicLinkExpires(t *testing.T) {
	now := time.Date(2026, 4, 26, 12, 0, 0, 0, time.UTC)
	repo := newMemoryRepository()
	sender := &captureSender{}
	service := NewService(repo, Config{
		AllowedEmails:   []string{"anton@example.com"},
		CallbackBaseURL: "https://anton415.ru",
		TokenTTL:        time.Minute,
		EmailSender:     sender,
		Now: func() time.Time {
			return now
		},
	})

	if err := service.StartEmailLogin(context.Background(), "anton@example.com"); err != nil {
		t.Fatalf("StartEmailLogin() error = %v", err)
	}

	now = now.Add(2 * time.Minute)
	if _, err := service.CompleteEmailLogin(context.Background(), tokenFromMagicLink(t, sender.link)); err == nil {
		t.Fatal("CompleteEmailLogin() error = nil, want expired token failure")
	}
}

func TestUnallowedEmailDoesNotSendMagicLink(t *testing.T) {
	sender := &captureSender{}
	service := NewService(newMemoryRepository(), Config{
		AllowedEmails:   []string{"anton@example.com"},
		CallbackBaseURL: "https://anton415.ru",
		EmailSender:     sender,
	})

	if err := service.StartEmailLogin(context.Background(), "stranger@example.com"); err != nil {
		t.Fatalf("StartEmailLogin() error = %v", err)
	}
	if sender.link != "" {
		t.Fatalf("magic link = %q, want no email for unallowed address", sender.link)
	}
}

func TestProvidersOnlyExposeConfiguredOAuth(t *testing.T) {
	service := NewService(newMemoryRepository(), Config{
		AllowedEmails: []string{"anton@example.com"},
		EmailSender:   &captureSender{},
		OAuthProviders: []OAuthProviderConfig{
			{
				ID:           "github",
				Name:         "GitHub",
				ClientID:     "client",
				ClientSecret: "secret",
				AuthURL:      "https://github.test/authorize",
				TokenURL:     "https://github.test/token",
			},
			{ID: "yandex", Name: "Yandex ID"},
		},
	})

	providers := service.Providers()
	if len(providers) != 2 {
		t.Fatalf("providers = %#v, want email and github", providers)
	}
	if providers[0].ID != "email" || providers[1].ID != "github" {
		t.Fatalf("providers = %#v, want email then github", providers)
	}
}

func TestProvidersHideEmailWhenDeliveryIsDisabled(t *testing.T) {
	service := NewService(newMemoryRepository(), Config{
		AllowedEmails: []string{"anton@example.com"},
		OAuthProviders: []OAuthProviderConfig{
			{
				ID:           "github",
				Name:         "GitHub",
				ClientID:     "client",
				ClientSecret: "secret",
				AuthURL:      "https://github.test/authorize",
				TokenURL:     "https://github.test/token",
			},
		},
	})

	providers := service.Providers()
	if len(providers) != 1 {
		t.Fatalf("providers = %#v, want github only", providers)
	}
	if providers[0].ID != "github" {
		t.Fatalf("providers = %#v, want github only", providers)
	}
}

type captureSender struct {
	link string
}

func (sender *captureSender) SendMagicLink(_ context.Context, _ string, link string) error {
	sender.link = link
	return nil
}

func tokenFromMagicLink(t *testing.T, link string) string {
	t.Helper()

	parsed, err := url.Parse(link)
	if err != nil {
		t.Fatalf("parse magic link: %v", err)
	}
	token := parsed.Query().Get("token")
	if strings.TrimSpace(token) == "" {
		t.Fatal("magic link token is empty")
	}
	return token
}

type memoryRepository struct {
	oauthStates map[string]OAuthState
	emailTokens map[string]EmailToken
	sessions    map[string]Session
}

func newMemoryRepository() *memoryRepository {
	return &memoryRepository{
		oauthStates: map[string]OAuthState{},
		emailTokens: map[string]EmailToken{},
		sessions:    map[string]Session{},
	}
}

func (repo *memoryRepository) SaveOAuthState(_ context.Context, state OAuthState) error {
	repo.oauthStates[state.StateHash] = state
	return nil
}

func (repo *memoryRepository) ConsumeOAuthState(_ context.Context, stateHash string, now time.Time) (OAuthState, error) {
	state, ok := repo.oauthStates[stateHash]
	if !ok || !state.ExpiresAt.After(now) {
		return OAuthState{}, ErrInvalidCredentials
	}
	delete(repo.oauthStates, stateHash)
	return state, nil
}

func (repo *memoryRepository) SaveEmailToken(_ context.Context, token EmailToken) error {
	repo.emailTokens[token.TokenHash] = token
	return nil
}

func (repo *memoryRepository) ConsumeEmailToken(_ context.Context, tokenHash string, now time.Time) (EmailToken, error) {
	token, ok := repo.emailTokens[tokenHash]
	if !ok || !token.ExpiresAt.After(now) {
		return EmailToken{}, ErrInvalidCredentials
	}
	delete(repo.emailTokens, tokenHash)
	return token, nil
}

func (repo *memoryRepository) CreateSession(_ context.Context, session Session) error {
	repo.sessions[session.TokenHash] = session
	return nil
}

func (repo *memoryRepository) FindSession(_ context.Context, tokenHash string, now time.Time) (Session, error) {
	session, ok := repo.sessions[tokenHash]
	if !ok || !session.ExpiresAt.After(now) {
		return Session{}, ErrInvalidCredentials
	}
	return session, nil
}

func (repo *memoryRepository) RevokeSession(_ context.Context, tokenHash string, _ time.Time) error {
	delete(repo.sessions, tokenHash)
	return nil
}
