CREATE DATABASE bulktech;

CREATE TABLE workoutList(
    workout_id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    weight VARCHAR(50)
);