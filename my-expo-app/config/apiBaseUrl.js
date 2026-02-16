import Constants from 'expo-constants';

function trimTrailingSlashes(url) {
  return url.replace(/\/+$/, '');
}

export function getApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return trimTrailingSlashes(envUrl.trim());
  }

  // Dev fallback: use the Expo dev server host to reach your locally-running API.
  const debuggerHost = Constants.expoConfig?.hostUri ?? Constants.manifest?.debuggerHost;
  const ip = debuggerHost?.split(':')?.[0] ?? 'localhost';
  return `http://${ip}:5000`;
}
