ALTER TABLE todo_tasks
    DROP CONSTRAINT IF EXISTS todo_tasks_project_id_fkey,
    ADD CONSTRAINT todo_tasks_project_id_fkey
        FOREIGN KEY (project_id)
        REFERENCES todo_projects(id)
        ON DELETE RESTRICT;

DROP INDEX IF EXISTS idx_todo_projects_archived;

ALTER TABLE todo_projects
    DROP COLUMN IF EXISTS archived;
