import { ScreenContent } from 'components/ScreenContent';
import { StatusBar } from 'expo-status-bar';
import { Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';

import './global.css';
import ListTodo from 'components/ListWorkouts';

export default function App() {
  return (
    <>
    <GestureHandlerRootView>
      <ScreenContent title="Home" path="App.tsx"></ScreenContent>
      <StatusBar style="auto" />
    </GestureHandlerRootView>
    </>
    );
}
