BEGIN;

-- Topics
CREATE TABLE IF NOT EXISTS forum_topics (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Threads
CREATE TABLE IF NOT EXISTS forum_threads (
  id BIGSERIAL PRIMARY KEY,
  topic_id BIGINT REFERENCES forum_topics(id) ON DELETE SET NULL,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  replies_cnt INT NOT NULL DEFAULT 0,
  votes_sum INT NOT NULL DEFAULT 0,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Posts (thread replies)
CREATE TABLE IF NOT EXISTS forum_posts (
  id BIGSERIAL PRIMARY KEY,
  thread_id BIGINT NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id BIGINT REFERENCES forum_posts(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  votes_sum INT NOT NULL DEFAULT 0,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Votes (up/down on threads or posts)
CREATE TABLE IF NOT EXISTS forum_votes (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('thread','post')),
  target_id BIGINT NOT NULL,
  value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS ix_forum_threads_topic ON forum_threads(topic_id);
CREATE INDEX IF NOT EXISTS ix_forum_threads_created ON forum_threads(created_at DESC);
CREATE INDEX IF NOT EXISTS ix_forum_posts_thread ON forum_posts(thread_id, created_at);
CREATE INDEX IF NOT EXISTS ix_forum_votes_target ON forum_votes(target_type, target_id);

-- Optional trigram search on titles (needs pg_trgm)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS ix_threads_title_trgm ON forum_threads USING gin (title gin_trgm_ops);

COMMIT;

