ALTER TABLE todo_projects
    ADD COLUMN start_date DATE,
    ADD COLUMN end_date DATE,
    ADD CONSTRAINT todo_projects_period_check CHECK (
        start_date IS NULL OR end_date IS NULL OR start_date <= end_date
    );

ALTER TABLE todo_tasks
    ADD COLUMN due_time TIME,
    ADD COLUMN repeat_frequency TEXT NOT NULL DEFAULT 'none' CHECK (repeat_frequency IN ('none', 'daily', 'weekly', 'monthly', 'yearly')),
    ADD COLUMN repeat_interval INTEGER NOT NULL DEFAULT 1 CHECK (repeat_interval > 0),
    ADD COLUMN repeat_until DATE,
    ADD COLUMN flagged BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN priority TEXT NOT NULL DEFAULT 'none' CHECK (priority IN ('none', 'low', 'medium', 'high')),
    ADD CONSTRAINT todo_tasks_due_time_requires_date_check CHECK (
        due_time IS NULL OR due_date IS NOT NULL
    ),
    ADD CONSTRAINT todo_tasks_repeat_requires_date_check CHECK (
        repeat_frequency = 'none' OR due_date IS NOT NULL
    ),
    ADD CONSTRAINT todo_tasks_repeat_until_requires_repeat_check CHECK (
        repeat_frequency <> 'none' OR repeat_until IS NULL
    ),
    ADD CONSTRAINT todo_tasks_repeat_until_after_due_check CHECK (
        repeat_until IS NULL OR due_date IS NULL OR repeat_until >= due_date
    );

CREATE INDEX idx_todo_tasks_due_datetime ON todo_tasks(due_date, due_time) WHERE due_date IS NOT NULL;
CREATE INDEX idx_todo_tasks_flagged ON todo_tasks(flagged) WHERE flagged = true;
CREATE INDEX idx_todo_tasks_priority ON todo_tasks(priority);
