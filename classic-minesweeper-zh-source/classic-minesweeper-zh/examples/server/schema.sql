-- Requires an existing users table. Apply through your host's versioned migration system.
CREATE TABLE minesweeper_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  difficulty TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
  mines INTEGER NOT NULL, started_at INTEGER NOT NULL,
  completed_at INTEGER, elapsed_ms INTEGER, assisted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX minesweeper_user_records ON minesweeper_runs(user_id,id);
CREATE INDEX minesweeper_started ON minesweeper_runs(user_id,started_at);
