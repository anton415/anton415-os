ALTER TABLE todo_projects
    ADD COLUMN parent_project_id BIGINT REFERENCES todo_projects(id) ON DELETE SET NULL,
    ADD CONSTRAINT todo_projects_parent_not_self_check CHECK (
        parent_project_id IS NULL OR parent_project_id <> id
    );

CREATE INDEX idx_todo_projects_parent_project_id ON todo_projects(parent_project_id) WHERE parent_project_id IS NOT NULL;

INSERT INTO todo_projects (name, archived, created_at, updated_at)
SELECT 'Архив', false, now(), now()
WHERE NOT EXISTS (
    SELECT 1
    FROM todo_projects
    WHERE lower(name) = lower('Архив')
);

ALTER TABLE todo_tasks
    ADD COLUMN parent_task_id BIGINT REFERENCES todo_tasks(id) ON DELETE SET NULL,
    ADD CONSTRAINT todo_tasks_parent_not_self_check CHECK (
        parent_task_id IS NULL OR parent_task_id <> id
    );

CREATE INDEX idx_todo_tasks_parent_task_id ON todo_tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;

ALTER TABLE todo_tasks
    DROP CONSTRAINT IF EXISTS todo_tasks_repeat_frequency_check,
    ADD CONSTRAINT todo_tasks_repeat_frequency_check CHECK (
        repeat_frequency IN ('none', 'daily', 'weekdays', 'weekends', 'weekly', 'monthly', 'yearly')
    );
