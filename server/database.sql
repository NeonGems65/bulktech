CREATE DATABASE bulktech;

CREATE TABLE workoutList(
    workout_id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    weight VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);