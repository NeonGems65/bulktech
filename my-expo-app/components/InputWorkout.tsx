import React, { useCallback, useRef, useMemo, useEffect } from 'react'
import { useState } from 'react';
import { View, Text, TouchableOpacity, DeviceEventEmitter, StyleSheet, ScrollView, Platform, Dimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { LineChart } from 'react-native-chart-kit';
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
    const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(new Set());
    const [chartUnitMode, setChartUnitMode] = useState<'l' | 'k'>('l');

    const categories: Record<string, string[]> = {
        Chest: ['Incline DB Bench Press', 'Chest Fly', 'Chest Press', 'Plate Chest Press'],
        Back: ['Deadlift', 'Pull Ups', 'Barbell Row', 'Lat Pulldown', 'Seated Cable Row', 'Row Machine', 'Rear Delt Fly', 'Plate Row'],
        Arms: ['Bayesian Curls', 'Cable Bar Curl', 'Preacher Curls', 'Tricep Extensions', 'Tricep Pulldown', 'Hammer Curls', 'Dips', 'Forearm Cable Curls', 'Shoulder Press', 'Cable Hammer Curls'],
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
        for (let i = 5; i <= 200; i += 5) {
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

    const parseWeightAndUnit = (weightString: string | null | undefined): { value: number; unit: 'lbs' | 'kg' } | null => {
        if (!weightString || typeof weightString !== 'string') return null;

        const trimmed = weightString.trim().toLowerCase();
        const match = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*(kg|kgs|lb|lbs)$/);
        if (!match) return null;

        const value = parseFloat(match[1]);
        const unit = match[2].startsWith('kg') ? 'kg' : 'lbs';

        return { value, unit };
    };

    const convertWeight = (weight: { value: number; unit: 'lbs' | 'kg' }, targetUnit: 'lbs' | 'kg'): number => {
        if (weight.unit === targetUnit) {
            return weight.value;
        }

        if (weight.unit === 'kg' && targetUnit === 'lbs') {
            return weight.value * 2.20462;
        }

        if (weight.unit === 'lbs' && targetUnit === 'kg') {
            return weight.value / 2.20462;
        }

        return weight.value;
    };

    const getChartData = (latest: WorkoutEntry, history: WorkoutEntry[], unit: 'l' | 'k' = 'l') => {
        const allWorkouts = [latest, ...history];
        const targetUnit = unit === 'l' ? 'lbs' : 'kg';
        
        // Parse weights with units and convert to target unit
        const weights = allWorkouts
            .map(workout => {
                if (!workout.weight) return null;
                const parsed = parseWeightAndUnit(workout.weight);
                if (!parsed) return null;
                return convertWeight(parsed, targetUnit);
            })
            .reverse();

        // Get labels (dates)
        const labels = allWorkouts
            .map(workout => {
                const date = new Date(workout.created_at);
                return `${date.getMonth() + 1}/${date.getDate()}`;
            })
            .reverse();

        // Filter out any null weights
        const validWeights = weights.filter((w): w is number => w !== null);
        
        if (validWeights.length === 0) {
            // Return empty chart data if no weights
            return null;
        }

        // Round weights to 1 decimal place for display
        const roundedWeights = validWeights.map(w => Math.round(w * 10) / 10);

        return {
            labels: labels.slice(-10), // Show last 10
            datasets: [
                {
                    data: roundedWeights.slice(-10), // Show last 10
                }
            ]
        };
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

    const onWebDateChange = (value: string, isEdit: boolean) => {
        const [year, month, day] = value.split('-').map(Number);
        if (!year || !month || !day) return;

        if (isEdit) {
            setEditDateTime((prevDateTime) => {
                const nextDateTime = new Date(prevDateTime);
                nextDateTime.setFullYear(year, month - 1, day);
                return nextDateTime;
            });
            return;
        }

        setSelectedDateTime((prevDateTime) => {
            const nextDateTime = new Date(prevDateTime);
            nextDateTime.setFullYear(year, month - 1, day);
            return nextDateTime;
        });
    };

    const onWebTimeChange = (value: string, isEdit: boolean) => {
        const [hours, minutes] = value.split(':').map(Number);
        if (Number.isNaN(hours) || Number.isNaN(minutes)) return;

        if (isEdit) {
            setEditDateTime((prevDateTime) => {
                const nextDateTime = new Date(prevDateTime);
                nextDateTime.setHours(hours, minutes, 0, 0);
                return nextDateTime;
            });
            return;
        }

        setSelectedDateTime((prevDateTime) => {
            const nextDateTime = new Date(prevDateTime);
            nextDateTime.setHours(hours, minutes, 0, 0);
            return nextDateTime;
        });
    };

    const openAddDatePicker = () => {
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: selectedDateTime,
                mode: 'date',
                display: 'default',
                onChange: onAddDateChange,
            });
            return;
        }

        setShowAddDatePicker(true);
    };

    const openAddTimePicker = () => {
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: selectedDateTime,
                mode: 'time',
                display: 'default',
                is24Hour: false,
                onChange: onAddTimeChange,
            });
            return;
        }

        setShowAddTimePicker(true);
    };

    const openEditDatePicker = () => {
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: editDateTime,
                mode: 'date',
                display: 'default',
                onChange: onEditDateChange,
            });
            return;
        }

        setShowEditDatePicker(true);
    };

    const openEditTimePicker = () => {
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: editDateTime,
                mode: 'time',
                display: 'default',
                is24Hour: false,
                onChange: onEditTimeChange,
            });
            return;
        }

        setShowEditTimePicker(true);
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
  const snapPoints = useMemo(() => {
    if (Platform.OS === 'web') {
      return ['90%'];
    }
    return ['100%'];
  }, []);

  // callbacks
    const handleSheetChanges = useCallback((index: number) => {
    console.log('handleSheetChanges', index);
  }, []);

    const toggleExpandWorkout = (workoutName: string) => {
        const newExpanded = new Set(expandedWorkouts);
        if (newExpanded.has(workoutName)) {
            newExpanded.delete(workoutName);
        } else {
            newExpanded.add(workoutName);
        }
        setExpandedWorkouts(newExpanded);
    };

    const groupedWorkouts = useMemo(() => {
        const groupsByName: Record<string, WorkoutEntry[]> = {};

        // Group all workouts by name
        for (const workout of workouts) {
            if (!groupsByName[workout.name]) {
                groupsByName[workout.name] = [];
            }
            groupsByName[workout.name].push(workout);
        }

        // Sort each group by date (newest first)
        for (const name in groupsByName) {
            groupsByName[name].sort((a, b) => {
                const dateA = new Date(a.created_at).getTime();
                const dateB = new Date(b.created_at).getTime();
                return dateB - dateA;
            });
        }

        // Convert to array and sort by category, then name
        return Object.entries(groupsByName)
            .map(([name, entries]) => ({
                name,
                latest: entries[0],
                history: entries.slice(1),
                category: getCategoryForWorkout(name),
            }))
            .sort((a, b) => {
                const categoryOrder = { 'Chest': 0, 'Back': 1, 'Arms': 2, 'Legs': 3, 'Core': 4, 'Other': 5 };
                const categoryCompare = (categoryOrder[a.category as keyof typeof categoryOrder] ?? 999) -
                                       (categoryOrder[b.category as keyof typeof categoryOrder] ?? 999);
                if (categoryCompare !== 0) return categoryCompare;
                return a.name.localeCompare(b.name);
            });
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
            {groupedWorkouts.map((workoutGroup) => (
                <View key={workoutGroup.name} style={styles.sectionContainer}>
                    {/* Latest Workout Entry */}
                    <View style={styles.row}>
                        <View style={styles.workoutInfo}>
                            <Text style={styles.rowText}>{workoutGroup.latest.name}</Text>
                            {workoutGroup.latest.weight ? <Text style={styles.weightText}>{workoutGroup.latest.weight}</Text> : null}
                            {workoutGroup.latest.created_at ? (
                                <Text style={styles.dateText}>{formatDateTime(workoutGroup.latest.created_at)}</Text>
                            ) : null}
                            {workoutGroup.history.length > 0 && (
                                <View style={styles.latestBadge}>
                                    <Text style={styles.latestBadgeText}>Latest</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.rowActions}>
                            {workoutGroup.history.length > 0 && (
                                <TouchableOpacity
                                    style={[styles.historyButton, expandedWorkouts.has(workoutGroup.name) && styles.historyButtonActive]}
                                    onPress={() => toggleExpandWorkout(workoutGroup.name)}
                                >
                                    <Text style={styles.historyButtonText}>{expandedWorkouts.has(workoutGroup.name) ? '▼' : '▶'}</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={styles.editButton}
                                onPress={() => openEditSheet(workoutGroup.latest)}
                            >
                                <Text style={styles.editButtonText}>Edit</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={() => deleteWorkout(workoutGroup.latest.workout_id)}
                            >
                                <Text style={styles.deleteButtonText}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* History Entries */}
                    {expandedWorkouts.has(workoutGroup.name) && workoutGroup.history.length > 0 && (
                        <View>
                            {/* Progression Chart */}
                            {getChartData(workoutGroup.latest, workoutGroup.history, chartUnitMode) && (
                                <View style={styles.chartContainer}>
                                    <View style={styles.chartHeaderRow}>
                                        <Text style={styles.chartTitle}>Progression</Text>
                                        <View style={styles.chartUnitToggle}>
                                            <TouchableOpacity
                                                style={[
                                                    styles.chartUnitButton,
                                                    chartUnitMode === 'l' && styles.chartUnitButtonActive,
                                                ]}
                                                onPress={() => setChartUnitMode('l')}
                                            >
                                                <Text style={[
                                                    styles.chartUnitButtonText,
                                                    chartUnitMode === 'l' && styles.chartUnitButtonTextActive,
                                                ]}>Lbs</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[
                                                    styles.chartUnitButton,
                                                    chartUnitMode === 'k' && styles.chartUnitButtonActive,
                                                ]}
                                                onPress={() => setChartUnitMode('k')}
                                            >
                                                <Text style={[
                                                    styles.chartUnitButtonText,
                                                    chartUnitMode === 'k' && styles.chartUnitButtonTextActive,
                                                ]}>Kg</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    <LineChart
                                        data={getChartData(workoutGroup.latest, workoutGroup.history, chartUnitMode)!}
                                        width={Dimensions.get('window').width - 60}
                                        height={220}
                                        chartConfig={{
                                            backgroundColor: '#1E1E1E',
                                            backgroundGradientFrom: '#1E1E1E',
                                            backgroundGradientTo: '#000000',
                                            color: (opacity = 1) => `rgba(211, 47, 47, ${opacity})`,
                                            strokeWidth: 2,
                                            propsForDots: {
                                                r: '5',
                                                strokeWidth: '2',
                                                stroke: '#D32F2F',
                                            },
                                            propsForLabels: {
                                                fontSize: 12,
                                                fill: '#999999',
                                            },
                                            propsForBackgroundLines: {
                                                strokeDasharray: '5',
                                                stroke: '#333333',
                                            },
                                        }}
                                        style={{
                                            borderRadius: 8,
                                            marginVertical: 10,
                                        }}
                                        bezier
                                    />
                                </View>
                            )}
                            
                            {workoutGroup.history.map((workout) => (
                                <View key={workout.workout_id} style={[styles.row, styles.historyRow]}>
                                    <View style={styles.workoutInfo}>
                                        <Text style={[styles.rowText, styles.historyRowText]}>{workout.name}</Text>
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
                    )}
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
                                    {Platform.OS === 'web' ? (
                                        <input
                                            type="date"
                                            value={formatDateInputValue(selectedDateTime)}
                                            onChange={(event) => onWebDateChange(event.target.value, false)}
                                            style={{
                                                width: '100%',
                                                minHeight: 42,
                                                borderRadius: 6,
                                                border: '1px solid #D32F2F',
                                                padding: '10px',
                                                backgroundColor: '#f5f5f5',
                                                color: '#333',
                                                fontSize: '14px',
                                            }}
                                        />
                                    ) : (
                                        <TouchableOpacity
                                            style={bottomSheetStyles.dateTimeInput}
                                            onPress={openAddDatePicker}
                                        >
                                            <Text style={bottomSheetStyles.dateTimeInputText}>{formatDateInputValue(selectedDateTime)}</Text>
                                        </TouchableOpacity>
                                    )}
                                    {Platform.OS === 'ios' && showAddDatePicker ? (
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
                                    {Platform.OS === 'web' ? (
                                        <input
                                            type="time"
                                            value={formatTimeInputValue(selectedDateTime)}
                                            onChange={(event) => onWebTimeChange(event.target.value, false)}
                                            style={{
                                                width: '100%',
                                                minHeight: 42,
                                                borderRadius: 6,
                                                border: '1px solid #D32F2F',
                                                padding: '10px',
                                                backgroundColor: '#f5f5f5',
                                                color: '#333',
                                                fontSize: '14px',
                                            }}
                                        />
                                    ) : (
                                        <TouchableOpacity
                                            style={bottomSheetStyles.dateTimeInput}
                                            onPress={openAddTimePicker}
                                        >
                                            <Text style={bottomSheetStyles.dateTimeInputText}>{formatTimeInputValue(selectedDateTime)}</Text>
                                        </TouchableOpacity>
                                    )}
                                    {Platform.OS === 'ios' && showAddTimePicker ? (
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
                                    {Platform.OS === 'web' ? (
                                        <input
                                            type="date"
                                            value={formatDateInputValue(editDateTime)}
                                            onChange={(event) => onWebDateChange(event.target.value, true)}
                                            style={{
                                                width: '100%',
                                                minHeight: 42,
                                                borderRadius: 6,
                                                border: '1px solid #D32F2F',
                                                padding: '10px',
                                                backgroundColor: '#f5f5f5',
                                                color: '#333',
                                                fontSize: '14px',
                                            }}
                                        />
                                    ) : (
                                        <TouchableOpacity
                                            style={bottomSheetStyles.dateTimeInput}
                                            onPress={openEditDatePicker}
                                        >
                                            <Text style={bottomSheetStyles.dateTimeInputText}>{formatDateInputValue(editDateTime)}</Text>
                                        </TouchableOpacity>
                                    )}
                                    {Platform.OS === 'ios' && showEditDatePicker ? (
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
                                    {Platform.OS === 'web' ? (
                                        <input
                                            type="time"
                                            value={formatTimeInputValue(editDateTime)}
                                            onChange={(event) => onWebTimeChange(event.target.value, true)}
                                            style={{
                                                width: '100%',
                                                minHeight: 42,
                                                borderRadius: 6,
                                                border: '1px solid #D32F2F',
                                                padding: '10px',
                                                backgroundColor: '#f5f5f5',
                                                color: '#333',
                                                fontSize: '14px',
                                            }}
                                        />
                                    ) : (
                                        <TouchableOpacity
                                            style={bottomSheetStyles.dateTimeInput}
                                            onPress={openEditTimePicker}
                                        >
                                            <Text style={bottomSheetStyles.dateTimeInputText}>{formatTimeInputValue(editDateTime)}</Text>
                                        </TouchableOpacity>
                                    )}
                                    {Platform.OS === 'ios' && showEditTimePicker ? (
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
    latestBadge: {
        backgroundColor: '#D32F2F',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
        marginVertical: 6,
        alignSelf: 'flex-start',
    },
    latestBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
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
    historyButton: {
        backgroundColor: '#666666',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    historyButtonActive: {
        backgroundColor: '#555555',
    },
    historyButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    historyRow: {
        backgroundColor: '#151515',
        marginLeft: 10,
        marginRight: 0,
        borderLeftWidth: 3,
        borderLeftColor: '#D32F2F',
        paddingLeft: 12,
    },
    historyRowText: {
        fontSize: 14,
        color: '#E0E0E0',
    },
    chartContainer: {
        backgroundColor: '#1E1E1E',
        borderRadius: 8,
        padding: 15,
        marginVertical: 10,
        marginLeft: 10,
        marginRight: 0,
        borderLeftWidth: 3,
        borderLeftColor: '#D32F2F',
    },
    chartHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    chartTitle: {
        color: '#D32F2F',
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    chartUnitToggle: {
        flexDirection: 'row',
        gap: 8,
    },
    chartUnitButton: {
        borderWidth: 1,
        borderColor: '#D32F2F',
        borderRadius: 5,
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: '#000000',
    },
    chartUnitButtonActive: {
        backgroundColor: '#D32F2F',
    },
    chartUnitButtonText: {
        color: '#D32F2F',
        fontSize: 11,
        fontWeight: 'bold',
    },
    chartUnitButtonTextActive: {
        color: '#FFFFFF',
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