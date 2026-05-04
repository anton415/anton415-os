#!/usr/bin/env sh
set -eu

COMPOSE="${COMPOSE:-docker compose}"
API_BASE_URL="${API_BASE_URL:-http://localhost:8080}"
POSTGRES_DB="${POSTGRES_DB:-anton415_hub}"
POSTGRES_USER="${POSTGRES_USER:-anton415}"
AUTH_EMAIL="${AUTH_EMAIL:-}"
SESSION_COOKIE="${AUTH_SESSION_COOKIE:-anton415_hub_session}"
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
project_response="$(mktemp)"
project_task_response="$(mktemp)"
archive_response="$(mktemp)"
restore_response="$(mktemp)"
active_projects_response="$(mktemp)"
archived_projects_response="$(mktemp)"
project_tasks_response="$(mktemp)"
all_tasks_response="$(mktemp)"
cleanup() {
  rm -f \
    "${create_response}" \
    "${list_response}" \
    "${project_response}" \
    "${project_task_response}" \
    "${archive_response}" \
    "${restore_response}" \
    "${active_projects_response}" \
    "${archived_projects_response}" \
    "${project_tasks_response}" \
    "${all_tasks_response}"
}
trap cleanup EXIT

curl -fsS \
  -H "Content-Type: application/json" \
  -H "Cookie: ${SESSION_COOKIE}=${SESSION_TOKEN}" \
  -d '{"title":"Integration smoke task","notes":"created by smoke","url":"example.com/integration-smoke","due_date":null,"project_id":null}' \
  "${API_BASE_URL}/api/v1/todo/tasks" > "${create_response}"

task_id="$(node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.id))" < "${create_response}")"
node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const task=JSON.parse(d).data; if(task.url !== 'https://example.com/integration-smoke') process.exit(1)})" < "${create_response}"

curl -fsS \
  -H "Cookie: ${SESSION_COOKIE}=${SESSION_TOKEN}" \
  "${API_BASE_URL}/api/v1/todo/tasks?view=inbox" > "${list_response}"

node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const body=JSON.parse(d); if(!body.data.some((task)=>task.id===Number(process.argv[1]) && task.url === 'https://example.com/integration-smoke')) process.exit(1)})" "${task_id}" < "${list_response}"

curl -fsS \
  -H "Content-Type: application/json" \
  -H "Cookie: ${SESSION_COOKIE}=${SESSION_TOKEN}" \
  -d '{"name":"Integration smoke project"}' \
  "${API_BASE_URL}/api/v1/todo/projects" > "${project_response}"

project_id="$(node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.id))" < "${project_response}")"

curl -fsS \
  -H "Content-Type: application/json" \
  -H "Cookie: ${SESSION_COOKIE}=${SESSION_TOKEN}" \
  -d "{\"title\":\"Integration smoke project task\",\"project_id\":${project_id},\"due_date\":null}" \
  "${API_BASE_URL}/api/v1/todo/tasks" > "${project_task_response}"

project_task_id="$(node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.id))" < "${project_task_response}")"

curl -fsS \
  -X PATCH \
  -H "Content-Type: application/json" \
  -H "Cookie: ${SESSION_COOKIE}=${SESSION_TOKEN}" \
  "${API_BASE_URL}/api/v1/todo/projects/${project_id}/archive" > "${archive_response}"

node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{if(JSON.parse(d).data.archived !== true) process.exit(1)})" < "${archive_response}"

curl -fsS \
  -H "Cookie: ${SESSION_COOKIE}=${SESSION_TOKEN}" \
  "${API_BASE_URL}/api/v1/todo/projects" > "${active_projects_response}"

node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const body=JSON.parse(d); if(body.data.some((project)=>project.id===Number(process.argv[1]))) process.exit(1)})" "${project_id}" < "${active_projects_response}"

curl -fsS \
  -H "Cookie: ${SESSION_COOKIE}=${SESSION_TOKEN}" \
  "${API_BASE_URL}/api/v1/todo/projects?archived=true" > "${archived_projects_response}"

node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const body=JSON.parse(d); if(!body.data.some((project)=>project.id===Number(process.argv[1]) && project.archived === true)) process.exit(1)})" "${project_id}" < "${archived_projects_response}"

curl -fsS \
  -H "Cookie: ${SESSION_COOKIE}=${SESSION_TOKEN}" \
  "${API_BASE_URL}/api/v1/todo/tasks" > "${all_tasks_response}"

node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const body=JSON.parse(d); if(body.data.some((task)=>task.id===Number(process.argv[1]))) process.exit(1)})" "${project_task_id}" < "${all_tasks_response}"

curl -fsS \
  -H "Cookie: ${SESSION_COOKIE}=${SESSION_TOKEN}" \
  "${API_BASE_URL}/api/v1/todo/tasks?project_id=${project_id}" > "${project_tasks_response}"

node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const body=JSON.parse(d); if(!body.data.some((task)=>task.id===Number(process.argv[1]))) process.exit(1)})" "${project_task_id}" < "${project_tasks_response}"

curl -fsS \
  -X PATCH \
  -H "Content-Type: application/json" \
  -H "Cookie: ${SESSION_COOKIE}=${SESSION_TOKEN}" \
  "${API_BASE_URL}/api/v1/todo/projects/${project_id}/restore" > "${restore_response}"

node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{if(JSON.parse(d).data.archived !== false) process.exit(1)})" < "${restore_response}"

curl -fsS \
  -X DELETE \
  -H "Cookie: ${SESSION_COOKIE}=${SESSION_TOKEN}" \
  "${API_BASE_URL}/api/v1/todo/projects/${project_id}" > /dev/null

curl -fsS \
  -H "Cookie: ${SESSION_COOKIE}=${SESSION_TOKEN}" \
  "${API_BASE_URL}/api/v1/todo/tasks?project_id=${project_id}" > "${project_tasks_response}"

node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const body=JSON.parse(d); if(body.data.some((task)=>task.id===Number(process.argv[1]))) process.exit(1)})" "${project_task_id}" < "${project_tasks_response}"

curl -fsS \
  -H "Cookie: ${SESSION_COOKIE}=${SESSION_TOKEN}" \
  "${API_BASE_URL}/api/v1/todo/tasks?view=inbox" > "${list_response}"

node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const body=JSON.parse(d); if(!body.data.some((task)=>task.id===Number(process.argv[1]))) process.exit(1)})" "${task_id}" < "${list_response}"

curl -fsS \
  -X DELETE \
  -H "Cookie: ${SESSION_COOKIE}=${SESSION_TOKEN}" \
  "${API_BASE_URL}/api/v1/todo/tasks/${task_id}" > /dev/null

printf 'Todo integration smoke passed with task id %s\n' "${task_id}"
