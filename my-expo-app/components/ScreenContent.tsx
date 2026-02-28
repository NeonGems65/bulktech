import React, { useState } from 'react';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';

import { EditScreenInfo } from './EditScreenInfo';
import ListWorkout from './ListWorkouts';
import InputWorkout from './InputWorkout';
import CardioTracker from './CardioTracker';

type ScreenContentProps = {
  title: string;
  path: string;
  children?: React.ReactNode;
};

export const ScreenContent = ({ title, path, children }: ScreenContentProps) => {
  const [activeTab, setActiveTab] = useState<'strength' | 'cardio'>('strength');

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'strength' && styles.activeTab]}
          onPress={() => setActiveTab('strength')}
        >
          <Text style={[styles.tabText, activeTab === 'strength' && styles.activeTabText]}>
            Strength
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'cardio' && styles.activeTab]}
          onPress={() => setActiveTab('cardio')}
        >
          <Text style={[styles.tabText, activeTab === 'cardio' && styles.activeTabText]}>
            Cardio
          </Text>
        </TouchableOpacity>
      </View>
      {activeTab === 'strength' ? <InputWorkout /> : <CardioTracker />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    paddingTop: 50,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#D32F2F',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999999',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
});
