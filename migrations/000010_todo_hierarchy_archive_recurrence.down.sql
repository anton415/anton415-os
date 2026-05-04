UPDATE todo_tasks
SET repeat_frequency = 'daily'
WHERE repeat_frequency IN ('weekdays', 'weekends');

ALTER TABLE todo_tasks
    DROP CONSTRAINT IF EXISTS todo_tasks_repeat_frequency_check,
    ADD CONSTRAINT todo_tasks_repeat_frequency_check CHECK (
        repeat_frequency IN ('none', 'daily', 'weekly', 'monthly', 'yearly')
    );

DROP INDEX IF EXISTS idx_todo_tasks_parent_task_id;

ALTER TABLE todo_tasks
    DROP CONSTRAINT IF EXISTS todo_tasks_parent_not_self_check,
    DROP COLUMN IF EXISTS parent_task_id;

DROP INDEX IF EXISTS idx_todo_projects_parent_project_id;

ALTER TABLE todo_projects
    DROP CONSTRAINT IF EXISTS todo_projects_parent_not_self_check,
    DROP COLUMN IF EXISTS parent_project_id;
