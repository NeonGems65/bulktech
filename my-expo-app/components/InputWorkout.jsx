import React from 'react'
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, DeviceEventEmitter, StyleSheet } from 'react-native';
import Constants from 'expo-constants';

const InputWorkout = () => {

    const [description, setDescription] = useState("");

    // Dynamically determine the IP address of the computer running Expo
    const debuggerHost = Constants.expoConfig?.hostUri ?? Constants.manifest?.debuggerHost;
    const ip = debuggerHost?.split(':')[0] ?? 'localhost';
    const baseUrl = `http://${ip}:5000`;

    const onSubmitForm = async () => {

        try{
            console.log("Submitting form...");
           
            const body = { description }
            await fetch(`${baseUrl}/workoutList`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(body)
            })
            setDescription("");
            DeviceEventEmitter.emit('event.workoutAdded');
        }

        catch (err) {
            console.error(err.message);
        }
    }


    return (
        <View style={styles.container}>
        <Text style={styles.header}> 
            Pern Workout List
        </Text>
        <View style={styles.inputGroup} >
            <TextInput 
                style={styles.input} 
                value={description}
                placeholder="Enter workout description"
                placeholderTextColor="#999"
                onChangeText={text => setDescription(text)} 
            />
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
        padding: 20,
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
        flexDirection: 'row',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        backgroundColor: '#1E1E1E',
        color: '#FFFFFF',
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333',
        marginRight: 10,
    },
    button: {
        backgroundColor: '#D32F2F',
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderRadius: 8,
        justifyContent: 'center',
    },
    buttonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        textTransform: 'uppercase',
    }
});

export default InputWorkout;