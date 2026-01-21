import { Fragment, useEffect, useState } from "react";
import { Text, View, Button } from 'react-native';
const ListWorkout = () => {  

    const [workouts, setWorkouts] = useState([]);
    console.log('hellosdfssdfsdfdfooo')
    //delete function
    const deleteWorkout = async (id) => {
        try{
            // Replace <YOUR_IP_ADDRESS> with your machine's LAN IP (e.g., 192.168.1.5)
            const deleteTodo = await fetch(`http://10.0.0.249:5000/workoutList/${id}`, {
                method: "DELETE"
            });

            setWorkouts(workouts.filter(workout => workout.workout_id !== id));

        } 
        catch(err) {
            console.error(err.message);
        }
    }
    // get function
    const getWorkouts = async () => {
        try{
            console.log("Initiating fetch request...");
            // Replace <YOUR_IP_ADDRESS> with your machine's LAN IP
            const response = await fetch("http://10.0.0.249:5000/workoutList"); // by default is a GET request
            const jsonData = await response.json();
            console.log(jsonData);
            console.log("helloooo")

            setWorkouts(jsonData);
        }
        catch(err){ 
            console.error(err.message);
        }
    }

    useEffect(() => {
        getWorkouts();
    }, []);

    console.log(workouts) 


return (
        <Fragment>
        <View className="table mb-5 text-center" >
    <View>
        <Text>Description</Text>
        <Text>Edit</Text>
        <Text>Delete</Text>
    </View>
    <View>
      {workouts.map(workout => (
        <View key={workout.workout_id} className="table-row">
            
          <Text>{workout.description}</Text>
          {/* <Button title="Delete" color="red"
            onPress={() => deleteWorkout(workout.workout_id)}
          /> */}
        </View>
      ))}
    </View>
  </View>
        </Fragment>
    )
}

export default ListWorkout 