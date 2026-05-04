ALTER TABLE todo_projects
    ADD COLUMN archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_todo_projects_archived ON todo_projects(archived);

ALTER TABLE todo_tasks
    DROP CONSTRAINT IF EXISTS todo_tasks_project_id_fkey,
    ADD CONSTRAINT todo_tasks_project_id_fkey
        FOREIGN KEY (project_id)
        REFERENCES todo_projects(id)
        ON DELETE CASCADE;
