import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';

import ListWorkout from './ListWorkouts';
import CharacterModel from './CharacterModel';

type ScreenContentProps = {
  title: string;
  path: string;
  children?: React.ReactNode;
};

export const ScreenContent = ({ title, path, children }: ScreenContentProps) => {
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);

  const handleSelectBodyPart = (bodyPart: string) => {
    setSelectedBodyPart(bodyPart);
  };

  return (
    <View style={styles.container}>
      <View style={styles.modelContainer}>
        <CharacterModel onSelectBodyPart={handleSelectBodyPart} />
      </View>
      {/* <ListWorkout selectedBodyPart={selectedBodyPart} /> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modelContainer: {
    flex: 1,
    paddingTop: 50,
  },
});
