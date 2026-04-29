package domain

import (
	"errors"
	"testing"
)

func TestParseMoneyFormatsRUBDecimalStrings(t *testing.T) {
	tests := map[string]struct {
		input   string
		kopecks int64
		decimal string
	}{
		"integer":   {input: "1500", kopecks: 150000, decimal: "1500.00"},
		"one digit": {input: "1500.5", kopecks: 150050, decimal: "1500.50"},
		"two digits": {
			input:   "1500.05",
			kopecks: 150005,
			decimal: "1500.05",
		},
		"trimmed": {input: " 0.01 ", kopecks: 1, decimal: "0.01"},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			money, err := ParseMoney(test.input)
			if err != nil {
				t.Fatalf("ParseMoney() error = %v", err)
			}
			if money.Kopecks() != test.kopecks {
				t.Fatalf("Kopecks() = %d, want %d", money.Kopecks(), test.kopecks)
			}
			if money.Decimal() != test.decimal {
				t.Fatalf("Decimal() = %q, want %q", money.Decimal(), test.decimal)
			}
		})
	}
}

func TestParseMoneyRejectsInvalidAmounts(t *testing.T) {
	for _, input := range []string{"", "-1.00", "+1.00", "1.001", "1,00", "abc", ".10"} {
		_, err := ParseMoney(input)
		if !errors.Is(err, ErrInvalidMoney) {
			t.Fatalf("ParseMoney(%q) error = %v, want ErrInvalidMoney", input, err)
		}
	}
}

func TestAverageMoneyRoundsHalfUpToKopecks(t *testing.T) {
	total := MustMoneyFromKopecks(100)

	if got := AverageMoney(total, 3).Decimal(); got != "0.33" {
		t.Fatalf("AverageMoney(100, 3) = %s, want 0.33", got)
	}
	if got := AverageMoney(total, 6).Decimal(); got != "0.17" {
		t.Fatalf("AverageMoney(100, 6) = %s, want 0.17", got)
	}
}
