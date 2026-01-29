import React, { useCallback, useRef } from 'react'
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, DeviceEventEmitter, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
const InputWorkout = () => {

    const [name, setName] = useState("");
    

    // Dynamically determine the IP address of the computer running Expo
    const debuggerHost = Constants.expoConfig?.hostUri ?? Constants.manifest?.debuggerHost;
    const ip = debuggerHost?.split(':')[0] ?? 'localhost';
    const baseUrl = `http://${ip}:5000`;

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
        }

        catch (err) {
            console.error(err.message);
        }
    }

    // ref
  const bottomSheetRef = useRef(null);

  // callbacks
  const handleSheetChanges = useCallback((index) => {
    console.log('handleSheetChanges', index);
  }, []);


    return (
        <View style={styles.container}>
        <Text style={styles.header}> 
            Bulktech
        </Text>
        <View style={styles.inputGroup} >
            <TextInput 
                style={styles.input} 
                value={name}
                placeholder="Enter workout"
                placeholderTextColor="#999"
                onChangeText={text => setName(text)} 
            />

            <View style={{width: "100%", justifyContent: "center", alignItems: "center"}}>
                <TextInput 
                style={styles.smallInput} 
                value={name}
                placeholder="Lbs"
                placeholderTextColor="#999"
                onChangeText={text => setName(text)} 
            />

            <GestureHandlerRootView style={bottomSheetStyles.container}>
                <BottomSheet
                    ref={bottomSheetRef}
                    onChange={handleSheetChanges}
                >
                    <BottomSheetView style={bottomSheetStyles.contentContainer}>
                    <Text>Awesome 🎉</Text>
                    </BottomSheetView>
                </BottomSheet>
            </GestureHandlerRootView>
            
                </View>

            
            <TouchableOpacity style={styles.button} onPress={onSubmitForm}>
                <Text style={styles.buttonText}>Add</Text>
            </TouchableOpacity>
        </View>
        </View>
    )
}



const styles = StyleSheet.create({
    container: {
        backgroundColor: '#000000',
        padding: 50,
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
        paddingHorizontal: 20,
        borderRadius: 8,
        justifyContent: 'center',
        width: '25%',
    },
    buttonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        textTransform: 'uppercase',
    }
});

const bottomSheetStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'grey',
  },
  contentContainer: {
    flex: 1,
    padding: 36,
    alignItems: 'center',
  },
});

export default InputWorkout;