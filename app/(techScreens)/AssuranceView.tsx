import React, { useEffect, useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Assurance } from '@adobe/react-native-aepassurance';
import { MobileCore } from '@adobe/react-native-aepcore';
import { useRouter } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { getStoredAppId } from '@/src/utils/adobeConfig';

const ASSURANCE_URL_KEY = '@adobe_assurance_url';

const AssuranceView = () => {
  const [version, setVersion] = useState('');
  const [sessionURL, setSessionURL] = useState('');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [serviceStatus, setServiceStatus] = useState('Unknown');
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    const initialize = async () => {
      try {
        const [assuranceVersion, savedURL] = await Promise.all([
          Assurance.extensionVersion(),
          AsyncStorage.getItem(ASSURANCE_URL_KEY),
        ]);
        setVersion(assuranceVersion);
        if (savedURL) {
          setSessionURL(savedURL);
        }
      } catch (error) {
        console.error('Error initializing Assurance view:', error);
      }
    };

    initialize();
  }, []);

  const refreshSessionStatus = async () => {
    try {
      await Assurance.extensionVersion();
      setServiceStatus('Connected / extension available');
      return true;
    } catch (error) {
      console.error('Failed to refresh Assurance status:', error);
      setServiceStatus('Unavailable');
      return false;
    }
  };

  const startSessionClicked = async () => {
    try {
      const appId = await getStoredAppId();
      if (!appId) {
        Alert.alert('App ID Required', 'Configure the Adobe App ID before starting an Assurance session.');
        return;
      }

      const trimmedURL = sessionURL.trim();
      if (!trimmedURL) {
        Alert.alert('Missing URL', 'Enter a valid Assurance session URL.');
        return;
      }

      if (!trimmedURL.includes('adb_validation_sessionid=')) {
        Alert.alert('Invalid URL', 'The Assurance URL must contain the adb_validation_sessionid parameter.');
        return;
      }

      await AsyncStorage.setItem(ASSURANCE_URL_KEY, trimmedURL);
      await Assurance.startSession(trimmedURL);
      setIsSessionActive(true);
      await refreshSessionStatus();
    } catch (error) {
      console.error('Error starting Assurance session:', error);
      await AsyncStorage.removeItem(ASSURANCE_URL_KEY);
      setIsSessionActive(false);
      setServiceStatus('Connection failed');
      Alert.alert('Session Failed', 'Unable to start the Assurance session. Use a fresh session URL and try again.');
    }
  };

  const clearAssuranceSession = async () => {
    try {
      await AsyncStorage.removeItem(ASSURANCE_URL_KEY);
      setSessionURL('');
      setIsSessionActive(false);
      setServiceStatus('Cleared');
      Alert.alert('Session Cleared', 'The saved Assurance URL was removed from local storage. Restart the app if you need a completely fresh native session.');
    } catch (error) {
      console.error('Error clearing Assurance session:', error);
      Alert.alert('Error', 'Failed to clear the saved Assurance session URL.');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={{ marginTop: 75, paddingBottom: 100 }}>
        <Button onPress={() => router.back()} title="Go to main page" />
        <ThemedText style={styles.welcome}>Assurance v{version}</ThemedText>
        <ThemedText style={styles.helper}>
          This screen is for session connection and compact diagnostics only. The only local value it persists is the saved Assurance URL.
        </ThemedText>

        <ThemedText style={styles.status}>Local Session Status: {isSessionActive ? 'Active' : 'Inactive'}</ThemedText>
        <ThemedText style={styles.status}>Adobe Service Status: {serviceStatus}</ThemedText>

        <TextInput
          style={{
            height: 40,
            margin: 10,
            padding: 10,
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
            borderColor: theme.colors.border,
            borderWidth: 1,
          }}
          placeholder="myapp://"
          placeholderTextColor={theme.colors.text}
          value={sessionURL}
          onChangeText={setSessionURL}
        />

        <Button title="Start Session" onPress={startSessionClicked} disabled={!sessionURL.trim()} />
        <View style={{ marginTop: 10 }} />
        <Button title="Clear Saved Session" onPress={clearAssuranceSession} />
        <View style={{ marginTop: 10 }} />
        <Button title="Refresh Session Status" onPress={refreshSessionStatus} />
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcome: {
    fontSize: 25,
    textAlign: 'center',
    margin: 10,
    marginTop: 80,
  },
  status: {
    fontSize: 16,
    textAlign: 'center',
    margin: 10,
  },
  helper: {
    fontSize: 13,
    textAlign: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
  },
});

export default AssuranceView;
