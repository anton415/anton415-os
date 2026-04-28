DROP INDEX IF EXISTS idx_todo_tasks_priority;
DROP INDEX IF EXISTS idx_todo_tasks_flagged;
DROP INDEX IF EXISTS idx_todo_tasks_due_datetime;

ALTER TABLE todo_tasks
    DROP CONSTRAINT IF EXISTS todo_tasks_repeat_until_after_due_check,
    DROP CONSTRAINT IF EXISTS todo_tasks_repeat_until_requires_repeat_check,
    DROP CONSTRAINT IF EXISTS todo_tasks_repeat_requires_date_check,
    DROP CONSTRAINT IF EXISTS todo_tasks_due_time_requires_date_check,
    DROP COLUMN IF EXISTS priority,
    DROP COLUMN IF EXISTS flagged,
    DROP COLUMN IF EXISTS repeat_until,
    DROP COLUMN IF EXISTS repeat_interval,
    DROP COLUMN IF EXISTS repeat_frequency,
    DROP COLUMN IF EXISTS due_time;

ALTER TABLE todo_projects
    DROP CONSTRAINT IF EXISTS todo_projects_period_check,
    DROP COLUMN IF EXISTS end_date,
    DROP COLUMN IF EXISTS start_date;
