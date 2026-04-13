package services

import (
	"context"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
)

type ForumService struct {
	db *sqlx.DB
}

func NewForumService(db *sqlx.DB) *ForumService {
	return &ForumService{db: db}
}

type ForumComment struct {
	ID        int64     `db:"id" json:"id"`
	ThreadID  string    `db:"thread_id" json:"thread_id"`
	UserID    int64     `db:"user_id" json:"user_id"`
	Username  string    `db:"username" json:"username"`
	Body      string    `db:"body" json:"body"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type ForumVoteSummary struct {
	Bullish int `json:"bullish"`
	Bearish int `json:"bearish"`
	Chop    int `json:"chop"`
}

type ForumThread struct {
	ID           string           `db:"id" json:"id"`
	Title        string           `db:"title" json:"title"`
	Topic        string           `db:"topic" json:"topic"`
	Author       string           `db:"author" json:"author"`
	LastActivity time.Time        `db:"last_activity" json:"last_activity"`
	Replies      int              `db:"replies" json:"replies"`
	Comments     []ForumComment   `json:"comments"`
	Votes        ForumVoteSummary `json:"votes"`
}

func (s *ForumService) ListThreads(ctx context.Context, topic, query string) ([]ForumThread, error) {
	rows := []ForumThread{}
	topic = strings.TrimSpace(topic)
	query = strings.TrimSpace(strings.ToLower(query))

	base := `
        SELECT
            t.id,
            t.title,
            t.topic,
            t.author,
            GREATEST(t.updated_at, COALESCE(MAX(c.created_at), t.updated_at)) AS last_activity,
            COALESCE(COUNT(c.id), 0) AS replies
        FROM forum_threads t
        LEFT JOIN forum_comments c ON c.thread_id = t.id
        WHERE ($1 = '' OR t.topic = $1)
          AND ($2 = '' OR LOWER(t.title) LIKE '%' || $2 || '%')
        GROUP BY t.id, t.title, t.topic, t.author, t.updated_at
        ORDER BY last_activity DESC
    `
	if err := s.db.SelectContext(ctx, &rows, base, topic, query); err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []ForumThread{}
	}

	for index := range rows {
		comments, err := s.commentsForThread(ctx, rows[index].ID)
		if err != nil {
			return nil, err
		}
		votes, err := s.votesForThread(ctx, rows[index].ID)
		if err != nil {
			return nil, err
		}
		rows[index].Comments = comments
		rows[index].Votes = votes
	}

	return rows, nil
}

func (s *ForumService) commentsForThread(ctx context.Context, threadID string) ([]ForumComment, error) {
	comments := []ForumComment{}
	err := s.db.SelectContext(ctx, &comments, `
        SELECT id, thread_id, user_id, username, body, created_at
        FROM forum_comments
        WHERE thread_id=$1
        ORDER BY created_at DESC
        LIMIT 8
    `, threadID)
	if comments == nil {
		comments = []ForumComment{}
	}
	return comments, err
}

func (s *ForumService) votesForThread(ctx context.Context, threadID string) (ForumVoteSummary, error) {
	var summary ForumVoteSummary
	err := s.db.GetContext(ctx, &summary, `
        SELECT
            COALESCE(COUNT(*) FILTER (WHERE vote_type='bullish'), 0) AS bullish,
            COALESCE(COUNT(*) FILTER (WHERE vote_type='bearish'), 0) AS bearish,
            COALESCE(COUNT(*) FILTER (WHERE vote_type='chop'), 0) AS chop
        FROM forum_votes
        WHERE thread_id=$1
    `, threadID)
	return summary, err
}

func (s *ForumService) CreateComment(ctx context.Context, userID int64, threadID, body, username string) (ForumComment, error) {
	var comment ForumComment
	err := s.db.GetContext(ctx, &comment, `
        INSERT INTO forum_comments (thread_id, user_id, username, body, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id, thread_id, user_id, username, body, created_at
    `, strings.TrimSpace(threadID), userID, strings.TrimSpace(username), strings.TrimSpace(body))
	if err != nil {
		return ForumComment{}, err
	}
	_, _ = s.db.ExecContext(ctx, `UPDATE forum_threads SET updated_at=NOW() WHERE id=$1`, strings.TrimSpace(threadID))
	return comment, nil
}

func (s *ForumService) CastVote(ctx context.Context, userID int64, threadID, voteType string) (ForumVoteSummary, error) {
	_, err := s.db.ExecContext(ctx, `
        INSERT INTO forum_votes (thread_id, user_id, vote_type, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (thread_id, user_id)
        DO UPDATE SET vote_type = EXCLUDED.vote_type, created_at = NOW()
    `, strings.TrimSpace(threadID), userID, strings.TrimSpace(voteType))
	if err != nil {
		return ForumVoteSummary{}, err
	}
	_, _ = s.db.ExecContext(ctx, `UPDATE forum_threads SET updated_at=NOW() WHERE id=$1`, strings.TrimSpace(threadID))
	return s.votesForThread(ctx, strings.TrimSpace(threadID))
}
