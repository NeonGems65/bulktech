import { Fragment, useEffect, useState } from "react";
import { Text, View, Button, DeviceEventEmitter } from 'react-native';
import Constants from 'expo-constants';

const ListWorkout = () => {  

    const [workouts, setWorkouts] = useState([]);

    // Dynamically determine the IP address of the computer running Expo
    const debuggerHost = Constants.expoConfig?.hostUri ?? Constants.manifest?.debuggerHost;
    const ip = debuggerHost?.split(':')[0] ?? 'localhost';
    const baseUrl = `http://${ip}:5000`;

    console.log('hellosdfssdfsdfdfooo')
    //delete function
    const deleteWorkout = async (id) => {
        try{
            const deleteTodo = await fetch(`${baseUrl}/workoutList/${id}`, {
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
            const response = await fetch(`${baseUrl}/workoutList`); // by default is a GET request
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
        const subscription = DeviceEventEmitter.addListener('event.workoutAdded', getWorkouts);
        return () => {
            subscription.remove();
        };
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
          <Button title="Delete" color="red"
            onPress={() => deleteWorkout(workout.workout_id)}
          />
        </View>
      ))}
    </View>
  </View>
        </Fragment>
    )
}

export default ListWorkout 