CREATE TABLE auth_sessions (
    id BIGSERIAL PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    provider TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_auth_sessions_active
    ON auth_sessions (token_hash, expires_at)
    WHERE revoked_at IS NULL;

CREATE INDEX idx_auth_sessions_email
    ON auth_sessions (lower(email));

CREATE TABLE auth_oauth_states (
    state_hash TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    code_verifier TEXT NOT NULL,
    redirect_path TEXT NOT NULL DEFAULT '/todo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);

CREATE INDEX idx_auth_oauth_states_expiry
    ON auth_oauth_states (expires_at)
    WHERE used_at IS NULL;

CREATE TABLE auth_email_tokens (
    token_hash TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);

CREATE INDEX idx_auth_email_tokens_expiry
    ON auth_email_tokens (expires_at)
    WHERE used_at IS NULL;
