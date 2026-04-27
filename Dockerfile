FROM node:22-alpine AS web-builder
WORKDIR /workspace/apps/web
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web ./
RUN npm run build

FROM golang:1.26-alpine AS api-builder
WORKDIR /workspace
COPY go.mod go.sum ./
RUN go mod download
COPY apps ./apps
COPY internal ./internal
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/anton415-os ./apps/api

FROM alpine:3.21
RUN addgroup -S app && adduser -S app -G app && apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=api-builder /out/anton415-os /app/anton415-os
COPY --from=web-builder /workspace/apps/web/dist /app/web
COPY migrations /app/migrations
ENV APP_ENV=production \
    HTTP_ADDR=:8080 \
    STATIC_DIR=/app/web
USER app
EXPOSE 8080
ENTRYPOINT ["/app/anton415-os"]
