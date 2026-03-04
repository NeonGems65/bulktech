import AsyncStorage from '@react-native-async-storage/async-storage';

const WORKOUTS_CACHE_KEY = '@workouts_cache';
const WORKOUTS_CACHE_TIMESTAMP_KEY = '@workouts_cache_timestamp';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Save workouts to cache
 */
export const cacheWorkouts = async (workouts) => {
  try {
    await AsyncStorage.multiSet([
      [WORKOUTS_CACHE_KEY, JSON.stringify(workouts)],
      [WORKOUTS_CACHE_TIMESTAMP_KEY, Date.now().toString()],
    ]);
  } catch (error) {
    console.error('Error caching workouts:', error);
  }
};

/**
 * Get cached workouts (if they exist and are not expired)
 */
export const getCachedWorkouts = async () => {
  try {
    const [cachedWorkouts, timestamp] = await AsyncStorage.multiGet([
      WORKOUTS_CACHE_KEY,
      WORKOUTS_CACHE_TIMESTAMP_KEY,
    ]);

    if (!cachedWorkouts[1] || !timestamp[1]) {
      return null;
    }

    const cacheTime = parseInt(timestamp[1]);
    const isExpired = Date.now() - cacheTime > CACHE_DURATION_MS;

    if (isExpired) {
      // Clear expired cache
      await AsyncStorage.removeItem(WORKOUTS_CACHE_KEY);
      await AsyncStorage.removeItem(WORKOUTS_CACHE_TIMESTAMP_KEY);
      return null;
    }

    return JSON.parse(cachedWorkouts[1]);
  } catch (error) {
    console.error('Error retrieving cached workouts:', error);
    return null;
  }
};

/**
 * Clear workouts cache
 */
export const clearWorkoutsCache = async () => {
  try {
    await AsyncStorage.multiRemove([
      WORKOUTS_CACHE_KEY,
      WORKOUTS_CACHE_TIMESTAMP_KEY,
    ]);
  } catch (error) {
    console.error('Error clearing workouts cache:', error);
  }
};
