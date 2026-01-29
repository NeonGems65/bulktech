import React, { useCallback, useRef, useMemo, useEffect } from 'react'
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, DeviceEventEmitter, StyleSheet, ScrollView } from 'react-native';
import Constants from 'expo-constants';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
const InputWorkout = () => {

    const [name, setName] = useState("");
    const [workouts, setWorkouts] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('Chest');

    const categories = {
        Chest: ['Bench Press', 'Incline Press', 'Chest Fly', 'Push Ups'],
        Back: ['Deadlift', 'Pull Ups', 'Barbell Row', 'Lat Pulldown'],
        Arms: ['Bicep Curls', 'Tricep Extensions', 'Hammer Curls', 'Dips'],
        Legs: ['Squats', 'Leg Press', 'Lunges', 'Calf Raises'],
        Core: ['Plank', 'Crunches', 'Leg Raises', 'Russian Twists']
    };
    

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
    }, []);

    const onSubmitForm = async () => {

        try{
            console.log("Submsdfdsfitting form...");
           
            const body = { name }
            await fetch(`${baseUrl}/workoutlist`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(body)
            })
            setName("");
            DeviceEventEmitter.emit('event.workoutAdded');
            getWorkouts();
        }

        catch (err) {
            console.error(err.message);
        }
    }

    // ref
  const bottomSheetRef = useRef(null);

  // variables
  const snapPoints = useMemo(() => ['90%'], []);

  // callbacks
  const handleSheetChanges = useCallback((index) => {
    console.log('handleSheetChanges', index);
  }, []);

    return (
        <GestureHandlerRootView style={styles.container}>
        <Text style={styles.header}> 
            Bulktech
        </Text>
        <View style={styles.inputGroup} >
            {/* <TextInput 
                style={styles.input} 
                value={name}
                placeholder="Enter workout"
                placeholderTextColor="#999"
                onChangeText={text => setName(text)} 
            /> */}

            {/* <View style={{width: "100%", justifyContent: "center", alignItems: "center"}}>
                <TextInput 
                style={styles.smallInput} 
                value={name}
                placeholder="Lbs"
                placeholderTextColor="#999"
                onChangeText={text => setName(text)} 
            />

            </View> */}

            <TouchableOpacity style={[styles.button, { marginTop: 10, backgroundColor: '#555' }]} onPress={() => bottomSheetRef.current?.expand()}>
                <Text style={styles.buttonText}>Select Workout</Text>
            </TouchableOpacity>

            
            <TouchableOpacity style={styles.button} onPress={onSubmitForm}>
                <Text style={styles.buttonText}>Add</Text>
            </TouchableOpacity>

           
        </View>

        <View style={styles.listContainer}>
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

        <BottomSheet
            ref={bottomSheetRef}
            index={-1}
            snapPoints={snapPoints}
            enablePanDownToClose={true}
            onChange={handleSheetChanges}
        >
            <BottomSheetView style={bottomSheetStyles.contentContainer}>
                <View style={bottomSheetStyles.categoriesWrapper}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={bottomSheetStyles.categoriesContainer}>
                        {Object.keys(categories).map((cat) => (
                            <TouchableOpacity 
                                key={cat} 
                                style={[
                                    bottomSheetStyles.categoryTab, 
                                    selectedCategory === cat && bottomSheetStyles.categoryTabSelected
                                ]}
                                onPress={() => setSelectedCategory(cat)}
                            >
                                <Text style={[
                                    bottomSheetStyles.categoryText,
                                    selectedCategory === cat && bottomSheetStyles.categoryTextSelected
                                ]}>{cat}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
                <BottomSheetScrollView style={bottomSheetStyles.listContainer}>
                    {categories[selectedCategory].map((workout, index) => (
                        <TouchableOpacity 
                            key={index} 
                            style={[
                                bottomSheetStyles.workoutItem,
                                name === workout && { backgroundColor: '#E0E0E0' }
                            ]} 
                            onPress={() => { setName(workout);}}
                            activeOpacity={0.7}
                        >
                            <Text style={bottomSheetStyles.workoutItemText}>{workout}</Text>
                        </TouchableOpacity>
                    ))}
                </BottomSheetScrollView>
            </BottomSheetView>
        </BottomSheet>
        </GestureHandlerRootView>
    )
}



const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
        paddingTop: 50,
        paddingHorizontal: 20,
        width: '100%',
    },
    header: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginVertical: 20,
    },
    inputGroup: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 15,
        marginBottom: 20,
    },
    input: {
        flex: "row",
        backgroundColor: '#1E1E1E',
        color: '#FFFFFF',
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333',
        marginRight: 10,
        width: '50%',
    },
    smallInput: {
        flex: "row",
        backgroundColor: '#1E1E1E',
        color: '#FFFFFF',
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333',
        width: "25%",
    },
    button: {
        backgroundColor: '#D32F2F',
        paddingVertical: 15,
        paddingHorizontal: 5,
        borderRadius: 8,
        justifyContent: 'center',
        width: '25%',
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    listContainer: {
        flex: 1,
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
    },
});

const bottomSheetStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'grey',
  },
  contentContainer: {
    flex: 1,
    padding: 36,
  },
  categoriesWrapper: {
      marginBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#ccc',
      paddingBottom: 10,
  },
  categoriesContainer: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  categoryTab: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      marginRight: 10,
      borderRadius: 20,
      backgroundColor: '#f0f0f0',
  },
  categoryTabSelected: {
      backgroundColor: '#D32F2F',
  },
  categoryText: {
      fontSize: 16,
      color: '#333',
      fontWeight: '600',
  },
  categoryTextSelected: {
      color: '#FFFFFF',
  },
  listContainer: {
      flex: 1,
  },
  workoutItem: {
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
      width: '100%',
      borderRadius: 20,
      alignItems: 'center',
  },
  workoutItemText: {
      fontSize: 18,
      color: '#333',
  },
});

export default InputWorkout;