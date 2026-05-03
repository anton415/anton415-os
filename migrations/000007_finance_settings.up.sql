CREATE TABLE finance_settings (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
    currency TEXT NOT NULL DEFAULT 'RUB' CHECK (currency = 'RUB'),
    salary_kopecks BIGINT NOT NULL DEFAULT 0 CHECK (salary_kopecks >= 0),
    bonus_percent_basis_points BIGINT NOT NULL DEFAULT 0 CHECK (bonus_percent_basis_points >= 0)
);

CREATE TABLE finance_expense_limit_settings (
    category TEXT PRIMARY KEY CHECK (
        category IN (
            'restaurants',
            'groceries',
            'personal',
            'utilities',
            'transport',
            'gifts',
            'investments',
            'entertainment',
            'education'
        )
    ),
    percent_basis_points BIGINT NOT NULL CHECK (percent_basis_points >= 0)
);
