package http

import (
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/anton415/anton415-hub/internal/auth"
)

type RateLimitConfig struct {
	Enabled bool
	Limit   int
	Window  time.Duration
	Now     func() time.Time
}

type rateLimiter struct {
	mu          sync.Mutex
	limit       int
	window      time.Duration
	now         func() time.Time
	buckets     map[string]rateLimitBucket
	lastCleanup time.Time
}

type rateLimitBucket struct {
	count   int
	resetAt time.Time
}

type rateLimitResult struct {
	Allowed    bool
	RetryAfter time.Duration
}

func newRateLimiter(config RateLimitConfig) *rateLimiter {
	if !config.Enabled || config.Limit <= 0 || config.Window <= 0 {
		return nil
	}

	now := config.Now
	if now == nil {
		now = time.Now
	}

	return &rateLimiter{
		limit:   config.Limit,
		window:  config.Window,
		now:     now,
		buckets: map[string]rateLimitBucket{},
	}
}

func (limiter *rateLimiter) Allow(key string) rateLimitResult {
	now := limiter.now().UTC()

	limiter.mu.Lock()
	defer limiter.mu.Unlock()

	limiter.cleanup(now)

	bucket := limiter.buckets[key]
	if bucket.resetAt.IsZero() || !bucket.resetAt.After(now) {
		bucket = rateLimitBucket{resetAt: now.Add(limiter.window)}
	}

	if bucket.count >= limiter.limit {
		limiter.buckets[key] = bucket
		return rateLimitResult{Allowed: false, RetryAfter: bucket.resetAt.Sub(now)}
	}

	bucket.count++
	limiter.buckets[key] = bucket
	return rateLimitResult{Allowed: true}
}

func (limiter *rateLimiter) cleanup(now time.Time) {
	if !limiter.lastCleanup.IsZero() && now.Sub(limiter.lastCleanup) < limiter.window {
		return
	}
	limiter.lastCleanup = now

	for key, bucket := range limiter.buckets {
		if !bucket.resetAt.After(now) {
			delete(limiter.buckets, key)
		}
	}
}

func (handler Handler) allowAuthRequest(w http.ResponseWriter, r *http.Request, route string, subject string) bool {
	if handler.rateLimiter == nil {
		return true
	}

	key := strings.Join([]string{route, rateLimitClientIP(r), subject}, "\x00")
	result := handler.rateLimiter.Allow(key)
	if result.Allowed {
		return true
	}

	if seconds := retryAfterSeconds(result.RetryAfter); seconds > 0 {
		w.Header().Set("Retry-After", strconv.Itoa(seconds))
	}
	writeErrorResponse(w, http.StatusTooManyRequests, "rate_limited", "too many authentication attempts; try again later")
	return false
}

func retryAfterSeconds(duration time.Duration) int {
	if duration <= 0 {
		return 1
	}
	seconds := int(duration / time.Second)
	if duration%time.Second != 0 {
		seconds++
	}
	if seconds < 1 {
		return 1
	}
	return seconds
}

func rateLimitClientIP(r *http.Request) string {
	remoteAddr := strings.TrimSpace(r.RemoteAddr)
	if host, _, err := net.SplitHostPort(remoteAddr); err == nil && strings.TrimSpace(host) != "" {
		return host
	}
	if remoteAddr != "" {
		return remoteAddr
	}
	return "unknown"
}

func normalizedRateLimitSubject(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if normalized == "" {
		return "unknown"
	}
	return normalized
}

func normalizedEmailRateLimitSubject(email string) string {
	if normalized := auth.NormalizeEmail(email); normalized != "" {
		return normalized
	}
	return normalizedRateLimitSubject(email)
}
