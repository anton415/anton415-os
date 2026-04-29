CREATE TABLE finance_monthly_expense_actuals (
    year INTEGER NOT NULL CHECK (year BETWEEN 1 AND 9999),
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    currency TEXT NOT NULL DEFAULT 'RUB' CHECK (currency = 'RUB'),
    restaurants_kopecks BIGINT NOT NULL DEFAULT 0 CHECK (restaurants_kopecks >= 0),
    groceries_kopecks BIGINT NOT NULL DEFAULT 0 CHECK (groceries_kopecks >= 0),
    personal_kopecks BIGINT NOT NULL DEFAULT 0 CHECK (personal_kopecks >= 0),
    utilities_kopecks BIGINT NOT NULL DEFAULT 0 CHECK (utilities_kopecks >= 0),
    transport_kopecks BIGINT NOT NULL DEFAULT 0 CHECK (transport_kopecks >= 0),
    gifts_kopecks BIGINT NOT NULL DEFAULT 0 CHECK (gifts_kopecks >= 0),
    investments_kopecks BIGINT NOT NULL DEFAULT 0 CHECK (investments_kopecks >= 0),
    entertainment_kopecks BIGINT NOT NULL DEFAULT 0 CHECK (entertainment_kopecks >= 0),
    education_kopecks BIGINT NOT NULL DEFAULT 0 CHECK (education_kopecks >= 0),
    PRIMARY KEY (year, month)
);

CREATE TABLE finance_monthly_income_actuals (
    year INTEGER NOT NULL CHECK (year BETWEEN 1 AND 9999),
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    currency TEXT NOT NULL DEFAULT 'RUB' CHECK (currency = 'RUB'),
    total_kopecks BIGINT NOT NULL DEFAULT 0 CHECK (total_kopecks >= 0),
    PRIMARY KEY (year, month)
);
