import AsyncStorage from '@react-native-async-storage/async-storage';

const CARDIO_CACHE_KEY = '@cardio_cache';
const CARDIO_CACHE_TIMESTAMP_KEY = '@cardio_cache_timestamp';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Save cardio entries to cache
 */
export const cacheCardio = async (cardioList) => {
  try {
    await AsyncStorage.multiSet([
      [CARDIO_CACHE_KEY, JSON.stringify(cardioList)],
      [CARDIO_CACHE_TIMESTAMP_KEY, Date.now().toString()],
    ]);
  } catch (error) {
    console.error('Error caching cardio:', error);
  }
};

/**
 * Get cached cardio entries (if they exist and are not expired)
 */
export const getCachedCardio = async () => {
  try {
    const [cachedCardio, timestamp] = await AsyncStorage.multiGet([
      CARDIO_CACHE_KEY,
      CARDIO_CACHE_TIMESTAMP_KEY,
    ]);

    if (!cachedCardio[1] || !timestamp[1]) {
      return null;
    }

    const cacheTime = parseInt(timestamp[1]);
    const isExpired = Date.now() - cacheTime > CACHE_DURATION_MS;

    if (isExpired) {
      // Clear expired cache
      await AsyncStorage.removeItem(CARDIO_CACHE_KEY);
      await AsyncStorage.removeItem(CARDIO_CACHE_TIMESTAMP_KEY);
      return null;
    }

    return JSON.parse(cachedCardio[1]);
  } catch (error) {
    console.error('Error retrieving cached cardio:', error);
    return null;
  }
};

/**
 * Clear cardio cache
 */
export const clearCardioCache = async () => {
  try {
    await AsyncStorage.multiRemove([
      CARDIO_CACHE_KEY,
      CARDIO_CACHE_TIMESTAMP_KEY,
    ]);
  } catch (error) {
    console.error('Error clearing cardio cache:', error);
  }
};
