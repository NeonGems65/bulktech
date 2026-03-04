import { useEffect, useState } from "react";
import { Text, View, TouchableOpacity, DeviceEventEmitter, StyleSheet, ScrollView, ActivityIndicator, TextInput, Modal } from 'react-native';
import { getApiBaseUrl } from '../config/apiBaseUrl';
import { getCachedWorkouts, cacheWorkouts, clearWorkoutsCache } from '../utils/workoutCache';

const ListWorkout = () => {  

    const [workouts, setWorkouts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingWorkout, setEditingWorkout] = useState(null);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editName, setEditName] = useState("");
    const [editWeight, setEditWeight] = useState("");
    const [editDate, setEditDate] = useState("");
    const [editTime, setEditTime] = useState("");

    const baseUrl = getApiBaseUrl();

    const formatDateTime = (dateValue) => {
        if (!dateValue) return "";
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) return "";
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

    //delete function
    const deleteWorkout = async (id) => {
        try{
            await fetch(`${baseUrl}/workoutlist/${id}`, {
                method: "DELETE"
            });

            setWorkouts(workouts.filter(workout => workout.workout_id !== id));
            // Clear cache after deletion so fresh data is fetched next time
            await clearWorkoutsCache();

        } 
        catch(err) {
            console.error(err.message);
        }
    }

    // Open edit modal
    const openEditModal = (workout) => {
        setEditingWorkout(workout);
        setEditName(workout.name || "");
        setEditWeight(workout.weight || "");
        const date = new Date(workout.created_at);
        const dateStr = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
        const timeStr = String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
        setEditDate(dateStr);
        setEditTime(timeStr);
        setEditModalVisible(true);
    };

    // Close edit modal
    const closeEditModal = () => {
        setEditModalVisible(false);
        setEditingWorkout(null);
        setEditName("");
        setEditWeight("");
        setEditDate("");
        setEditTime("");
    };

    // Update workout with new date/time
    const updateWorkoutDateTime = async () => {
        if (!editingWorkout || !editDate || !editTime) return;

        try {
            const [year, month, day] = editDate.split('-');
            const [hours, minutes] = editTime.split(':');
            const newDateTime = new Date(year, month - 1, day, hours, minutes);

            const body = { 
                name: editName || editingWorkout.name, 
                weight: editWeight || editingWorkout.weight,
                created_at: newDateTime.toISOString()
            };

            const response = await fetch(`${baseUrl}/workoutlist/${editingWorkout.workout_id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                throw new Error(`Update failed with status ${response.status}`);
            }

            // Update local state
            setWorkouts(workouts.map(w => 
                w.workout_id === editingWorkout.workout_id 
                    ? { ...w, name: editName || w.name, weight: editWeight || w.weight, created_at: newDateTime.toISOString() }
                    : w
            ));

            await clearWorkoutsCache();
            closeEditModal();
        } catch (err) {
            console.error(err.message);
        }
    };
    
    // get function
    const getWorkouts = async () => {
        try{
            console.log("Fetching workouts from server...");
            const response = await fetch(`${baseUrl}/workoutlist`); // by default is a GET request
            const jsonData = await response.json();
            console.log(jsonData);

            setWorkouts(jsonData);
            // Update cache with fresh data
            await cacheWorkouts(jsonData);
        }
        catch(err){ 
            console.error(err.message);
        }
        finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        // Load from cache first for instant display
        const loadWorkouts = async () => {
            try {
                const cachedData = await getCachedWorkouts();
                if (cachedData) {
                    console.log("Loading workouts from cache...");
                    setWorkouts(cachedData);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Error loading cached workouts:", error);
            }
        };

        // Load from cache immediately
        loadWorkouts();
        
        // Then fetch fresh data from server in the background
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
        {isLoading ? (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#D32F2F" />
                <Text style={styles.loadingText}>Loading your workouts...</Text>
            </View>
        ) : (
            <ScrollView style={styles.scrollView}>
                {workouts.map(workout => (
                    <View key={workout.workout_id} style={styles.row}>
                        <View style={styles.workoutInfo}>
                            <Text style={styles.rowText}>{workout.name}</Text>
                            {workout.weight && <Text style={styles.weightText}>Weight: {workout.weight}</Text>}
                            {workout.created_at && <Text style={styles.dateText}>{formatDateTime(workout.created_at)}</Text>}
                        </View>
                        <View style={styles.actionButtons}>
                            <TouchableOpacity 
                                style={styles.editButton}
                                onPress={() => openEditModal(workout)}
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
        )}

        {/* Edit Date/Time Modal */}
        <Modal
            visible={editModalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={closeEditModal}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <Text style={styles.modalTitle}>Edit Workout</Text>
                        
                        <Text style={styles.label}>Workout Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Exercise name"
                            placeholderTextColor="#999"
                            value={editName}
                            onChangeText={setEditName}
                        />
                        
                        <Text style={styles.label}>Weight</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g., 100 lbs or 50 kg"
                            placeholderTextColor="#999"
                            value={editWeight}
                            onChangeText={setEditWeight}
                        />
                        
                        <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="2024-03-01"
                            placeholderTextColor="#999"
                            value={editDate}
                            onChangeText={setEditDate}
                        />
                        
                        <Text style={styles.label}>Time (HH:MM)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="14:30"
                            placeholderTextColor="#999"
                            value={editTime}
                            onChangeText={setEditTime}
                        />
                        
                        <View style={styles.modalButtons}>
                            <TouchableOpacity 
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={closeEditModal}
                            >
                                <Text style={styles.modalButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={updateWorkoutDateTime}
                            >
                                <Text style={styles.modalButtonText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    loadingText: {
        marginTop: 15,
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '500',
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
        marginRight: 10,
    },
    rowText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    weightText: {
        color: '#D32F2F',
        fontSize: 13,
        marginTop: 5,
    },
    dateText: {
        color: '#999999',
        fontSize: 12,
        marginTop: 5,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    editButton: {
        backgroundColor: '#555555',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 5,
    },
    editButtonText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: 'bold',
    },
    deleteButton: {
        backgroundColor: '#D32F2F',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 5,
    },
    deleteButtonText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#1E1E1E',
        padding: 20,
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
        paddingBottom: 30,
        maxHeight: '80%',
    },
    modalTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    label: {
        color: '#D32F2F',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        marginTop: 15,
    },
    input: {
        backgroundColor: '#000000',
        color: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#D32F2F',
        borderRadius: 6,
        padding: 12,
        fontSize: 14,
        marginBottom: 15,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 25,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 6,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#555555',
    },
    saveButton: {
        backgroundColor: '#D32F2F',
    },
    modalButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
});

export default ListWorkout 