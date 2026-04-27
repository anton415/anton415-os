#!/usr/bin/env sh
set -eu

COMPOSE="${COMPOSE:-docker compose}"
API_BASE_URL="${API_BASE_URL:-http://localhost:8080}"
POSTGRES_DB="${POSTGRES_DB:-anton415_os}"
POSTGRES_USER="${POSTGRES_USER:-anton415}"
AUTH_EMAIL="${AUTH_EMAIL:-}"
SESSION_COOKIE="${AUTH_SESSION_COOKIE:-anton415_session}"
SESSION_TOKEN="${AUTH_TEST_TOKEN:-local-smoke-session}"
SESSION_HASH="$(printf '%s' "${SESSION_TOKEN}" | shasum -a 256 | awk '{print $1}')"

${COMPOSE} up -d postgres
${COMPOSE} run --rm migrate -path /migrations -database "postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD:-anton415}@postgres:5432/${POSTGRES_DB}?sslmode=disable" up
${COMPOSE} up -d api

attempts=0
until curl -fsS "${API_BASE_URL}/health" > /dev/null 2>&1; do
  attempts=$((attempts + 1))
  if [ "${attempts}" -ge 30 ]; then
    printf 'API did not become healthy at %s\n' "${API_BASE_URL}/health" >&2
    exit 1
  fi
  sleep 1
done

if [ -z "${AUTH_EMAIL}" ]; then
  allowed_emails="$(${COMPOSE} exec -T api printenv AUTH_ALLOWED_EMAILS 2>/dev/null || true)"
  AUTH_EMAIL="$(
    printf '%s' "${allowed_emails:-anton@example.com}" |
      awk -F, '{gsub(/^[ \t]+|[ \t]+$/, "", $1); print $1}'
  )"
fi

${COMPOSE} exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<SQL
INSERT INTO auth_sessions (token_hash, email, provider, created_at, expires_at, last_seen_at)
VALUES ('${SESSION_HASH}', '${AUTH_EMAIL}', 'smoke', now(), now() + interval '1 hour', now())
ON CONFLICT (token_hash)
DO UPDATE SET
  email = EXCLUDED.email,
  provider = EXCLUDED.provider,
  expires_at = now() + interval '1 hour',
  revoked_at = NULL,
  last_seen_at = now();
SQL

create_response="$(mktemp)"
list_response="$(mktemp)"
cleanup() {
  rm -f "${create_response}" "${list_response}"
}
trap cleanup EXIT

curl -fsS \
  -H "Content-Type: application/json" \
  -H "Cookie: ${SESSION_COOKIE}=${SESSION_TOKEN}" \
  -d '{"title":"Integration smoke task","notes":"created by smoke","due_date":null,"project_id":null}' \
  "${API_BASE_URL}/api/v1/todo/tasks" > "${create_response}"

task_id="$(node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.id))" < "${create_response}")"

curl -fsS \
  -H "Cookie: ${SESSION_COOKIE}=${SESSION_TOKEN}" \
  "${API_BASE_URL}/api/v1/todo/tasks?view=inbox" > "${list_response}"

node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const body=JSON.parse(d); if(!body.data.some((task)=>task.id===Number(process.argv[1]))) process.exit(1)})" "${task_id}" < "${list_response}"

curl -fsS \
  -X DELETE \
  -H "Cookie: ${SESSION_COOKIE}=${SESSION_TOKEN}" \
  "${API_BASE_URL}/api/v1/todo/tasks/${task_id}" > /dev/null

printf 'Todo integration smoke passed with task id %s\n' "${task_id}"
