import React, { useCallback, useRef, useMemo, useEffect } from 'react'
import { useState } from 'react';
import { View, Text, TouchableOpacity, DeviceEventEmitter, StyleSheet, ScrollView, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { getApiBaseUrl } from '../config/apiBaseUrl';

type WorkoutEntry = {
    workout_id: number;
    name: string;
    weight: string | null;
    created_at: string;
};

const InputWorkout = () => {

    const getErrorMessage = (error: unknown) => {
        return error instanceof Error ? error.message : String(error);
    };

    const formatDateTime = (dateValue: string | Date | null | undefined) => {
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

    const formatDateInputValue = (date: Date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    const formatTimeInputValue = (date: Date) => {
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    const [name, setName] = useState("");
    const [workouts, setWorkouts] = useState<WorkoutEntry[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('Chest');
    const [selectedWeight, setSelectedWeight] = useState<string | null>(null);
    const [selectedWeightUnit, setSelectedWeightUnit] = useState<'l' | 'k'>('l');
    const [selectedDateTime, setSelectedDateTime] = useState(new Date());
    const [showAddDatePicker, setShowAddDatePicker] = useState(false);
    const [showAddTimePicker, setShowAddTimePicker] = useState(false);

    const [editingWorkout, setEditingWorkout] = useState<WorkoutEntry | null>(null);
    const [editName, setEditName] = useState("");
    const [editSelectedCategory, setEditSelectedCategory] = useState('Chest');
    const [editSelectedWeight, setEditSelectedWeight] = useState<string | null>(null);
    const [editWeightUnit, setEditWeightUnit] = useState<'l' | 'k'>('l');
    const [editDateTime, setEditDateTime] = useState(new Date());
    const [showEditDatePicker, setShowEditDatePicker] = useState(false);
    const [showEditTimePicker, setShowEditTimePicker] = useState(false);
    
    const [isOnline, setIsOnline] = useState(true);
    const [apiUnavailable, setApiUnavailable] = useState(false);

    const categories: Record<string, string[]> = {
        Chest: ['Incline DB Bench Press', 'Chest Fly', 'Chest Press'],
        Back: ['Deadlift', 'Pull Ups', 'Barbell Row', 'Lat Pulldown', 'Seated Cable Row', 'Row Machine','Rear Delt Fly'],
        Arms: ['Bayesian Curls', 'Cable Bar Curl', 'Preacher Curls',  'Tricep Extensions', 'Tricep Pulldown', 'Hammer Curls', 'Dips', "Forearm Cable Curls"],
        Legs: ['Leg Curls', 'Leg Press', 'Leg Extension', 'Calf Raises'],
        Core: ['Plank', 'Crunches', 'Leg Raises', 'Russian Twists']
    };

    const getCategoryForWorkout = (workoutName: string | null | undefined) => {
        if (!workoutName) return 'Other';

        for (const category of Object.keys(categories)) {
            if (categories[category]?.includes(workoutName)) {
                return category;
            }
        }

        return 'Other';
    };
    
    const kilosWeights = useMemo(() => {
        const weights = [];
        for (let i = 10; i <= 200; i += 10) {
            weights.push(i);
        }
        return weights;
    }, []);

    const lbsWeights = useMemo(() => {
        const weights = [];
        for (let i = 5; i <= 400; i += 5) {
            weights.push(i);
        }
        return weights;
    }, []);

    const baseUrl = getApiBaseUrl();
    const showStatusBanner = !isOnline || apiUnavailable;
    const statusBannerMessage = !isOnline
        ? 'You are offline. Reconnect to sync workouts.'
        : 'Server unavailable right now. Retrying soon.';

    const formatSelectedWeight = (weightSelection: string | null) => {
        if (!weightSelection) return null;
        if (weightSelection.startsWith('k-')) return `${weightSelection.split('-')[1]} kg`;
        if (weightSelection.startsWith('l-')) return `${weightSelection.split('-')[1]} lbs`;
        return null;
    }

    const parseWeightToSelection = (weightString: string | null | undefined) => {
        if (!weightString || typeof weightString !== 'string') return null;

        const trimmed = weightString.trim().toLowerCase();
        const match = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*(kg|kgs|lb|lbs)$/);
        if (!match) return null;

        const value = match[1];
        const unit = match[2];

        if (unit.startsWith('kg')) return `k-${value}`;
        return `l-${value}`;
    }

    const findCategoryForWorkoutName = (workoutName: string | null | undefined) => {
        if (!workoutName) return 'Chest';

        for (const category of Object.keys(categories)) {
            if (categories[category]?.includes(workoutName)) {
                return category;
            }
        }

        return 'Chest';
    }

    const onAddDateChange = (_event: DateTimePickerEvent, date?: Date) => {
        if (Platform.OS === 'android') {
            setShowAddDatePicker(false);
        }

        if (date) {
            setSelectedDateTime((prevDateTime) => {
                const nextDateTime = new Date(prevDateTime);
                nextDateTime.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                return nextDateTime;
            });
        }
    };

    const onAddTimeChange = (_event: DateTimePickerEvent, date?: Date) => {
        if (Platform.OS === 'android') {
            setShowAddTimePicker(false);
        }

        if (date) {
            setSelectedDateTime((prevDateTime) => {
                const nextDateTime = new Date(prevDateTime);
                nextDateTime.setHours(date.getHours(), date.getMinutes(), 0, 0);
                return nextDateTime;
            });
        }
    };

    const onEditDateChange = (_event: DateTimePickerEvent, date?: Date) => {
        if (Platform.OS === 'android') {
            setShowEditDatePicker(false);
        }

        if (date) {
            setEditDateTime((prevDateTime) => {
                const nextDateTime = new Date(prevDateTime);
                nextDateTime.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                return nextDateTime;
            });
        }
    };

    const onEditTimeChange = (_event: DateTimePickerEvent, date?: Date) => {
        if (Platform.OS === 'android') {
            setShowEditTimePicker(false);
        }

        if (date) {
            setEditDateTime((prevDateTime) => {
                const nextDateTime = new Date(prevDateTime);
                nextDateTime.setHours(date.getHours(), date.getMinutes(), 0, 0);
                return nextDateTime;
            });
        }
    };

    //delete function
    const deleteWorkout = async (id: number) => {
        try{
            const response = await fetch(`${baseUrl}/workoutlist/${id}`, {
                method: "DELETE"
            });

            if (!response.ok) {
                throw new Error(`Delete failed with status ${response.status}`);
            }

            setApiUnavailable(false);

            setWorkouts(workouts.filter(workout => workout.workout_id !== id));

        } 
        catch(err) {
            setApiUnavailable(true);
            console.error(getErrorMessage(err));
        }
    }

    const updateWorkout = async () => {
        if (!editingWorkout) return;

        try {
            const formattedWeight = formatSelectedWeight(editSelectedWeight);
            const created_at = editDateTime.toISOString();

            const body = { name: editName, weight: formattedWeight, created_at };

            const response = await fetch(`${baseUrl}/workoutlist/${editingWorkout.workout_id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                throw new Error(`Update failed with status ${response.status}`);
            }

            setApiUnavailable(false);

            setEditingWorkout(null);
            setEditName("");
            setEditSelectedWeight(null);
            setEditWeightUnit('l');
            setEditSelectedCategory('Chest');
            setEditDateTime(new Date());
            setShowEditDatePicker(false);
            setShowEditTimePicker(false);
            editBottomSheetRef.current?.close();
            getWorkouts();
        } catch (err) {
            setApiUnavailable(true);
            console.error(getErrorMessage(err));
        }
    }

    const openEditSheet = (workout: WorkoutEntry) => {
        setEditingWorkout(workout);
        setEditName(workout?.name ?? "");
        setEditSelectedCategory(findCategoryForWorkoutName(workout?.name));
        const parsedWeight = parseWeightToSelection(workout?.weight);
        setEditSelectedWeight(parsedWeight);
        setEditWeightUnit(parsedWeight?.startsWith('k-') ? 'k' : 'l');

        const workoutDate = new Date(workout.created_at);
        setEditDateTime(Number.isNaN(workoutDate.getTime()) ? new Date() : workoutDate);
        setShowEditDatePicker(false);
        setShowEditTimePicker(false);

        editBottomSheetRef.current?.expand();
    }

    // get function
    const getWorkouts = async () => {
        try{
            console.log("Initiating fetch request...");
            const response = await fetch(`${baseUrl}/workoutlist`); // by default is a GET request

            if (!response.ok) {
                throw new Error(`Fetch failed with status ${response.status}`);
            }

            const jsonData = await response.json();
            console.log(jsonData);

            setApiUnavailable(false);
            setWorkouts(jsonData);
        }
        catch(err){ 
            setApiUnavailable(true);
            console.error(getErrorMessage(err));
        }
    }

    useEffect(() => {
        if (Platform.OS !== 'web' || typeof window === 'undefined') {
            return;
        }

        const updateStatus = () => {
            setIsOnline(window.navigator.onLine);
        };

        updateStatus();
        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);

        return () => {
            window.removeEventListener('online', updateStatus);
            window.removeEventListener('offline', updateStatus);
        };
    }, []);

    useEffect(() => {
        getWorkouts();
    }, []);

    const onSubmitForm = async () => {

        try{
            console.log("Submitting form...");

            const formattedWeight = formatSelectedWeight(selectedWeight);
            const created_at = selectedDateTime.toISOString();

            const body = { name, weight: formattedWeight, created_at }
            const response = await fetch(`${baseUrl}/workoutlist`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`Create failed with status ${response.status}`);
            }

            setApiUnavailable(false);
            setName("");
            setSelectedWeight(null);
            setSelectedWeightUnit('l');
            setSelectedDateTime(new Date());
            setShowAddDatePicker(false);
            setShowAddTimePicker(false);
            DeviceEventEmitter.emit('event.workoutAdded');
            // Close the bottom sheet after successful submission
            bottomSheetRef.current?.close();
            getWorkouts();
        }

                catch (err) {
            setApiUnavailable(true);
                        console.error(getErrorMessage(err));
        }
    }

    // ref
    const bottomSheetRef = useRef<any>(null);
        const editBottomSheetRef = useRef<any>(null);

  // variables
  const snapPoints = useMemo(() => ['90%'], []);

  // callbacks
    const handleSheetChanges = useCallback((index: number) => {
    console.log('handleSheetChanges', index);
  }, []);

    const groupedWorkouts = useMemo(() => {
        const categoryOrder = ['Chest', 'Back', 'Arms', 'Legs', 'Core', 'Other'];
        const groups: Record<string, WorkoutEntry[]> = Object.fromEntries(
            categoryOrder.map((category) => [category, [] as WorkoutEntry[]])
        );

        for (const workout of workouts) {
            const category = getCategoryForWorkout(workout?.name);
            if (!groups[category]) groups[category] = [];
            groups[category].push(workout);
        }

        return categoryOrder
            .map((category) => ({ category, workouts: groups[category] ?? [] }))
            .filter((section) => section.workouts.length > 0);
    }, [workouts]);

    return (
        <GestureHandlerRootView style={styles.container}>
        <Text style={styles.header}> 
            Bulktech
        </Text>
        {showStatusBanner ? (
            <View style={styles.statusBanner}>
                <Text style={styles.statusBannerText}>{statusBannerMessage}</Text>
            </View>
        ) : null}
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
            {groupedWorkouts.map((section) => (
                <View key={section.category} style={styles.sectionContainer}>
                    <Text style={styles.sectionHeader}>{section.category}</Text>

                    {section.workouts.map((workout) => (
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
            <BottomSheetScrollView style={bottomSheetStyles.contentContainer} showsVerticalScrollIndicator={true}>
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
                        <View style={bottomSheetStyles.formSectionsRow}>
                            <View style={bottomSheetStyles.weightSection}>
                                <View style={bottomSheetStyles.weightColumn}>
                                    <Text style={bottomSheetStyles.weightHeader}>Weight</Text>
                                    <View style={bottomSheetStyles.unitToggleRow}>
                                        <TouchableOpacity
                                            style={[
                                                bottomSheetStyles.unitToggleButton,
                                                selectedWeightUnit === 'l' && bottomSheetStyles.unitToggleButtonActive,
                                            ]}
                                            onPress={() => setSelectedWeightUnit('l')}
                                        >
                                            <Text style={[
                                                bottomSheetStyles.unitToggleText,
                                                selectedWeightUnit === 'l' && bottomSheetStyles.categoryTextSelected,
                                            ]}>Lbs</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[
                                                bottomSheetStyles.unitToggleButton,
                                                selectedWeightUnit === 'k' && bottomSheetStyles.unitToggleButtonActive,
                                            ]}
                                            onPress={() => setSelectedWeightUnit('k')}
                                        >
                                            <Text style={[
                                                bottomSheetStyles.unitToggleText,
                                                selectedWeightUnit === 'k' && bottomSheetStyles.categoryTextSelected,
                                            ]}>Kilos</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <ScrollView style={bottomSheetStyles.weightList} nestedScrollEnabled>
                                        {(selectedWeightUnit === 'l' ? lbsWeights : kilosWeights).map((w) => (
                                            <TouchableOpacity
                                                key={`${selectedWeightUnit}-${w}`}
                                                style={[
                                                    bottomSheetStyles.weightItem,
                                                    selectedWeight === `${selectedWeightUnit}-${w}` && { backgroundColor: '#E0E0E0' }
                                                ]}
                                                onPress={() => setSelectedWeight(`${selectedWeightUnit}-${w}`)}
                                            >
                                                <Text style={bottomSheetStyles.weightText}>{w}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>

                            <View style={bottomSheetStyles.dateTimeSection}>
                                <Text style={bottomSheetStyles.sectionLabel}>Date & Time (Optional)</Text>
                                <View style={bottomSheetStyles.dateTimeField}>
                                    <Text style={bottomSheetStyles.fieldLabel}>Date</Text>
                                    <TouchableOpacity
                                        style={bottomSheetStyles.dateTimeInput}
                                        onPress={() => setShowAddDatePicker(true)}
                                    >
                                        <Text style={bottomSheetStyles.dateTimeInputText}>{formatDateInputValue(selectedDateTime)}</Text>
                                    </TouchableOpacity>
                                    {showAddDatePicker ? (
                                        <DateTimePicker
                                            value={selectedDateTime}
                                            mode="date"
                                            display="default"
                                            onChange={onAddDateChange}
                                        />
                                    ) : null}
                                </View>
                                <View style={bottomSheetStyles.dateTimeField}>
                                    <Text style={bottomSheetStyles.fieldLabel}>Time</Text>
                                    <TouchableOpacity
                                        style={bottomSheetStyles.dateTimeInput}
                                        onPress={() => setShowAddTimePicker(true)}
                                    >
                                        <Text style={bottomSheetStyles.dateTimeInputText}>{formatTimeInputValue(selectedDateTime)}</Text>
                                    </TouchableOpacity>
                                    {showAddTimePicker ? (
                                        <DateTimePicker
                                            value={selectedDateTime}
                                            mode="time"
                                            display="default"
                                            onChange={onAddTimeChange}
                                        />
                                    ) : null}
                                </View>
                            </View>
                        </View>
                        <TouchableOpacity style={bottomSheetStyles.addButton} onPress={onSubmitForm}>
                            <Text style={bottomSheetStyles.addButtonText}>Add</Text>
                        </TouchableOpacity>
                    </>
                ) : null}
            </BottomSheetScrollView>
        </BottomSheet>

        <BottomSheet
            ref={editBottomSheetRef}
            index={-1}
            snapPoints={snapPoints}
            enablePanDownToClose={true}
        >
            <BottomSheetScrollView style={bottomSheetStyles.contentContainer} showsVerticalScrollIndicator={true}>
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
                        <View style={bottomSheetStyles.formSectionsRow}>
                            <View style={bottomSheetStyles.weightSection}>
                                <View style={bottomSheetStyles.weightColumn}>
                                    <Text style={bottomSheetStyles.weightHeader}>Weight</Text>
                                    <View style={bottomSheetStyles.unitToggleRow}>
                                        <TouchableOpacity
                                            style={[
                                                bottomSheetStyles.unitToggleButton,
                                                editWeightUnit === 'l' && bottomSheetStyles.unitToggleButtonActive,
                                            ]}
                                            onPress={() => setEditWeightUnit('l')}
                                        >
                                            <Text style={[
                                                bottomSheetStyles.unitToggleText,
                                                editWeightUnit === 'l' && bottomSheetStyles.categoryTextSelected,
                                            ]}>Lbs</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[
                                                bottomSheetStyles.unitToggleButton,
                                                editWeightUnit === 'k' && bottomSheetStyles.unitToggleButtonActive,
                                            ]}
                                            onPress={() => setEditWeightUnit('k')}
                                        >
                                            <Text style={[
                                                bottomSheetStyles.unitToggleText,
                                                editWeightUnit === 'k' && bottomSheetStyles.categoryTextSelected,
                                            ]}>Kilos</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <ScrollView style={bottomSheetStyles.weightList} nestedScrollEnabled>
                                        {(editWeightUnit === 'l' ? lbsWeights : kilosWeights).map((w) => (
                                            <TouchableOpacity
                                                key={`${editWeightUnit}-${w}`}
                                                style={[
                                                    bottomSheetStyles.weightItem,
                                                    editSelectedWeight === `${editWeightUnit}-${w}` && { backgroundColor: '#E0E0E0' }
                                                ]}
                                                onPress={() => setEditSelectedWeight(`${editWeightUnit}-${w}`)}
                                            >
                                                <Text style={bottomSheetStyles.weightText}>{w}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>

                            <View style={bottomSheetStyles.dateTimeSection}>
                                <Text style={bottomSheetStyles.sectionLabel}>Date & Time</Text>
                                <View style={bottomSheetStyles.dateTimeField}>
                                    <Text style={bottomSheetStyles.fieldLabel}>Date</Text>
                                    <TouchableOpacity
                                        style={bottomSheetStyles.dateTimeInput}
                                        onPress={() => setShowEditDatePicker(true)}
                                    >
                                        <Text style={bottomSheetStyles.dateTimeInputText}>{formatDateInputValue(editDateTime)}</Text>
                                    </TouchableOpacity>
                                    {showEditDatePicker ? (
                                        <DateTimePicker
                                            value={editDateTime}
                                            mode="date"
                                            display="default"
                                            onChange={onEditDateChange}
                                        />
                                    ) : null}
                                </View>
                                <View style={bottomSheetStyles.dateTimeField}>
                                    <Text style={bottomSheetStyles.fieldLabel}>Time</Text>
                                    <TouchableOpacity
                                        style={bottomSheetStyles.dateTimeInput}
                                        onPress={() => setShowEditTimePicker(true)}
                                    >
                                        <Text style={bottomSheetStyles.dateTimeInputText}>{formatTimeInputValue(editDateTime)}</Text>
                                    </TouchableOpacity>
                                    {showEditTimePicker ? (
                                        <DateTimePicker
                                            value={editDateTime}
                                            mode="time"
                                            display="default"
                                            onChange={onEditTimeChange}
                                        />
                                    ) : null}
                                </View>
                            </View>
                        </View>

                        <TouchableOpacity style={bottomSheetStyles.addButton} onPress={updateWorkout}>
                            <Text style={bottomSheetStyles.addButtonText}>Save</Text>
                        </TouchableOpacity>
                    </>
                ) : null}
            </BottomSheetScrollView>
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
    statusBanner: {
        backgroundColor: '#5A1A1A',
        borderColor: '#D32F2F',
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 12,
    },
    statusBannerText: {
        color: '#FFFFFF',
        fontSize: 13,
        textAlign: 'center',
    },
    inputGroup: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 15,
        marginBottom: 20,
    },
    input: {
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
        width: '55%',
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
    sectionContainer: {
        marginBottom: 14,
    },
    sectionHeader: {
        color: '#D32F2F',
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 8,
        marginTop: 6,
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
        gap: 6,
        marginLeft: 10,
        flexWrap: 'wrap',
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
      maxHeight: 200,
      marginBottom: 10,
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
  formSectionsRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 10,
      alignItems: 'flex-start',
  },
  weightSection: {
      width: '48%',
      height: 240,
      borderTopWidth: 1,
      borderTopColor: '#ccc',
      paddingTop: 10,
  },
  weightColumn: {
      flex: 1,
      alignItems: 'stretch',
  },
  weightHeader: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 10,
      color: '#333',
  },
  unitToggleRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 10,
  },
  unitToggleButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#D32F2F',
      borderRadius: 8,
      paddingVertical: 8,
      alignItems: 'center',
      backgroundColor: '#f5f5f5',
  },
  unitToggleButtonActive: {
      backgroundColor: '#D32F2F',
  },
  unitToggleText: {
      color: '#333',
      fontWeight: '600',
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
  dateTimeSection: {
      width: '48%',
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: '#ccc',
  },
  sectionLabel: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 12,
      color: '#333',
  },
  dateTimeRow: {
      flexDirection: 'column',
      gap: 8,
  },
  dateTimeField: {
      flex: 1,
  },
  fieldLabel: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 6,
      color: '#D32F2F',
  },
  dateTimeInput: {
      backgroundColor: '#f5f5f5',
      borderWidth: 1,
      borderColor: '#D32F2F',
      borderRadius: 6,
      padding: 10,
      minHeight: 42,
      justifyContent: 'center',
  },
  dateTimeInputText: {
      fontSize: 14,
      color: '#333',
      fontWeight: '500',
  },
});

export default InputWorkout;