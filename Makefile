COMPOSE ?= docker compose
GO_IMAGE ?= golang:1.24-alpine
GO_DOCKER = docker run --rm -v "$(CURDIR)":/workspace -w /workspace $(GO_IMAGE)
GO ?= $(if $(shell command -v go 2>/dev/null),go,$(GO_DOCKER) go)
GOFMT ?= $(if $(shell command -v gofmt 2>/dev/null),gofmt,$(GO_DOCKER) gofmt)
GO_FILES := $(shell find . -name "*.go" -not -path "./.git/*" -not -path "./apps/web/node_modules/*")
MIGRATE_DATABASE_URL ?= postgres://anton415:anton415@postgres:5432/anton415_os?sslmode=disable
WEB_DIR := apps/web

.PHONY: dev api web db stop test lint build migrate-up migrate-down docker-config go-mod-tidy

dev:
	$(COMPOSE) up postgres api web

api:
	$(COMPOSE) up postgres api

web:
	cd $(WEB_DIR) && npm install && npm run dev

db:
	$(COMPOSE) up -d postgres

stop:
	$(COMPOSE) down

test:
	$(GO) test ./...

lint:
	test -z "$$($(GOFMT) -l $(GO_FILES))"
	$(GO) vet ./...
	cd $(WEB_DIR) && npm install && npm run check

build:
	$(GO) build ./...
	cd $(WEB_DIR) && npm install && npm run build

migrate-up: db
	$(COMPOSE) run --rm migrate -path /migrations -database "$(MIGRATE_DATABASE_URL)" up

migrate-down: db
	$(COMPOSE) run --rm migrate -path /migrations -database "$(MIGRATE_DATABASE_URL)" down 1

docker-config:
	$(COMPOSE) config

go-mod-tidy:
	$(GO) mod tidy
