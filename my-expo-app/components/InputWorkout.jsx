import React from 'react'
import { Fragment, useState } from 'react';
import { View,Text, TextInput, Button } from 'react-native';
const InputWorkout = () => {

    const [description, setDescription] = useState("");

    const onSubmitForm = async (e) => {
        e.preventDefault()

        try{
           
            const body = { description }
            console.log(body)
            const response = await fetch("http://10.0.0.249:5000/workoutList", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(body)
            })
            console.log(JSON.stringify(body))
            window.location = "/";
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
            <TextInput type='text' className='form-control' value={description}
            onChange={e => setDescription(e.target.value)}></TextInput>
            <Button title="Add Workout" className='btn btn-success' onPress={onSubmitForm}/>
        </View>
        </View>
    )
}

export default InputWorkout;