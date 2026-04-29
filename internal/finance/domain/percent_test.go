package domain

import (
	"errors"
	"testing"
)

func TestPercentParseAndFormat(t *testing.T) {
	tests := map[string]string{
		"0":     "0.00",
		"15":    "15.00",
		"15.5":  "15.50",
		"15.25": "15.25",
	}

	for input, want := range tests {
		percent, err := ParsePercent(input)
		if err != nil {
			t.Fatalf("ParsePercent(%q) error = %v", input, err)
		}
		if got := percent.Decimal(); got != want {
			t.Fatalf("ParsePercent(%q).Decimal() = %s, want %s", input, got, want)
		}
	}
}

func TestPercentRejectsInvalidValues(t *testing.T) {
	inputs := []string{"", "-1", "+1", "abc", "1.001"}
	for _, input := range inputs {
		_, err := ParsePercent(input)
		if !errors.Is(err, ErrInvalidPercent) {
			t.Fatalf("ParsePercent(%q) error = %v, want ErrInvalidPercent", input, err)
		}
	}
}
