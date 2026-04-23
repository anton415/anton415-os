CREATE TABLE todo_projects (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE todo_tasks (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT REFERENCES todo_projects(id) ON DELETE RESTRICT,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    CHECK (
        (status = 'done' AND completed_at IS NOT NULL)
        OR
        (status <> 'done' AND completed_at IS NULL)
    )
);

CREATE INDEX idx_todo_tasks_project_id ON todo_tasks(project_id);
CREATE INDEX idx_todo_tasks_status ON todo_tasks(status);
CREATE INDEX idx_todo_tasks_due_date ON todo_tasks(due_date) WHERE due_date IS NOT NULL;
