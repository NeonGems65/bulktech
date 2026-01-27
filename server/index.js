const express = require('express');
const app = express();
const cors = require('cors');
const pool = require('./db');

//middleware to parse JSON bodies
app.use(cors())
app.use(express.json());





//ROUTES

//create a workout

app.post("/workoutlist", async(req,res) =>{
    try{

       const { name } = req.body;
       const newWorkout = await pool.query("INSERT INTO workoutlist (name) VALUES($1) RETURNING *", 
        [name]
    );

    res.json(newWorkout.rows[0])

    } catch(err) {
        console.error(err.message);
    }
} )

//get all Workouts
app.get('/workoutlist', async(req,res) =>{
    try{
        const allWorkouts = await pool.query("SELECT * FROM workoutlist");
        res.json(allWorkouts.rows);
    }
    catch (err){
        console.error(err.message);
    }
})

//get a Workout
app.get('/workoutlist/:id', async(req,res) =>{
    try {
        const { id } = req.params;
        const workout = await pool.query("SELECT * FROM workoutlist WHERE workout_id = $1", [id]);

        res.json(workout.rows[0]);
    }
    catch (err){
        console.error(err.message);
    }
})

//update a workout
app.put('/workoutlist/:id', async(req,res) =>{

    try{
        const {id} = req.params;
        const { name } = req.body;
        
        const updateName = await pool.query("UPDATE workoutlist SET name = $1 WHERE workout_id = $2",
            [name, id]);
        
        res.json("Name was updated!");
    }
    catch (err){
        console.error(err.message);
    }
})

//delete a Workout
app.delete('/workoutlist/:id', async(req,res) => {

    try{
        const {id} = req.params;
        const deleteWorkout = await pool.query("DELETE FROM workoutlist WHERE workout_id = $1", [id]);  
        res.json("Workout was deleted!");
    }

    catch (err){
        console.error(err.message);
    }   
})

app.listen(5000, () => {
  console.log('Server is running on port 5000');
});