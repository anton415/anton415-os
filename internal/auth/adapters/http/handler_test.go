package http

import "testing"

func TestSuccessRedirectForKeepsConfiguredOrigin(t *testing.T) {
	config := Config{SuccessRedirect: "https://todo.anton415.ru/todo"}

	got := config.successRedirectFor("/finance?tab=overview")
	want := "https://todo.anton415.ru/finance?tab=overview"

	if got != want {
		t.Fatalf("successRedirectFor() = %q, want %q", got, want)
	}
}

func TestSuccessRedirectForRejectsExternalRedirects(t *testing.T) {
	config := Config{SuccessRedirect: "https://todo.anton415.ru/todo"}

	got := config.successRedirectFor("//evil.example/path")
	want := "https://todo.anton415.ru/todo"

	if got != want {
		t.Fatalf("successRedirectFor() = %q, want %q", got, want)
	}
}

func TestSuccessRedirectForUsesConfiguredDefaultWithoutRequestedPath(t *testing.T) {
	config := Config{SuccessRedirect: "https://todo.anton415.ru/todo"}

	got := config.successRedirectFor("")
	want := "https://todo.anton415.ru/todo"

	if got != want {
		t.Fatalf("successRedirectFor() = %q, want %q", got, want)
	}
}
