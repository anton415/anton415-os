package domain

import (
	"fmt"
	"strconv"
	"strings"
	"unicode"
)

type Money struct {
	kopecks int64
}

func NewMoneyFromKopecks(kopecks int64) (Money, error) {
	if kopecks < 0 {
		return Money{}, ErrInvalidMoney
	}
	return Money{kopecks: kopecks}, nil
}

func MustMoneyFromKopecks(kopecks int64) Money {
	money, err := NewMoneyFromKopecks(kopecks)
	if err != nil {
		panic(err)
	}
	return money
}

func ZeroMoney() Money {
	return Money{}
}

func ParseMoney(value string) (Money, error) {
	text := strings.TrimSpace(value)
	if text == "" || strings.HasPrefix(text, "-") || strings.HasPrefix(text, "+") {
		return Money{}, ErrInvalidMoney
	}

	integerPart, fractionalPart, hasFraction := strings.Cut(text, ".")
	if integerPart == "" || !digitsOnly(integerPart) {
		return Money{}, ErrInvalidMoney
	}
	if !hasFraction {
		fractionalPart = "00"
	}
	if fractionalPart == "" {
		fractionalPart = "00"
	}
	if len(fractionalPart) > 2 || !digitsOnly(fractionalPart) {
		return Money{}, ErrInvalidMoney
	}
	if len(fractionalPart) == 1 {
		fractionalPart += "0"
	}

	kopecks, err := strconv.ParseInt(integerPart+fractionalPart, 10, 64)
	if err != nil {
		return Money{}, ErrInvalidMoney
	}
	return NewMoneyFromKopecks(kopecks)
}

func (money Money) Kopecks() int64 {
	return money.kopecks
}

func (money Money) Decimal() string {
	return fmt.Sprintf("%d.%02d", money.kopecks/100, money.kopecks%100)
}

func (money Money) IsZero() bool {
	return money.kopecks == 0
}

func (money Money) Add(other Money) Money {
	return Money{kopecks: money.kopecks + other.kopecks}
}

func AverageMoney(total Money, count int) Money {
	if count <= 0 || total.IsZero() {
		return ZeroMoney()
	}

	quotient := total.kopecks / int64(count)
	remainder := total.kopecks % int64(count)
	if remainder*2 >= int64(count) {
		quotient++
	}
	return Money{kopecks: quotient}
}

func digitsOnly(value string) bool {
	for _, char := range value {
		if !unicode.IsDigit(char) {
			return false
		}
	}
	return true
}
