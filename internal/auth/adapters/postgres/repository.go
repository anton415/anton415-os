package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/anton415/anton415-os/internal/auth"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (repo *Repository) SaveOAuthState(ctx context.Context, state auth.OAuthState) error {
	_, err := repo.pool.Exec(ctx, `
		INSERT INTO auth_oauth_states (
			state_hash, provider, code_verifier, redirect_path, created_at, expires_at
		)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, state.StateHash, state.Provider, state.CodeVerifier, state.RedirectPath, state.CreatedAt, state.ExpiresAt)
	if err != nil {
		return fmt.Errorf("save oauth state: %w", err)
	}
	return nil
}

func (repo *Repository) ConsumeOAuthState(ctx context.Context, stateHash string, now time.Time) (auth.OAuthState, error) {
	state, err := scanOAuthState(repo.pool.QueryRow(ctx, `
		UPDATE auth_oauth_states
		SET used_at = $2
		WHERE state_hash = $1
		  AND used_at IS NULL
		  AND expires_at > $2
		RETURNING state_hash, provider, code_verifier, redirect_path, created_at, expires_at
	`, stateHash, now))
	if errors.Is(err, pgx.ErrNoRows) {
		return auth.OAuthState{}, auth.ErrInvalidCredentials
	}
	if err != nil {
		return auth.OAuthState{}, fmt.Errorf("consume oauth state: %w", err)
	}
	return state, nil
}

func (repo *Repository) SaveEmailToken(ctx context.Context, token auth.EmailToken) error {
	_, err := repo.pool.Exec(ctx, `
		INSERT INTO auth_email_tokens (token_hash, email, created_at, expires_at)
		VALUES ($1, $2, $3, $4)
	`, token.TokenHash, token.Email, token.CreatedAt, token.ExpiresAt)
	if err != nil {
		return fmt.Errorf("save email token: %w", err)
	}
	return nil
}

func (repo *Repository) ConsumeEmailToken(ctx context.Context, tokenHash string, now time.Time) (auth.EmailToken, error) {
	token, err := scanEmailToken(repo.pool.QueryRow(ctx, `
		UPDATE auth_email_tokens
		SET used_at = $2
		WHERE token_hash = $1
		  AND used_at IS NULL
		  AND expires_at > $2
		RETURNING token_hash, email, created_at, expires_at
	`, tokenHash, now))
	if errors.Is(err, pgx.ErrNoRows) {
		return auth.EmailToken{}, auth.ErrInvalidCredentials
	}
	if err != nil {
		return auth.EmailToken{}, fmt.Errorf("consume email token: %w", err)
	}
	return token, nil
}

func (repo *Repository) CreateSession(ctx context.Context, session auth.Session) error {
	_, err := repo.pool.Exec(ctx, `
		INSERT INTO auth_sessions (token_hash, email, provider, created_at, expires_at, last_seen_at)
		VALUES ($1, $2, $3, $4, $5, $4)
	`, session.TokenHash, session.Email, session.Provider, session.CreatedAt, session.ExpiresAt)
	if err != nil {
		return fmt.Errorf("create auth session: %w", err)
	}
	return nil
}

func (repo *Repository) FindSession(ctx context.Context, tokenHash string, now time.Time) (auth.Session, error) {
	session, err := scanSession(repo.pool.QueryRow(ctx, `
		UPDATE auth_sessions
		SET last_seen_at = $2
		WHERE token_hash = $1
		  AND revoked_at IS NULL
		  AND expires_at > $2
		RETURNING token_hash, email, provider, created_at, expires_at
	`, tokenHash, now))
	if errors.Is(err, pgx.ErrNoRows) {
		return auth.Session{}, auth.ErrInvalidCredentials
	}
	if err != nil {
		return auth.Session{}, fmt.Errorf("find auth session: %w", err)
	}
	return session, nil
}

func (repo *Repository) RevokeSession(ctx context.Context, tokenHash string, now time.Time) error {
	_, err := repo.pool.Exec(ctx, `
		UPDATE auth_sessions
		SET revoked_at = $2
		WHERE token_hash = $1
		  AND revoked_at IS NULL
	`, tokenHash, now)
	if err != nil {
		return fmt.Errorf("revoke auth session: %w", err)
	}
	return nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanOAuthState(row rowScanner) (auth.OAuthState, error) {
	var state auth.OAuthState
	if err := row.Scan(
		&state.StateHash,
		&state.Provider,
		&state.CodeVerifier,
		&state.RedirectPath,
		&state.CreatedAt,
		&state.ExpiresAt,
	); err != nil {
		return auth.OAuthState{}, err
	}
	return state, nil
}

func scanEmailToken(row rowScanner) (auth.EmailToken, error) {
	var token auth.EmailToken
	if err := row.Scan(&token.TokenHash, &token.Email, &token.CreatedAt, &token.ExpiresAt); err != nil {
		return auth.EmailToken{}, err
	}
	return token, nil
}

func scanSession(row rowScanner) (auth.Session, error) {
	var session auth.Session
	if err := row.Scan(
		&session.TokenHash,
		&session.Email,
		&session.Provider,
		&session.CreatedAt,
		&session.ExpiresAt,
	); err != nil {
		return auth.Session{}, err
	}
	return session, nil
}
