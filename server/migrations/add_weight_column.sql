-- Add a weight column to store the selected weight (as text with units)
ALTER TABLE workoutlist
ADD COLUMN IF NOT EXISTS weight VARCHAR(50);
