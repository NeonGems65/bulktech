import React, { useCallback, useRef, useMemo, useEffect } from 'react'
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, DeviceEventEmitter, StyleSheet, ScrollView } from 'react-native';
import Constants from 'expo-constants';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
const InputWorkout = () => {

    const formatDateTime = (dateValue) => {
        if (!dateValue) return "";

        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) return "";

        // Prefer Intl when available for consistent formatting
        try {
            return new Intl.DateTimeFormat(undefined, {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            }).format(date);
        } catch {
            return date.toLocaleString();
        }
    };

    const [name, setName] = useState("");
    const [workouts, setWorkouts] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('Chest');
    const [selectedWeight, setSelectedWeight] = useState(null);

    const [editingWorkout, setEditingWorkout] = useState(null);
    const [editName, setEditName] = useState("");
    const [editSelectedCategory, setEditSelectedCategory] = useState('Chest');
    const [editSelectedWeight, setEditSelectedWeight] = useState(null);

    const categories = {
        Chest: ['Bench Press', 'Incline Press', 'Chest Fly', 'Push Ups'],
        Back: ['Deadlift', 'Pull Ups', 'Barbell Row', 'Lat Pulldown'],
        Arms: ['Bicep Curls', 'Tricep Extensions', 'Hammer Curls', 'Dips'],
        Legs: ['Squats', 'Leg Press', 'Lunges', 'Calf Raises'],
        Core: ['Plank', 'Crunches', 'Leg Raises', 'Russian Twists']
    };
    
    const kilosWeights = useMemo(() => {
        const weights = [];
        for (let i = 2.5; i <= 97.5; i += 5) {
            weights.push(i);
        }
        return weights;
    }, []);

    const lbsWeights = useMemo(() => {
        const weights = [];
        for (let i = 10; i <= 200; i += 10) {
            weights.push(i);
        }
        return weights;
    }, []);

    // Dynamically determine the IP address of the computer running Expo
    const debuggerHost = Constants.expoConfig?.hostUri ?? Constants.manifest?.debuggerHost;
    const ip = debuggerHost?.split(':')[0] ?? 'localhost';
    const baseUrl = `http://${ip}:5000`;

    const formatSelectedWeight = (weightSelection) => {
        if (!weightSelection) return null;
        if (weightSelection.startsWith('k-')) return `${weightSelection.split('-')[1]} kg`;
        if (weightSelection.startsWith('l-')) return `${weightSelection.split('-')[1]} lbs`;
        return null;
    }

    const parseWeightToSelection = (weightString) => {
        if (!weightString || typeof weightString !== 'string') return null;

        const trimmed = weightString.trim().toLowerCase();
        const match = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*(kg|kgs|lb|lbs)$/);
        if (!match) return null;

        const value = match[1];
        const unit = match[2];

        if (unit.startsWith('kg')) return `k-${value}`;
        return `l-${value}`;
    }

    const findCategoryForWorkoutName = (workoutName) => {
        if (!workoutName) return 'Chest';

        for (const category of Object.keys(categories)) {
            if (categories[category]?.includes(workoutName)) {
                return category;
            }
        }

        return 'Chest';
    }

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

    const updateWorkout = async () => {
        if (!editingWorkout) return;

        try {
            const formattedWeight = formatSelectedWeight(editSelectedWeight);
            const body = { name: editName, weight: formattedWeight };

            await fetch(`${baseUrl}/workoutlist/${editingWorkout.workout_id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            setEditingWorkout(null);
            setEditName("");
            setEditSelectedWeight(null);
            setEditSelectedCategory('Chest');
            editBottomSheetRef.current?.close();
            getWorkouts();
        } catch (err) {
            console.error(err.message);
        }
    }

    const openEditSheet = (workout) => {
        setEditingWorkout(workout);
        setEditName(workout?.name ?? "");
        setEditSelectedCategory(findCategoryForWorkoutName(workout?.name));
        setEditSelectedWeight(parseWeightToSelection(workout?.weight));
        editBottomSheetRef.current?.expand();
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
            console.log("Submitting form...");
           
            // format selected weight into readable string (e.g. "10 kg" or "20 lbs")
            const formattedWeight = formatSelectedWeight(selectedWeight);

            const body = { name, weight: formattedWeight }
            await fetch(`${baseUrl}/workoutlist`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(body)
            })
            setName("");
            DeviceEventEmitter.emit('event.workoutAdded');
            // Close the bottom sheet after successful submission
            bottomSheetRef.current?.close();
            // clear selected weight
            setSelectedWeight(null);
            getWorkouts();
        }

        catch (err) {
            console.error(err.message);
        }
    }

    // ref
  const bottomSheetRef = useRef(null);
    const editBottomSheetRef = useRef(null);

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

           
        </View>

        <View style={styles.listContainer}>
            <View style={styles.headerRow}>
                <Text style={styles.headerText}>Workout</Text>
            </View>
            <ScrollView style={styles.scrollView}>
            {workouts.map(workout => (
                <View key={workout.workout_id} style={styles.row}>
                    
                <View style={styles.workoutInfo}>
                    <Text style={styles.rowText}>{workout.name}</Text>
                    {workout.weight ? <Text style={styles.weightText}>{workout.weight}</Text> : null}
                    {workout.created_at ? (
                        <Text style={styles.dateText}>{formatDateTime(workout.created_at)}</Text>
                    ) : null}
                </View>

                <View style={styles.rowActions}>
                    <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => openEditSheet(workout)}
                    >
                        <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.deleteButton}
                        onPress={() => deleteWorkout(workout.workout_id)}
                    >
                        <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                </View>
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
                {name ? (
                    <>
                        <View style={bottomSheetStyles.weightSection}>
                        <View style={bottomSheetStyles.weightColumn}>
                            <Text style={bottomSheetStyles.weightHeader}>Kilos</Text>
                            <ScrollView style={bottomSheetStyles.weightList} nestedScrollEnabled>
                                {kilosWeights.map((w) => (
                                    <TouchableOpacity 
                                        key={w} 
                                        style={[
                                            bottomSheetStyles.weightItem,
                                            selectedWeight === `k-${w}` && { backgroundColor: '#E0E0E0' }
                                        ]}
                                        onPress={() => setSelectedWeight(`k-${w}`)}
                                        
                                    >
                                        <Text style={bottomSheetStyles.weightText}>{w}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                        <View style={bottomSheetStyles.weightColumn}>
                            <Text style={bottomSheetStyles.weightHeader}>Lbs</Text>
                            <ScrollView style={bottomSheetStyles.weightList} nestedScrollEnabled>
                                {lbsWeights.map((w) => (
                                    <TouchableOpacity 
                                        key={w} 
                                        style={[
                                            bottomSheetStyles.weightItem,
                                            selectedWeight === `l-${w}` && { backgroundColor: '#E0E0E0' }
                                        ]}
                                        onPress={() => setSelectedWeight(`l-${w}`)}
                                    >
                                        <Text style={bottomSheetStyles.weightText}>{w}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                        </View>
                        <TouchableOpacity style={bottomSheetStyles.addButton} onPress={onSubmitForm}>
                            <Text style={bottomSheetStyles.addButtonText}>Add</Text>
                        </TouchableOpacity>
                    </>
                ) : null}
            </BottomSheetView>
        </BottomSheet>

        <BottomSheet
            ref={editBottomSheetRef}
            index={-1}
            snapPoints={snapPoints}
            enablePanDownToClose={true}
        >
            <BottomSheetView style={bottomSheetStyles.contentContainer}>
                <Text style={bottomSheetStyles.sheetTitle}>Edit Workout</Text>

                <View style={bottomSheetStyles.categoriesWrapper}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={bottomSheetStyles.categoriesContainer}>
                        {Object.keys(categories).map((cat) => (
                            <TouchableOpacity 
                                key={cat} 
                                style={[
                                    bottomSheetStyles.categoryTab, 
                                    editSelectedCategory === cat && bottomSheetStyles.categoryTabSelected
                                ]}
                                onPress={() => setEditSelectedCategory(cat)}
                            >
                                <Text style={[
                                    bottomSheetStyles.categoryText,
                                    editSelectedCategory === cat && bottomSheetStyles.categoryTextSelected
                                ]}>{cat}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <BottomSheetScrollView style={bottomSheetStyles.listContainer}>
                    {categories[editSelectedCategory].map((workout, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[
                                bottomSheetStyles.workoutItem,
                                editName === workout && { backgroundColor: '#E0E0E0' }
                            ]}
                            onPress={() => { setEditName(workout); }}
                            activeOpacity={0.7}
                        >
                            <Text style={bottomSheetStyles.workoutItemText}>{workout}</Text>
                        </TouchableOpacity>
                    ))}
                </BottomSheetScrollView>

                {editName ? (
                    <>
                        <View style={bottomSheetStyles.weightSection}>
                            <View style={bottomSheetStyles.weightColumn}>
                                <Text style={bottomSheetStyles.weightHeader}>Kilos</Text>
                                <ScrollView style={bottomSheetStyles.weightList} nestedScrollEnabled>
                                    {kilosWeights.map((w) => (
                                        <TouchableOpacity
                                            key={w}
                                            style={[
                                                bottomSheetStyles.weightItem,
                                                editSelectedWeight === `k-${w}` && { backgroundColor: '#E0E0E0' }
                                            ]}
                                            onPress={() => setEditSelectedWeight(`k-${w}`)}
                                        >
                                            <Text style={bottomSheetStyles.weightText}>{w}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            <View style={bottomSheetStyles.weightColumn}>
                                <Text style={bottomSheetStyles.weightHeader}>Lbs</Text>
                                <ScrollView style={bottomSheetStyles.weightList} nestedScrollEnabled>
                                    {lbsWeights.map((w) => (
                                        <TouchableOpacity
                                            key={w}
                                            style={[
                                                bottomSheetStyles.weightItem,
                                                editSelectedWeight === `l-${w}` && { backgroundColor: '#E0E0E0' }
                                            ]}
                                            onPress={() => setEditSelectedWeight(`l-${w}`)}
                                        >
                                            <Text style={bottomSheetStyles.weightText}>{w}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        </View>

                        <TouchableOpacity style={bottomSheetStyles.addButton} onPress={updateWorkout}>
                            <Text style={bottomSheetStyles.addButtonText}>Save</Text>
                        </TouchableOpacity>
                    </>
                ) : null}
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
    workoutInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    rowText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    weightText: {
        color: '#CCCCCC',
        fontSize: 14,
    },
    dateText: {
        color: '#999999',
        fontSize: 12,
        marginTop: 2,
    },
    rowActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginLeft: 10,
    },
    editButton: {
        backgroundColor: '#555555',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 5,
    },
    editButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    deleteButton: {
        backgroundColor: '#D32F2F',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 5,
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
    sheetTitle: {
            fontSize: 20,
            fontWeight: 'bold',
            marginBottom: 12,
            color: '#333',
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
  weightSection: {
      flexDirection: 'row',
      height: 200,
      borderTopWidth: 1,
      borderTopColor: '#ccc',
      marginTop: 10,
      paddingTop: 10,
      gap: 20
  },
  weightColumn: {
      flex: 1,
      alignItems: 'center',
  },
  weightHeader: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 10,
      color: '#333',
  },
  weightList: {
      width: '100%',
      borderColor: '#ed3e3e',
      borderWidth: 2,
      borderRadius: 5,
  },
  weightItem: {
      paddingVertical: 10,
      alignItems: 'center',
      width: '100%',
      borderRadius: 5,
  },
  weightText: {
      fontSize: 16,
      color: '#333',
  },
  addButton: {
      backgroundColor: '#D32F2F',
      padding: 15,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 20,
  },
  addButtonText: {
      color: '#FFFFFF',
      fontWeight: 'bold',
      fontSize: 16,
      textTransform: 'uppercase',
  },
});

export default InputWorkout;