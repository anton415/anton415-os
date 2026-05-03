package domain

type ExpenseCategory string

const (
	ExpenseCategoryRestaurants   ExpenseCategory = "restaurants"
	ExpenseCategoryGroceries     ExpenseCategory = "groceries"
	ExpenseCategoryPersonal      ExpenseCategory = "personal"
	ExpenseCategoryUtilities     ExpenseCategory = "utilities"
	ExpenseCategoryTransport     ExpenseCategory = "transport"
	ExpenseCategoryGifts         ExpenseCategory = "gifts"
	ExpenseCategoryInvestments   ExpenseCategory = "investments"
	ExpenseCategoryEntertainment ExpenseCategory = "entertainment"
	ExpenseCategoryEducation     ExpenseCategory = "education"
)

type ExpenseCategoryClassification string

const (
	ExpenseCategoryClassificationExpense  ExpenseCategoryClassification = "expense"
	ExpenseCategoryClassificationTransfer ExpenseCategoryClassification = "transfer"
)

type ExpenseLimitPeriod string

const (
	ExpenseLimitPeriodMonthly ExpenseLimitPeriod = "monthly"
	ExpenseLimitPeriodAnnual  ExpenseLimitPeriod = "annual"
)

type ExpenseLimitKind string

const (
	ExpenseLimitKindLimit          ExpenseLimitKind = "limit"
	ExpenseLimitKindInvestmentGoal ExpenseLimitKind = "investment_goal"
)

type ExpenseCategoryInfo struct {
	Code           ExpenseCategory
	Label          string
	Classification ExpenseCategoryClassification
	LimitPeriod    ExpenseLimitPeriod
	LimitKind      ExpenseLimitKind
}

var expenseCategoryInfos = []ExpenseCategoryInfo{
	{Code: ExpenseCategoryRestaurants, Label: "Restaurants", Classification: ExpenseCategoryClassificationExpense, LimitPeriod: ExpenseLimitPeriodMonthly, LimitKind: ExpenseLimitKindLimit},
	{Code: ExpenseCategoryGroceries, Label: "Groceries", Classification: ExpenseCategoryClassificationExpense, LimitPeriod: ExpenseLimitPeriodMonthly, LimitKind: ExpenseLimitKindLimit},
	{Code: ExpenseCategoryPersonal, Label: "Personal", Classification: ExpenseCategoryClassificationExpense, LimitPeriod: ExpenseLimitPeriodMonthly, LimitKind: ExpenseLimitKindLimit},
	{Code: ExpenseCategoryUtilities, Label: "Utilities", Classification: ExpenseCategoryClassificationExpense, LimitPeriod: ExpenseLimitPeriodMonthly, LimitKind: ExpenseLimitKindLimit},
	{Code: ExpenseCategoryTransport, Label: "Transport", Classification: ExpenseCategoryClassificationExpense, LimitPeriod: ExpenseLimitPeriodMonthly, LimitKind: ExpenseLimitKindLimit},
	{Code: ExpenseCategoryGifts, Label: "Gifts", Classification: ExpenseCategoryClassificationExpense, LimitPeriod: ExpenseLimitPeriodMonthly, LimitKind: ExpenseLimitKindLimit},
	{Code: ExpenseCategoryInvestments, Label: "Investments", Classification: ExpenseCategoryClassificationTransfer, LimitPeriod: ExpenseLimitPeriodAnnual, LimitKind: ExpenseLimitKindInvestmentGoal},
	{Code: ExpenseCategoryEntertainment, Label: "Entertainment", Classification: ExpenseCategoryClassificationExpense, LimitPeriod: ExpenseLimitPeriodAnnual, LimitKind: ExpenseLimitKindLimit},
	{Code: ExpenseCategoryEducation, Label: "Education", Classification: ExpenseCategoryClassificationExpense, LimitPeriod: ExpenseLimitPeriodAnnual, LimitKind: ExpenseLimitKindLimit},
}

func ExpenseCategories() []ExpenseCategoryInfo {
	categories := make([]ExpenseCategoryInfo, len(expenseCategoryInfos))
	copy(categories, expenseCategoryInfos)
	return categories
}

func ParseExpenseCategory(value string) (ExpenseCategory, error) {
	category := ExpenseCategory(value)
	if !category.Valid() {
		return "", ErrInvalidExpenseCategory
	}
	return category, nil
}

func (category ExpenseCategory) Valid() bool {
	for _, info := range expenseCategoryInfos {
		if info.Code == category {
			return true
		}
	}
	return false
}

func (category ExpenseCategory) Classification() ExpenseCategoryClassification {
	for _, info := range expenseCategoryInfos {
		if info.Code == category {
			return info.Classification
		}
	}
	return ""
}

func (category ExpenseCategory) LimitPeriod() (ExpenseLimitPeriod, bool) {
	for _, info := range expenseCategoryInfos {
		if info.Code == category && info.LimitPeriod != "" {
			return info.LimitPeriod, true
		}
	}
	return "", false
}

func (category ExpenseCategory) LimitKind() (ExpenseLimitKind, bool) {
	for _, info := range expenseCategoryInfos {
		if info.Code == category && info.LimitKind != "" {
			return info.LimitKind, true
		}
	}
	return "", false
}

func (category ExpenseCategory) SupportsLimit() bool {
	_, ok := category.LimitPeriod()
	return ok
}
