package domain

import (
	"fmt"
	"strconv"
	"strings"
)

type Percent struct {
	basisPoints int64
}

func NewPercentFromBasisPoints(basisPoints int64) (Percent, error) {
	if basisPoints < 0 {
		return Percent{}, ErrInvalidPercent
	}
	return Percent{basisPoints: basisPoints}, nil
}

func MustPercentFromBasisPoints(basisPoints int64) Percent {
	percent, err := NewPercentFromBasisPoints(basisPoints)
	if err != nil {
		panic(err)
	}
	return percent
}

func ZeroPercent() Percent {
	return Percent{}
}

func ParsePercent(value string) (Percent, error) {
	text := strings.TrimSpace(value)
	if text == "" || strings.HasPrefix(text, "-") || strings.HasPrefix(text, "+") {
		return Percent{}, ErrInvalidPercent
	}

	integerPart, fractionalPart, hasFraction := strings.Cut(text, ".")
	if integerPart == "" || !digitsOnly(integerPart) {
		return Percent{}, ErrInvalidPercent
	}
	if !hasFraction {
		fractionalPart = "00"
	}
	if fractionalPart == "" {
		fractionalPart = "00"
	}
	if len(fractionalPart) > 2 || !digitsOnly(fractionalPart) {
		return Percent{}, ErrInvalidPercent
	}
	if len(fractionalPart) == 1 {
		fractionalPart += "0"
	}

	basisPoints, err := strconv.ParseInt(integerPart+fractionalPart, 10, 64)
	if err != nil {
		return Percent{}, ErrInvalidPercent
	}
	return NewPercentFromBasisPoints(basisPoints)
}

func (percent Percent) BasisPoints() int64 {
	return percent.basisPoints
}

func (percent Percent) Decimal() string {
	return fmt.Sprintf("%d.%02d", percent.basisPoints/100, percent.basisPoints%100)
}

func (percent Percent) IsZero() bool {
	return percent.basisPoints == 0
}
