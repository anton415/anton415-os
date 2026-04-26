#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: deploy/lockbox-sync.sh <env-file> <lockbox-secret-id>

Reads KEY=value lines from a local env file and uploads them as a new
Yandex Lockbox secret version. The env file should stay gitignored.
USAGE
}

if [[ $# -ne 2 ]]; then
  usage
  exit 64
fi

env_file="$1"
secret_id="$2"
yc_bin="${YC_BIN:-yc}"

if [[ ! -f "$env_file" ]]; then
  echo "env file not found: $env_file" >&2
  exit 66
fi

payload_file="$(mktemp)"
trap 'rm -f "$payload_file"' EXIT

python3 - "$env_file" > "$payload_file" <<'PY'
import json
import re
import sys

env_file = sys.argv[1]
key_pattern = re.compile(r"^[A-Z0-9_]+$")
entries = []

with open(env_file, "r", encoding="utf-8") as fh:
    for line_number, raw_line in enumerate(fh, start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise SystemExit(f"{env_file}:{line_number}: expected KEY=value")

        key, value = line.split("=", 1)
        key = key.strip()
        if not key_pattern.match(key):
            raise SystemExit(f"{env_file}:{line_number}: invalid key {key!r}")

        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]

        entries.append({"key": key, "text_value": value})

print(json.dumps(entries, ensure_ascii=False))
PY

"$yc_bin" lockbox secret add-version \
  --id "$secret_id" \
  --description "runtime env $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --payload - < "$payload_file"
