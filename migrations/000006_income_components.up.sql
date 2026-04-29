ALTER TABLE finance_monthly_income_actuals
    ADD COLUMN salary_kopecks BIGINT NOT NULL DEFAULT 0 CHECK (salary_kopecks >= 0),
    ADD COLUMN bonus_percent_basis_points BIGINT NOT NULL DEFAULT 0 CHECK (bonus_percent_basis_points >= 0);
