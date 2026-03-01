-- Add a column to store the target body part selected from the 3D model
ALTER TABLE workoutlist
ADD COLUMN IF NOT EXISTS body_part VARCHAR(100);

-- Optional: Index for filtering workouts by body part
CREATE INDEX IF NOT EXISTS idx_workoutlist_body_part ON workoutlist (body_part);