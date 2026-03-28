import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_KEY = 'userProfile';

/**
 * Parse a JSON string from AsyncStorage safely. Returns `fallback` if the value
 * is null, empty, or malformed — and logs the parse error so it is not silent.
 */
function safeParseJSON(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error('[useProfileStorage] Failed to parse stored profile JSON:', error);
    return fallback;
  }
}

export function useProfileStorage() {
  const [profile, setProfile] = useState({ firstName: '', email: '' });
  // true until the initial AsyncStorage read completes — consumers should guard
  // XDM event sends with `if (isProfileLoading) return;` to avoid empty-identity events.
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const storedProfile = await AsyncStorage.getItem(PROFILE_KEY);
        const parsed = safeParseJSON(storedProfile, null);
        if (parsed) {
          setProfile(parsed);
        }
      } catch (error) {
        console.error('Failed to load profile from storage:', error);
      } finally {
        setIsProfileLoading(false);
      }
    };

    loadProfile();
  }, []);

  const saveProfile = async (newProfile) => {
    try {
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile));
      setProfile(newProfile);
    } catch (error) {
      console.error('Failed to save profile to storage:', error);
    }
  };

  return { profile, setProfile: saveProfile, isProfileLoading };
}