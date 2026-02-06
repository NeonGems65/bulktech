-- Track when each workout entry was created
-- Uses TIMESTAMPTZ so it round-trips with timezone info
ALTER TABLE workoutlist
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Helpful for showing newest first
CREATE INDEX IF NOT EXISTS idx_workoutlist_created_at ON workoutlist (created_at DESC);
