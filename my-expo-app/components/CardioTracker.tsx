import React, { useCallback, useRef, useMemo, useEffect } from 'react'
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, DeviceEventEmitter, StyleSheet, ScrollView, Platform, Dimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { LineChart } from 'react-native-chart-kit';
import { getApiBaseUrl } from '../config/apiBaseUrl';
import { getCachedCardio, cacheCardio, clearCardioCache } from '../utils/cardioCache';

type CardioEntry = {
    cardio_id: number;
    name: string;
    duration_minutes: number;
    created_at: string;
};

const CardioTracker = () => {

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

    const [selectedCardio, setSelectedCardio] = useState<string | null>(null);
    const [duration, setDuration] = useState("");
    const [selectedDateTime, setSelectedDateTime] = useState(new Date());
    const [showAddDatePicker, setShowAddDatePicker] = useState(false);
    const [showAddTimePicker, setShowAddTimePicker] = useState(false);
    const [cardioList, setCardioList] = useState<CardioEntry[]>([]);
    
    const [editingCardio, setEditingCardio] = useState<CardioEntry | null>(null);
    const [editSelectedCardio, setEditSelectedCardio] = useState<string | null>(null);
    const [editDuration, setEditDuration] = useState("");
    const [editDateTime, setEditDateTime] = useState(new Date());
    const [showEditDatePicker, setShowEditDatePicker] = useState(false);
    const [showEditTimePicker, setShowEditTimePicker] = useState(false);

    const [isOnline, setIsOnline] = useState(true);
    const [apiUnavailable, setApiUnavailable] = useState(false);
    const [expandedCardio, setExpandedCardio] = useState<Set<string>>(new Set());

    const cardioOptions = [
        'Treadmill',
        'Bicycle (Stationary)',
        'Bicycle (Outdoor)',
        'Elliptical',
        'Outdoor Run',
        'Stair Climber',
        'Rowing Machine'
    ];

    const baseUrl = getApiBaseUrl();

    const showStatusBanner = !isOnline || apiUnavailable;
    const statusBannerMessage = !isOnline
        ? 'You are offline. Reconnect to sync cardio.'
        : 'Server unavailable right now. Retrying soon.';

    const formatDateInputValue = (date: Date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    const formatTimeInputValue = (date: Date) => {
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    const onAddDateChange = (event: DateTimePickerEvent, date?: Date) => {
        if (Platform.OS === 'android') {
            setShowAddDatePicker(false);
        }

        if (event.type === 'set' && date) {
            setSelectedDateTime((prevDateTime) => {
                const nextDateTime = new Date(prevDateTime);
                nextDateTime.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                return nextDateTime;
            });
        }
    };

    const onAddTimeChange = (event: DateTimePickerEvent, date?: Date) => {
        if (Platform.OS === 'android') {
            setShowAddTimePicker(false);
        }

        if (event.type === 'set' && date) {
            setSelectedDateTime((prevDateTime) => {
                const nextDateTime = new Date(prevDateTime);
                nextDateTime.setHours(date.getHours(), date.getMinutes(), 0, 0);
                return nextDateTime;
            });
        }
    };

    const onEditDateChange = (event: DateTimePickerEvent, date?: Date) => {
        if (Platform.OS === 'android') {
            setShowEditDatePicker(false);
        }

        if (event.type === 'set' && date) {
            setEditDateTime((prevDateTime) => {
                const nextDateTime = new Date(prevDateTime);
                nextDateTime.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                return nextDateTime;
            });
        }
    };

    const onEditTimeChange = (event: DateTimePickerEvent, date?: Date) => {
        if (Platform.OS === 'android') {
            setShowEditTimePicker(false);
        }

        if (event.type === 'set' && date) {
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

    // Delete cardio entry
    const deleteCardio = async (id: number) => {
        try{
            const response = await fetch(`${baseUrl}/cardiolist/${id}`, {
                method: "DELETE"
            });

            if (!response.ok) {
                throw new Error(`Delete failed with status ${response.status}`);
            }

            setApiUnavailable(false);
            setCardioList(cardioList.filter(cardio => cardio.cardio_id !== id));
            // Clear cache after deletion
            await clearCardioCache();
        } 
        catch(err) {
            setApiUnavailable(true);
            console.error(getErrorMessage(err));
        }
    }

    // Update cardio entry
    const updateCardio = async () => {
        if (!editingCardio) return;

        try {
            const created_at = editDateTime.toISOString();
            
            const body = { name: editSelectedCardio, duration_minutes: parseInt(editDuration), created_at };

            const response = await fetch(`${baseUrl}/cardiolist/${editingCardio.cardio_id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                throw new Error(`Update failed with status ${response.status}`);
            }

            setApiUnavailable(false);
            setEditingCardio(null);
            setEditSelectedCardio(null);
            setEditDuration("");
            setEditDateTime(new Date());
            setShowEditDatePicker(false);
            setShowEditTimePicker(false);
            editBottomSheetRef.current?.close();
            // Clear cache after update so fresh data is fetched
            await clearCardioCache();
            getCardioList();
        } catch (err) {
            setApiUnavailable(true);
            console.error(getErrorMessage(err));
        }
    }

    // Open edit sheet
    const openEditSheet = (cardio: CardioEntry) => {
        setEditingCardio(cardio);
        setEditSelectedCardio(cardio?.name ?? "");
        setEditDuration(cardio?.duration_minutes?.toString() ?? "");

        const cardioDate = new Date(cardio.created_at);
        setEditDateTime(Number.isNaN(cardioDate.getTime()) ? new Date() : cardioDate);
        setShowEditDatePicker(false);
        setShowEditTimePicker(false);
        
        editBottomSheetRef.current?.expand();
    }

    // Get all cardio entries
    const getCardioList = async () => {
        try{
            console.log("Fetching cardio list...");
            const response = await fetch(`${baseUrl}/cardiolist`);

            if (!response.ok) {
                throw new Error(`Fetch failed with status ${response.status}`);
            }

            const jsonData = await response.json();
            setApiUnavailable(false);
            setCardioList(jsonData);
            // Update cache with fresh data
            await cacheCardio(jsonData);
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
        // Load from cache first for instant display
        const loadCardio = async () => {
            try {
                const cachedData = await getCachedCardio();
                if (cachedData) {
                    console.log("Loading cardio from cache...");
                    setCardioList(cachedData);
                }
            } catch (error) {
                console.error("Error loading cached cardio:", error);
            }
        };

        // Load from cache immediately
        loadCardio();
        
        // Then fetch fresh data from server in the background
        getCardioList();
    }, []);

    // Submit new cardio
    const onSubmitForm = async () => {
        if (!selectedCardio || !duration) return;

        try{
            console.log("Submitting cardio...");
            
            const created_at = selectedDateTime.toISOString();
            
            const body = { name: selectedCardio, duration_minutes: parseInt(duration), created_at }
            const response = await fetch(`${baseUrl}/cardiolist`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`Create failed with status ${response.status}`);
            }

            setApiUnavailable(false);
            setSelectedCardio(null);
            setDuration("");
            setSelectedDateTime(new Date());
            setShowAddDatePicker(false);
            setShowAddTimePicker(false);
            bottomSheetRef.current?.close();
            // Clear cache after adding new cardio so fresh data is fetched
            await clearCardioCache();
            getCardioList();
        }
        catch (err) {
            setApiUnavailable(true);
            console.error(getErrorMessage(err));
        }
    }

    const bottomSheetRef = useRef<any>(null);
    const editBottomSheetRef = useRef<any>(null);
    const snapPoints = useMemo(() => {
        if (Platform.OS === 'web') {
            return ['90%'];
        }
        return ['100%'];
    }, []);

    const handleSheetChanges = useCallback((index: number) => {
        console.log('handleSheetChanges', index);
    }, []);

    const toggleExpandCardio = (cardioName: string) => {
        const nextExpanded = new Set(expandedCardio);
        if (nextExpanded.has(cardioName)) {
            nextExpanded.delete(cardioName);
        } else {
            nextExpanded.add(cardioName);
        }
        setExpandedCardio(nextExpanded);
    };

    const groupedCardio = useMemo(() => {
        const groupsByName: Record<string, CardioEntry[]> = {};

        for (const entry of cardioList) {
            if (!groupsByName[entry.name]) {
                groupsByName[entry.name] = [];
            }
            groupsByName[entry.name].push(entry);
        }

        for (const name in groupsByName) {
            groupsByName[name].sort((a, b) => {
                const dateA = new Date(a.created_at).getTime();
                const dateB = new Date(b.created_at).getTime();
                return dateB - dateA;
            });
        }

        return Object.entries(groupsByName)
            .map(([name, entries]) => ({
                name,
                latest: entries[0],
                history: entries.slice(1),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [cardioList]);

    const getCardioChartData = (latest: CardioEntry, history: CardioEntry[]) => {
        const allEntries = [...history, latest];
        const lastTen = allEntries.slice(-10);

        const labels = lastTen.map((entry) => {
            const date = new Date(entry.created_at);
            return `${date.getMonth() + 1}/${date.getDate()}`;
        });

        const data = lastTen.map((entry) => entry.duration_minutes);

        if (data.length === 0) return null;

        return {
            labels,
            datasets: [{ data }],
        };
    };

    return (
        <GestureHandlerRootView style={styles.container}>
        <Text style={styles.header}>
            Cardio Tracker
        </Text>
        {showStatusBanner ? (
            <View style={styles.statusBanner}>
                <Text style={styles.statusBannerText}>{statusBannerMessage}</Text>
            </View>
        ) : null}
        <View style={styles.inputGroup}>
            <TouchableOpacity style={[styles.button, { marginTop: 10, backgroundColor: '#4CAF50' }]} onPress={() => bottomSheetRef.current?.expand()}>
                <Text style={styles.buttonText}>+ Add Cardio</Text>
            </TouchableOpacity>
        </View>

        <View style={styles.listContainer}>
            <View style={styles.headerRow}>
                <Text style={styles.headerText}>Cardio Sessions</Text>
            </View>
            <ScrollView style={styles.scrollView}>
            {cardioList.length === 0 ? (
                <Text style={styles.emptyText}>No cardio sessions yet. Start tracking!</Text>
            ) : (
                groupedCardio.map((cardioGroup) => (
                    <View key={cardioGroup.name} style={styles.sectionContainer}>
                        <View style={styles.row}>
                            <View style={styles.cardioInfo}>
                                <Text style={styles.rowText}>{cardioGroup.latest.name}</Text>
                                <Text style={styles.durationText}>{cardioGroup.latest.duration_minutes} minutes</Text>
                                {cardioGroup.latest.created_at ? (
                                    <Text style={styles.dateText}>{formatDateTime(cardioGroup.latest.created_at)}</Text>
                                ) : null}
                                {cardioGroup.history.length > 0 && (
                                    <View style={styles.latestBadge}>
                                        <Text style={styles.latestBadgeText}>Latest</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.rowActions}>
                                {cardioGroup.history.length > 0 && (
                                    <TouchableOpacity
                                        style={[styles.historyButton, expandedCardio.has(cardioGroup.name) && styles.historyButtonActive]}
                                        onPress={() => toggleExpandCardio(cardioGroup.name)}
                                    >
                                        <Text style={styles.historyButtonText}>{expandedCardio.has(cardioGroup.name) ? '▼' : '▶'}</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={styles.editButton}
                                    onPress={() => openEditSheet(cardioGroup.latest)}
                                >
                                    <Text style={styles.editButtonText}>Edit</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.deleteButton}
                                    onPress={() => deleteCardio(cardioGroup.latest.cardio_id)}
                                >
                                    <Text style={styles.deleteButtonText}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {expandedCardio.has(cardioGroup.name) && cardioGroup.history.length > 0 && (
                            <View>
                                {getCardioChartData(cardioGroup.latest, cardioGroup.history) && (
                                    <View style={styles.chartContainer}>
                                        <Text style={styles.chartTitle}>Duration Progression</Text>
                                        <LineChart
                                            data={getCardioChartData(cardioGroup.latest, cardioGroup.history)!}
                                            width={Dimensions.get('window').width - 60}
                                            height={220}
                                            chartConfig={{
                                                backgroundColor: '#1E1E1E',
                                                backgroundGradientFrom: '#1E1E1E',
                                                backgroundGradientTo: '#000000',
                                                color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
                                                strokeWidth: 2,
                                                propsForDots: {
                                                    r: '5',
                                                    strokeWidth: '2',
                                                    stroke: '#4CAF50',
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

                                {cardioGroup.history.map((entry) => (
                                    <View key={entry.cardio_id} style={[styles.row, styles.historyRow]}>
                                        <View style={styles.cardioInfo}>
                                            <Text style={[styles.rowText, styles.historyRowText]}>{entry.name}</Text>
                                            <Text style={styles.durationText}>{entry.duration_minutes} minutes</Text>
                                            {entry.created_at ? (
                                                <Text style={styles.dateText}>{formatDateTime(entry.created_at)}</Text>
                                            ) : null}
                                        </View>

                                        <View style={styles.rowActions}>
                                            <TouchableOpacity
                                                style={styles.editButton}
                                                onPress={() => openEditSheet(entry)}
                                            >
                                                <Text style={styles.editButtonText}>Edit</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.deleteButton}
                                                onPress={() => deleteCardio(entry.cardio_id)}
                                            >
                                                <Text style={styles.deleteButtonText}>Delete</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                ))
            )}
            </ScrollView>
        </View>

        {/* Add/Log Cardio Bottom Sheet */}
        <BottomSheet
            ref={bottomSheetRef}
            index={-1}
            snapPoints={snapPoints}
            enablePanDownToClose={true}
            onChange={handleSheetChanges}
        >
            <BottomSheetView style={sheetStyles.contentContainer}>
                <Text style={sheetStyles.sheetTitle}>Log Cardio Session</Text>
                
                <Text style={sheetStyles.label}>Select Exercise</Text>
                <BottomSheetScrollView style={sheetStyles.optionsContainer}>
                    {cardioOptions.map((option, index) => (
                        <TouchableOpacity 
                            key={index}
                            style={[
                                sheetStyles.optionButton,
                                selectedCardio === option && { backgroundColor: '#81C784' }
                            ]}
                            onPress={() => setSelectedCardio(option)}
                        >
                            <Text style={[
                                sheetStyles.optionText,
                                selectedCardio === option && sheetStyles.optionTextSelected
                            ]}>
                                {option}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </BottomSheetScrollView>

                {selectedCardio && (
                    <>
                        <Text style={sheetStyles.label}>Duration (minutes)</Text>
                        <TextInput
                            style={sheetStyles.durationInput}
                            placeholder="Enter minutes"
                            placeholderTextColor="#999"
                            keyboardType="number-pad"
                            value={duration}
                            onChangeText={setDuration}
                        />
                        
                        <View style={sheetStyles.dateTimeSection}>
                            <Text style={sheetStyles.sectionLabel}>Date & Time (Optional)</Text>
                            <View style={sheetStyles.dateTimeRow}>
                                <View style={sheetStyles.dateTimeField}>
                                    <Text style={sheetStyles.fieldLabel}>Date</Text>
                                    {Platform.OS === 'web' ? (
                                        <input
                                            type="date"
                                            value={formatDateInputValue(selectedDateTime)}
                                            onChange={(event) => onWebDateChange(event.target.value, false)}
                                            style={{
                                                width: '100%',
                                                minHeight: 42,
                                                borderRadius: 6,
                                                border: '1px solid #4CAF50',
                                                padding: '10px',
                                                backgroundColor: '#1E1E1E',
                                                color: '#FFFFFF',
                                                fontSize: '14px',
                                            }}
                                        />
                                    ) : (
                                        <TouchableOpacity
                                            style={sheetStyles.dateTimeInput}
                                            onPress={openAddDatePicker}
                                        >
                                            <Text style={sheetStyles.dateTimeInputText}>{formatDateInputValue(selectedDateTime)}</Text>
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
                                <View style={sheetStyles.dateTimeField}>
                                    <Text style={sheetStyles.fieldLabel}>Time</Text>
                                    {Platform.OS === 'web' ? (
                                        <input
                                            type="time"
                                            value={formatTimeInputValue(selectedDateTime)}
                                            onChange={(event) => onWebTimeChange(event.target.value, false)}
                                            style={{
                                                width: '100%',
                                                minHeight: 42,
                                                borderRadius: 6,
                                                border: '1px solid #4CAF50',
                                                padding: '10px',
                                                backgroundColor: '#1E1E1E',
                                                color: '#FFFFFF',
                                                fontSize: '14px',
                                            }}
                                        />
                                    ) : (
                                        <TouchableOpacity
                                            style={sheetStyles.dateTimeInput}
                                            onPress={openAddTimePicker}
                                        >
                                            <Text style={sheetStyles.dateTimeInputText}>{formatTimeInputValue(selectedDateTime)}</Text>
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
                        
                        <TouchableOpacity style={sheetStyles.addButton} onPress={onSubmitForm}>
                            <Text style={sheetStyles.addButtonText}>Log Session</Text>
                        </TouchableOpacity>
                    </>
                )}
            </BottomSheetView>
        </BottomSheet>

        {/* Edit Cardio Bottom Sheet */}
        <BottomSheet
            ref={editBottomSheetRef}
            index={-1}
            snapPoints={snapPoints}
            enablePanDownToClose={true}
        >
            <BottomSheetView style={sheetStyles.contentContainer}>
                <Text style={sheetStyles.sheetTitle}>Edit Cardio Session</Text>
                
                <Text style={sheetStyles.label}>Select Exercise</Text>
                <BottomSheetScrollView style={sheetStyles.optionsContainer}>
                    {cardioOptions.map((option, index) => (
                        <TouchableOpacity 
                            key={index}
                            style={[
                                sheetStyles.optionButton,
                                editSelectedCardio === option && { backgroundColor: '#81C784' }
                            ]}
                            onPress={() => setEditSelectedCardio(option)}
                        >
                            <Text style={[
                                sheetStyles.optionText,
                                editSelectedCardio === option && sheetStyles.optionTextSelected
                            ]}>
                                {option}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </BottomSheetScrollView>

                <Text style={sheetStyles.label}>Duration (minutes)</Text>
                <TextInput
                    style={sheetStyles.durationInput}
                    placeholder="Enter minutes"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    value={editDuration}
                    onChangeText={setEditDuration}
                />
                
                <View style={sheetStyles.dateTimeSection}>
                    <Text style={sheetStyles.sectionLabel}>Date & Time</Text>
                    <View style={sheetStyles.dateTimeRow}>
                        <View style={sheetStyles.dateTimeField}>
                            <Text style={sheetStyles.fieldLabel}>Date</Text>
                            {Platform.OS === 'web' ? (
                                <input
                                    type="date"
                                    value={formatDateInputValue(editDateTime)}
                                    onChange={(event) => onWebDateChange(event.target.value, true)}
                                    style={{
                                        width: '100%',
                                        minHeight: 42,
                                        borderRadius: 6,
                                        border: '1px solid #4CAF50',
                                        padding: '10px',
                                        backgroundColor: '#1E1E1E',
                                        color: '#FFFFFF',
                                        fontSize: '14px',
                                    }}
                                />
                            ) : (
                                <TouchableOpacity
                                    style={sheetStyles.dateTimeInput}
                                    onPress={openEditDatePicker}
                                >
                                    <Text style={sheetStyles.dateTimeInputText}>{formatDateInputValue(editDateTime)}</Text>
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
                        <View style={sheetStyles.dateTimeField}>
                            <Text style={sheetStyles.fieldLabel}>Time</Text>
                            {Platform.OS === 'web' ? (
                                <input
                                    type="time"
                                    value={formatTimeInputValue(editDateTime)}
                                    onChange={(event) => onWebTimeChange(event.target.value, true)}
                                    style={{
                                        width: '100%',
                                        minHeight: 42,
                                        borderRadius: 6,
                                        border: '1px solid #4CAF50',
                                        padding: '10px',
                                        backgroundColor: '#1E1E1E',
                                        color: '#FFFFFF',
                                        fontSize: '14px',
                                    }}
                                />
                            ) : (
                                <TouchableOpacity
                                    style={sheetStyles.dateTimeInput}
                                    onPress={openEditTimePicker}
                                >
                                    <Text style={sheetStyles.dateTimeInputText}>{formatTimeInputValue(editDateTime)}</Text>
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
                
                <TouchableOpacity style={sheetStyles.updateButton} onPress={updateCardio}>
                    <Text style={sheetStyles.updateButtonText}>Update Session</Text>
                </TouchableOpacity>
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
    button: {
        backgroundColor: '#4CAF50',
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
        borderBottomColor: '#4CAF50',
        marginBottom: 10,
    },
    headerText: {
        color: '#4CAF50',
        fontSize: 16,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    scrollView: {
        marginBottom: 20,
    },
    emptyText: {
        color: '#999999',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 40,
    },
    sectionContainer: {
        marginBottom: 14,
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
    cardioInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    rowText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    durationText: {
        color: '#4CAF50',
        fontSize: 14,
        fontWeight: '600',
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
    latestBadge: {
        backgroundColor: '#4CAF50',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
        marginTop: 6,
        alignSelf: 'flex-start',
    },
    latestBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    historyRow: {
        backgroundColor: '#151515',
        marginLeft: 10,
        marginRight: 0,
        borderLeftWidth: 3,
        borderLeftColor: '#4CAF50',
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
        borderLeftColor: '#4CAF50',
    },
    chartTitle: {
        color: '#4CAF50',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 10,
        textTransform: 'uppercase',
    },
});

const sheetStyles = StyleSheet.create({
    contentContainer: {
        flex: 1,
        padding: 36,
    },
    sheetTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#FFFFFF',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4CAF50',
        marginBottom: 10,
        marginTop: 15,
    },
    optionsContainer: {
        marginBottom: 20,
        maxHeight: 250,
    },
    optionButton: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        width: '100%',
        backgroundColor: '#1E1E1E',
        marginBottom: 8,
        borderRadius: 5,
    },
    optionText: {
        fontSize: 14,
        color: '#FFFFFF',
    },
    optionTextSelected: {
        color: '#000000',
        fontWeight: '600',
    },
    durationInput: {
        backgroundColor: '#1E1E1E',
        color: '#FFFFFF',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#4CAF50',
        fontSize: 14,
        marginBottom: 20,
    },
    addButton: {
        backgroundColor: '#4CAF50',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 15,
    },
    addButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    updateButton: {
        backgroundColor: '#2196F3',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 15,
    },
    updateButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    dateTimeSection: {
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#ccc',
    },
    sectionLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#FFFFFF',
    },
    dateTimeRow: {
        flexDirection: 'row',
        gap: 12,
    },
    dateTimeField: {
        flex: 1,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 6,
        color: '#4CAF50',
    },
    dateTimeInput: {
        backgroundColor: '#1E1E1E',
        borderWidth: 1,
        borderColor: '#4CAF50',
        borderRadius: 6,
        padding: 10,
        minHeight: 42,
        justifyContent: 'center',
        fontSize: 14,
        color: '#FFFFFF',
    },
    dateTimeInputText: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '500',
    },
});

export default CardioTracker;
