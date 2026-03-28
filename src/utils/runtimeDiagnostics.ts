import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAdobeReadiness, AdobeReadinessState } from './adobeReadiness';
import { getStoredAppId } from './adobeConfig';

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

/**
 * Diagnostic snapshot for tech screens and Assurance debugging flows (item 5.3).
 * Requires item 2.1 (adobeReadiness) to surface SDK state — do not call before
 * the SDK init sequence has started or readiness will always read 'idle'.
 */
export type DiagnosticSnapshot = {
  sdkReadiness: AdobeReadinessState;
  appIdConfigured: boolean;
  appId: string | null;
  timestamp: string;
};

export async function getDiagnosticSnapshot(): Promise<DiagnosticSnapshot> {
  const appId = await getStoredAppId();
  return {
    sdkReadiness: getAdobeReadiness(),
    appIdConfigured: Boolean(appId && appId.trim()),
    appId,
    timestamp: new Date().toISOString(),
  };
}
