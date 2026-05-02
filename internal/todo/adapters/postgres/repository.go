package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/anton415/anton415-hub/internal/todo/application"
	"github.com/anton415/anton415-hub/internal/todo/domain"
)

const (
	foreignKeyViolation = "23503"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (repo *Repository) ListProjects(ctx context.Context) ([]domain.Project, error) {
	rows, err := repo.pool.Query(ctx, `
		SELECT id, name, start_date, end_date, created_at, updated_at
		FROM todo_projects
		ORDER BY lower(name), id
	`)
	if err != nil {
		return nil, fmt.Errorf("list todo projects: %w", err)
	}
	defer rows.Close()

	projects := []domain.Project{}
	for rows.Next() {
		project, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		projects = append(projects, project)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list todo projects rows: %w", err)
	}

	return projects, nil
}

func (repo *Repository) GetProject(ctx context.Context, id int64) (domain.Project, error) {
	project, err := scanProject(repo.pool.QueryRow(ctx, `
		SELECT id, name, start_date, end_date, created_at, updated_at
		FROM todo_projects
		WHERE id = $1
	`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Project{}, application.ErrNotFound
	}
	if err != nil {
		return domain.Project{}, err
	}
	return project, nil
}

func (repo *Repository) CreateProject(ctx context.Context, project domain.Project) (domain.Project, error) {
	created, err := scanProject(repo.pool.QueryRow(ctx, `
		INSERT INTO todo_projects (name, start_date, end_date, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, start_date, end_date, created_at, updated_at
	`, project.Name, nullableDate(project.StartDate), nullableDate(project.EndDate), project.CreatedAt, project.UpdatedAt))
	if err != nil {
		return domain.Project{}, fmt.Errorf("create todo project: %w", err)
	}
	return created, nil
}

func (repo *Repository) UpdateProject(ctx context.Context, project domain.Project) (domain.Project, error) {
	updated, err := scanProject(repo.pool.QueryRow(ctx, `
		UPDATE todo_projects
		SET name = $2,
		    start_date = $3,
		    end_date = $4,
		    updated_at = $5
		WHERE id = $1
		RETURNING id, name, start_date, end_date, created_at, updated_at
	`, project.ID, project.Name, nullableDate(project.StartDate), nullableDate(project.EndDate), project.UpdatedAt))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Project{}, application.ErrNotFound
	}
	if err != nil {
		return domain.Project{}, err
	}
	return updated, nil
}

func (repo *Repository) DeleteProject(ctx context.Context, id int64) error {
	tag, err := repo.pool.Exec(ctx, `
		DELETE FROM todo_projects
		WHERE id = $1
	`, id)
	if isPostgresCode(err, foreignKeyViolation) {
		return application.ErrProjectHasTasks
	}
	if err != nil {
		return fmt.Errorf("delete todo project: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return application.ErrNotFound
	}
	return nil
}

func (repo *Repository) ListTasks(ctx context.Context, filter application.TaskListFilter) ([]domain.Task, error) {
	query, args := listTasksQuery(filter)
	rows, err := repo.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list todo tasks: %w", err)
	}
	defer rows.Close()

	tasks := []domain.Task{}
	for rows.Next() {
		task, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list todo tasks rows: %w", err)
	}

	return tasks, nil
}

func (repo *Repository) GetTask(ctx context.Context, id int64) (domain.Task, error) {
	task, err := scanTask(repo.pool.QueryRow(ctx, `
		SELECT id, project_id, title, notes, status, due_date, due_time, repeat_frequency, repeat_interval, repeat_until, flagged, priority, created_at, updated_at, completed_at
		FROM todo_tasks
		WHERE id = $1
	`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Task{}, application.ErrNotFound
	}
	if err != nil {
		return domain.Task{}, err
	}
	return task, nil
}

func (repo *Repository) CreateTask(ctx context.Context, task domain.Task) (domain.Task, error) {
	created, err := scanTask(repo.pool.QueryRow(ctx, `
		INSERT INTO todo_tasks (
			project_id, title, notes, status, due_date, due_time, repeat_frequency, repeat_interval, repeat_until, flagged, priority, created_at, updated_at, completed_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id, project_id, title, notes, status, due_date, due_time, repeat_frequency, repeat_interval, repeat_until, flagged, priority, created_at, updated_at, completed_at
	`,
		nullableInt64(task.ProjectID),
		task.Title,
		nullableString(task.Notes),
		task.Status,
		nullableDate(task.DueDate),
		nullableTimeOfDay(task.DueTime),
		task.RepeatFrequency,
		task.RepeatInterval,
		nullableDate(task.RepeatUntil),
		task.Flagged,
		task.Priority,
		task.CreatedAt,
		task.UpdatedAt,
		nullableTimestamp(task.CompletedAt),
	))
	if isPostgresCode(err, foreignKeyViolation) {
		return domain.Task{}, application.ErrNotFound
	}
	if err != nil {
		return domain.Task{}, fmt.Errorf("create todo task: %w", err)
	}
	return created, nil
}

func (repo *Repository) UpdateTask(ctx context.Context, task domain.Task) (domain.Task, error) {
	updated, err := scanTask(repo.pool.QueryRow(ctx, `
		UPDATE todo_tasks
		SET project_id = $2,
		    title = $3,
		    notes = $4,
		    status = $5,
		    due_date = $6,
		    due_time = $7,
		    repeat_frequency = $8,
		    repeat_interval = $9,
		    repeat_until = $10,
		    flagged = $11,
		    priority = $12,
		    updated_at = $13,
		    completed_at = $14
		WHERE id = $1
		RETURNING id, project_id, title, notes, status, due_date, due_time, repeat_frequency, repeat_interval, repeat_until, flagged, priority, created_at, updated_at, completed_at
	`,
		task.ID,
		nullableInt64(task.ProjectID),
		task.Title,
		nullableString(task.Notes),
		task.Status,
		nullableDate(task.DueDate),
		nullableTimeOfDay(task.DueTime),
		task.RepeatFrequency,
		task.RepeatInterval,
		nullableDate(task.RepeatUntil),
		task.Flagged,
		task.Priority,
		task.UpdatedAt,
		nullableTimestamp(task.CompletedAt),
	))
	if isPostgresCode(err, foreignKeyViolation) {
		return domain.Task{}, application.ErrNotFound
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Task{}, application.ErrNotFound
	}
	if err != nil {
		return domain.Task{}, err
	}
	return updated, nil
}

func (repo *Repository) DeleteTask(ctx context.Context, id int64) error {
	tag, err := repo.pool.Exec(ctx, `
		DELETE FROM todo_tasks
		WHERE id = $1
	`, id)
	if err != nil {
		return fmt.Errorf("delete todo task: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return application.ErrNotFound
	}
	return nil
}

func listTasksQuery(filter application.TaskListFilter) (string, []any) {
	query := strings.Builder{}
	query.WriteString(`
		SELECT id, project_id, title, notes, status, due_date, due_time, repeat_frequency, repeat_interval, repeat_until, flagged, priority, created_at, updated_at, completed_at
		FROM todo_tasks
	`)

	conditions := []string{}
	args := []any{}
	addArg := func(value any) string {
		args = append(args, value)
		return fmt.Sprintf("$%d", len(args))
	}

	switch filter.View {
	case application.TaskViewInbox:
		conditions = append(conditions, "project_id IS NULL", "status <> 'done'")
	case application.TaskViewToday:
		conditions = append(conditions, "due_date <= "+addArg(filter.Today.Format(time.DateOnly))+"::date", "status <> 'done'")
	case application.TaskViewUpcoming:
		conditions = append(conditions, "due_date > "+addArg(filter.Today.Format(time.DateOnly))+"::date", "status <> 'done'")
	case application.TaskViewOverdue:
		todayArg := addArg(filter.Today.Format(time.DateOnly))
		nowArg := addArg(filter.Now.Format("15:04"))
		conditions = append(conditions, "(due_date < "+todayArg+"::date OR (due_date = "+todayArg+"::date AND due_time IS NOT NULL AND due_time < "+nowArg+"::time))", "status <> 'done'")
	case application.TaskViewScheduled:
		conditions = append(conditions, "due_date IS NOT NULL", "status <> 'done'")
	case application.TaskViewFlagged:
		conditions = append(conditions, "flagged = true", "status <> 'done'")
	}

	if filter.Status != nil {
		conditions = append(conditions, "status = "+addArg(*filter.Status))
	}
	if filter.ProjectID != nil {
		conditions = append(conditions, "project_id = "+addArg(*filter.ProjectID))
	}
	if strings.TrimSpace(filter.Query) != "" {
		queryArg := addArg("%" + strings.ToLower(strings.TrimSpace(filter.Query)) + "%")
		conditions = append(conditions, "(lower(title) LIKE "+queryArg+" OR lower(coalesce(notes, '')) LIKE "+queryArg+")")
	}

	if len(conditions) > 0 {
		query.WriteString(" WHERE ")
		query.WriteString(strings.Join(conditions, " AND "))
	}

	query.WriteString(orderByClause(filter))

	return query.String(), args
}

func orderByClause(filter application.TaskListFilter) string {
	sortMode := filter.Sort
	if sortMode == "" {
		sortMode = application.TaskSortSmart
	}
	direction := "ASC"
	if filter.Direction == application.SortDirectionDesc && sortMode != application.TaskSortSmart {
		direction = "DESC"
	}

	switch sortMode {
	case application.TaskSortDue:
		return "\n\t\tORDER BY due_date " + direction + " NULLS LAST, due_time " + direction + " NULLS LAST, id " + direction + "\n\t"
	case application.TaskSortCreated:
		return "\n\t\tORDER BY created_at " + direction + ", id " + direction + "\n\t"
	case application.TaskSortTitle:
		return "\n\t\tORDER BY lower(title) " + direction + ", id " + direction + "\n\t"
	case application.TaskSortPriority:
		return "\n\t\tORDER BY " + priorityRankSQL() + " " + direction + ", id " + direction + "\n\t"
	default:
		return `
		ORDER BY
			CASE WHEN status = 'done' THEN 1 ELSE 0 END,
			due_date NULLS LAST,
			due_time NULLS LAST,
			` + priorityRankSQL() + ` DESC,
			flagged DESC,
			created_at DESC,
			id DESC
	`
	}
}

func priorityRankSQL() string {
	return "CASE priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END"
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanProject(row rowScanner) (domain.Project, error) {
	var (
		project   domain.Project
		startDate pgtype.Date
		endDate   pgtype.Date
	)
	if err := row.Scan(&project.ID, &project.Name, &startDate, &endDate, &project.CreatedAt, &project.UpdatedAt); err != nil {
		return domain.Project{}, err
	}
	project.StartDate = datePtr(startDate)
	project.EndDate = datePtr(endDate)
	return project, nil
}

func scanTask(row rowScanner) (domain.Task, error) {
	var (
		task        domain.Task
		projectID   pgtype.Int8
		notes       pgtype.Text
		status      string
		dueDate     pgtype.Date
		dueTime     pgtype.Time
		repeat      string
		repeatUntil pgtype.Date
		priority    string
		completedAt pgtype.Timestamptz
	)

	if err := row.Scan(
		&task.ID,
		&projectID,
		&task.Title,
		&notes,
		&status,
		&dueDate,
		&dueTime,
		&repeat,
		&task.RepeatInterval,
		&repeatUntil,
		&task.Flagged,
		&priority,
		&task.CreatedAt,
		&task.UpdatedAt,
		&completedAt,
	); err != nil {
		return domain.Task{}, err
	}

	taskStatus := domain.TaskStatus(status)
	if !taskStatus.Valid() {
		return domain.Task{}, domain.ErrInvalidTaskStatus
	}
	repeatFrequency := domain.RepeatFrequency(repeat)
	if !repeatFrequency.Valid() {
		return domain.Task{}, domain.ErrInvalidTaskRepeat
	}
	priorityValue := domain.TaskPriority(priority)
	if !priorityValue.Valid() {
		return domain.Task{}, domain.ErrInvalidTaskPriority
	}

	task.ProjectID = int64Ptr(projectID)
	task.Notes = stringPtr(notes)
	task.Status = taskStatus
	task.DueDate = datePtr(dueDate)
	task.DueTime = timeOfDayPtr(dueTime)
	task.RepeatFrequency = repeatFrequency
	task.RepeatUntil = datePtr(repeatUntil)
	task.Priority = priorityValue
	task.CompletedAt = timestampPtr(completedAt)

	return task, nil
}

func nullableInt64(value *int64) any {
	if value == nil {
		return nil
	}
	return *value
}

func nullableString(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}

func nullableDate(value *time.Time) any {
	if value == nil {
		return nil
	}
	return *value
}

func nullableTimestamp(value *time.Time) any {
	if value == nil {
		return nil
	}
	return *value
}

func nullableTimeOfDay(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}

func int64Ptr(value pgtype.Int8) *int64 {
	if !value.Valid {
		return nil
	}
	result := value.Int64
	return &result
}

func stringPtr(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	result := value.String
	return &result
}

func datePtr(value pgtype.Date) *time.Time {
	if !value.Valid {
		return nil
	}
	result := domain.NormalizeDate(&value.Time)
	return result
}

func timestampPtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	result := value.Time
	return &result
}

func timeOfDayPtr(value pgtype.Time) *string {
	if !value.Valid {
		return nil
	}
	totalMinutes := value.Microseconds / int64(time.Minute/time.Microsecond)
	hours := totalMinutes / 60
	minutes := totalMinutes % 60
	result := fmt.Sprintf("%02d:%02d", hours, minutes)
	return &result
}

func isPostgresCode(err error, code string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == code
}
