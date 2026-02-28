import React, { useCallback, useRef, useMemo, useEffect } from 'react'
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, DeviceEventEmitter, StyleSheet, ScrollView, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { getApiBaseUrl } from '../config/apiBaseUrl';

const CardioTracker = () => {

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

    const [selectedCardio, setSelectedCardio] = useState(null);
    const [duration, setDuration] = useState("");
    const [cardioList, setCardioList] = useState([]);
    
    const [editingCardio, setEditingCardio] = useState(null);
    const [editSelectedCardio, setEditSelectedCardio] = useState(null);
    const [editDuration, setEditDuration] = useState("");

    const [isOnline, setIsOnline] = useState(true);
    const [apiUnavailable, setApiUnavailable] = useState(false);

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

    // Delete cardio entry
    const deleteCardio = async (id) => {
        try{
            const response = await fetch(`${baseUrl}/cardiolist/${id}`, {
                method: "DELETE"
            });

            if (!response.ok) {
                throw new Error(`Delete failed with status ${response.status}`);
            }

            setApiUnavailable(false);
            setCardioList(cardioList.filter(cardio => cardio.cardio_id !== id));
        } 
        catch(err) {
            setApiUnavailable(true);
            console.error(err.message);
        }
    }

    // Update cardio entry
    const updateCardio = async () => {
        if (!editingCardio) return;

        try {
            const body = { name: editSelectedCardio, duration_minutes: parseInt(editDuration) };

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
            editBottomSheetRef.current?.close();
            getCardioList();
        } catch (err) {
            setApiUnavailable(true);
            console.error(err.message);
        }
    }

    // Open edit sheet
    const openEditSheet = (cardio) => {
        setEditingCardio(cardio);
        setEditSelectedCardio(cardio?.name ?? "");
        setEditDuration(cardio?.duration_minutes?.toString() ?? "");
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
        }
        catch(err){ 
            setApiUnavailable(true);
            console.error(err.message);
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
        getCardioList();
    }, []);

    // Submit new cardio
    const onSubmitForm = async () => {
        if (!selectedCardio || !duration) return;

        try{
            console.log("Submitting cardio...");
            
            const body = { name: selectedCardio, duration_minutes: parseInt(duration) }
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
            bottomSheetRef.current?.close();
            getCardioList();
        }
        catch (err) {
            setApiUnavailable(true);
            console.error(err.message);
        }
    }

    const bottomSheetRef = useRef(null);
    const editBottomSheetRef = useRef(null);
    const snapPoints = useMemo(() => ['80%'], []);

    const handleSheetChanges = useCallback((index) => {
        console.log('handleSheetChanges', index);
    }, []);

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
                cardioList.map((cardio) => (
                    <View key={cardio.cardio_id} style={styles.row}>
                        <View style={styles.cardioInfo}>
                            <Text style={styles.rowText}>{cardio.name}</Text>
                            <Text style={styles.durationText}>{cardio.duration_minutes} minutes</Text>
                            {cardio.created_at ? (
                                <Text style={styles.dateText}>{formatDateTime(cardio.created_at)}</Text>
                            ) : null}
                        </View>

                        <View style={styles.rowActions}>
                            <TouchableOpacity
                                style={styles.editButton}
                                onPress={() => openEditSheet(cardio)}
                            >
                                <Text style={styles.editButtonText}>Edit</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={() => deleteCardio(cardio.cardio_id)}
                            >
                                <Text style={styles.deleteButtonText}>Delete</Text>
                            </TouchableOpacity>
                        </View>
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
});

export default CardioTracker;
