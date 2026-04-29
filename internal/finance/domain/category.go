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

type ExpenseCategoryInfo struct {
	Code           ExpenseCategory
	Label          string
	Classification ExpenseCategoryClassification
}

var expenseCategoryInfos = []ExpenseCategoryInfo{
	{Code: ExpenseCategoryRestaurants, Label: "Restaurants", Classification: ExpenseCategoryClassificationExpense},
	{Code: ExpenseCategoryGroceries, Label: "Groceries", Classification: ExpenseCategoryClassificationExpense},
	{Code: ExpenseCategoryPersonal, Label: "Personal", Classification: ExpenseCategoryClassificationExpense},
	{Code: ExpenseCategoryUtilities, Label: "Utilities", Classification: ExpenseCategoryClassificationExpense},
	{Code: ExpenseCategoryTransport, Label: "Transport", Classification: ExpenseCategoryClassificationExpense},
	{Code: ExpenseCategoryGifts, Label: "Gifts", Classification: ExpenseCategoryClassificationExpense},
	{Code: ExpenseCategoryInvestments, Label: "Investments", Classification: ExpenseCategoryClassificationTransfer},
	{Code: ExpenseCategoryEntertainment, Label: "Entertainment", Classification: ExpenseCategoryClassificationExpense},
	{Code: ExpenseCategoryEducation, Label: "Education", Classification: ExpenseCategoryClassificationExpense},
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
