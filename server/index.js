require('dotenv').config();

const express = require('express');
const app = express();
const cors = require('cors');
const pool = require('./db');

//middleware to parse JSON bodies
app.use(cors())
app.use(express.json());

app.get('/', (_req, res) => {
    res.json({
        ok: true,
        service: 'bulktech-api',
        endpoints: ['/health', '/workoutlist']
    });
});

app.get('/health', (_req, res) => {
    res.json({ ok: true });
});





//ROUTES

//create a workout

app.post("/workoutlist", async(req,res) =>{
    try{

       const { name, weight } = req.body;
       console.log("Adding workout:", name, weight);
       const newWorkout = await pool.query(
         "INSERT INTO workoutlist (name, weight) VALUES($1, $2) RETURNING *",
         [name, weight]
       );

      res.json(newWorkout.rows[0]);

    } catch(err) {
        console.error(err.message);
                res.status(500).json({ error: 'Failed to create workout' });
    }
} )

//get all Workouts
app.get('/workoutlist', async(req,res) =>{
    try{
        const allWorkouts = await pool.query(
          "SELECT * FROM workoutlist ORDER BY created_at DESC NULLS LAST, workout_id DESC"
        );
        res.json(allWorkouts.rows);
    }
    catch (err){
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch workouts' });
    }
})

//get Workouts by body part
app.get('/workoutlist/bodypart/:bodypart', async(req,res) =>{
    try{
        const { bodypart } = req.params;
        const allWorkouts = await pool.query(
          "SELECT * FROM workoutlist WHERE body_part = $1 ORDER BY created_at DESC NULLS LAST, workout_id DESC",
          [bodypart]
        );
        res.json(allWorkouts.rows);
    }
    catch (err){
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch workouts' });
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
        res.status(500).json({ error: 'Failed to fetch workout' });
    }
})

//update a workout
app.put('/workoutlist/:id', async(req,res) =>{

    try{
        const {id} = req.params;
        const { name, weight } = req.body;
        
        const updateWorkout = await pool.query("UPDATE workoutlist SET name = $1, weight = $2 WHERE workout_id = $3",
            [name, weight, id]);
        
        res.json("Workout was updated!");
    }
    catch (err){
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update workout' });
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
                res.status(500).json({ error: 'Failed to delete workout' });
    }   
})

// CARDIO ENDPOINTS

// Create a cardio entry
app.post("/cardiolist", async(req,res) => {
    try{
        const { name, duration_minutes } = req.body;
        console.log("Adding cardio:", name, duration_minutes);
        const newCardio = await pool.query(
            "INSERT INTO cardiolist (name, duration_minutes) VALUES($1, $2) RETURNING *",
            [name, duration_minutes]
        );
        res.json(newCardio.rows[0]);
    } catch(err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to create cardio' });
    }
})

// Get all cardio entries
app.get('/cardiolist', async(req,res) => {
    try{
        const allCardio = await pool.query(
            "SELECT * FROM cardiolist ORDER BY created_at DESC NULLS LAST, cardio_id DESC"
        );
        res.json(allCardio.rows);
    }
    catch (err){
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch cardio' });
    }
})

// Get a single cardio entry
app.get('/cardiolist/:id', async(req,res) => {
    try {
        const { id } = req.params;
        const cardio = await pool.query("SELECT * FROM cardiolist WHERE cardio_id = $1", [id]);
        res.json(cardio.rows[0]);
    }
    catch (err){
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch cardio' });
    }
})

// Update a cardio entry
app.put('/cardiolist/:id', async(req,res) => {
    try{
        const {id} = req.params;
        const { name, duration_minutes } = req.body;
        
        const updateCardio = await pool.query("UPDATE cardiolist SET name = $1, duration_minutes = $2 WHERE cardio_id = $3",
            [name, duration_minutes, id]);
        
        res.json("Cardio was updated!");
    }
    catch (err){
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update cardio' });
    }
})

// Delete a cardio entry
app.delete('/cardiolist/:id', async(req,res) => {
    try{
        const {id} = req.params;
        const deleteCardio = await pool.query("DELETE FROM cardiolist WHERE cardio_id = $1", [id]);  
        res.json("Cardio was deleted!");
    }
    catch (err){
        console.error(err.message);
        res.status(500).json({ error: 'Failed to delete cardio' });
    }   
})

const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});