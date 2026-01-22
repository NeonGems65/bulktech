const express = require('express');
const app = express();
const cors = require('cors');
const pool = require('./db');

//middleware to parse JSON bodies
app.use(cors())
app.use(express.json());





//ROUTES

//create a workout

app.post("/workoutList", async(req,res) =>{
    try{

       const { workout } = req.body;
       const newWorkout = await pool.query("INSERT INTO workoutList (workout) VALUES($1) RETURNING *", 
        [workout]
    );

    res.json(newWorkout.rows[0])

    } catch(err) {
        console.error(err.message);
    }
} )

//get all Workouts
app.get('/workoutList', async(req,res) =>{
    try{
        const allWorkouts = await pool.query("SELECT * FROM workoutList");
        res.json(allWorkouts.rows);
    }
    catch (err){
        console.error(err.message);
    }
})

//get a Workout
app.get('/workoutList/:id', async(req,res) =>{
    try {
        const { id } = req.params;
        const workout = await pool.query("SELECT * FROM workoutList WHERE workout_id = $1", [id]);

        res.json(workout.rows[0]);
    }
    catch (err){
        console.error(err.message);
    }
})

//update a workout
app.put('/workoutList/:id', async(req,res) =>{

    try{
        const {id} = req.params;
        const { workout } = req.body;
        
        const updateWorkout = await pool.query("UPDATE workoutList SET workout = $1 WHERE workout_id = $2",
            [workout, id]);
        
        res.json("Workout was updated!");
    }
    catch (err){
        console.error(err.message);
    }
})

//delete a Workout
app.delete('/workoutList/:id', async(req,res) => {

    try{
        const {id} = req.params;
        const deleteWorkout = await pool.query("DELETE FROM workoutList WHERE workout_id = $1", [id]);  
        res.json("Workout was deleted!");
    }

    catch (err){
        console.error(err.message);
    }   
})

app.listen(5000, () => {
  console.log('Server is running on port 5000');
});