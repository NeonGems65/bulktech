-- Create cardio tracking table
CREATE TABLE IF NOT EXISTS cardiolist(
    cardio_id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    duration_minutes INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
