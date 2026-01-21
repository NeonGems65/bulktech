import React from 'react'
import { Fragment, useState } from 'react';
import { View,Text, TextInput, Button, DeviceEventEmitter } from 'react-native';
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
            console.log(body)
            const response = await fetch(`${baseUrl}/workoutList`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(body)
            })
            console.log(JSON.stringify(body))
            setDescription("");
            DeviceEventEmitter.emit('event.workoutAdded');
        }

        catch (err) {
            console.error(err.message);
        }
    }


    return (
        <View>
        <Text className='text-center mt-5'> 
            Pern Workout List
        </Text>
        <View className='d-flex mt-5' >
            <TextInput className='form-control' value={description}
            onChangeText={text => setDescription(text)} />
            <Button title="Add Workout" className='btn btn-success' onPress={onSubmitForm}/>
        </View>
        </View>
    )
}

export default InputWorkout;