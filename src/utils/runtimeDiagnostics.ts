import AsyncStorage from '@react-native-async-storage/async-storage';

export const LAST_RUNTIME_ERROR_KEY = '@last_runtime_error';

type RuntimeErrorPayload = {
  source: 'error-boundary' | 'global-handler';
  message: string;
  stack?: string;
  isFatal?: boolean;
  timestamp: string;
};

export async function persistRuntimeError(payload: RuntimeErrorPayload): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_RUNTIME_ERROR_KEY, JSON.stringify(payload));
    console.error('Persisted runtime error payload:', payload);
  } catch (storageError) {
    console.error('Failed to persist runtime error payload:', storageError);
    console.error('Original runtime error payload:', payload);
  }
}

export async function clearPersistedRuntimeError(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_RUNTIME_ERROR_KEY);
  } catch (error) {
    console.error('Failed to clear persisted runtime error:', error);
  }
}
