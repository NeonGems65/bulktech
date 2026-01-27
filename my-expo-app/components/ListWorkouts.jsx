import { useEffect, useState } from "react";
import { Text, View, TouchableOpacity, DeviceEventEmitter, StyleSheet, ScrollView } from 'react-native';
import Constants from 'expo-constants';

const ListWorkout = () => {  

    const [workouts, setWorkouts] = useState([]);

    // Dynamically determine the IP address of the computer running Expo
    const debuggerHost = Constants.expoConfig?.hostUri ?? Constants.manifest?.debuggerHost;
    const ip = debuggerHost?.split(':')[0] ?? 'localhost';
    const baseUrl = `http://${ip}:5000`;

    //delete function
    const deleteWorkout = async (id) => {
        try{
            await fetch(`${baseUrl}/workoutlist/${id}`, {
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


return (
    <View style={styles.container}>
        <View style={styles.headerRow}>
            <Text style={styles.headerText}>Workout</Text>
        </View>
    <ScrollView style={styles.scrollView}>
      {workouts.map(workout => (
        <View key={workout.workout_id} style={styles.row}>
            
          <Text style={styles.rowText}>{workout.name}</Text>
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={() => deleteWorkout(workout.workout_id)}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
    </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
        paddingHorizontal: 20,
        width: '100%',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#D32F2F',
        marginBottom: 10,
    },
    headerText: {
        color: '#D32F2F',
        fontSize: 16,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    scrollView: {
        marginBottom: 20,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1E1E1E',
        padding: 15,
        borderRadius: 8,
        marginBottom: 10,
    },
    rowText: {
        color: '#FFFFFF',
        fontSize: 16,
        flex: 1,
    },
    deleteButton: {
        backgroundColor: '#D32F2F',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 5,
        marginLeft: 10,
    },
    deleteButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
    }
});

export default ListWorkout 