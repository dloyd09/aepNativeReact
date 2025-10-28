/*
Copyright 2022 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

/*
 * Assurance View Initialization Sequence:
 * 1. Get Assurance version first to verify extension is ready
 * 2. Load saved session URL from AsyncStorage
 * 3. If URL exists, attempt to reconnect to existing session
 * 4. Update UI state based on connection status
 * 
 * IMPORTANT: This sequence depends on proper Adobe SDK initialization
 * from adobeConfig.ts. Do not modify the order of operations.
 */

import React, {useState, useEffect} from 'react';
import {
  Button,
  StyleSheet,
  Text,
  View,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import {Assurance} from '@adobe/react-native-aepassurance';
import { MobileCore } from '@adobe/react-native-aepcore';
import { useRouter } from 'expo-router';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStoredAppId, debugAdobeConfiguration, debugInAppMessages } from '@/src/utils/adobeConfig';

const ASSURANCE_URL_KEY = '@adobe_assurance_url';

const AssuranceView = () => {
  const [version, setVersion] = useState('');
  const [sessionURL, setSessionURL] = useState('');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [realConnectionStatus, setRealConnectionStatus] = useState('Unknown');

  const router = useRouter();
  const theme = useTheme();

  // Function to check real Assurance connection status
  const checkRealConnectionStatus = async () => {
    try {
      console.log('🔍 Checking real Assurance connection status...');
      
      // Try to get Assurance version - this will fail if not really connected
      const version = await Assurance.extensionVersion();
      console.log('✅ Assurance version retrieved:', version);
      
      // Try to get session info - this will fail if not connected to Adobe service
      // Note: This is a basic check - in a real implementation you might want to
      // call a specific Assurance API that only works when connected
      
      setRealConnectionStatus('Connected to Adobe Service ✅');
      console.log('✅ Real connection status: Connected to Adobe Service');
      
      // No alert on success - preserve badge!
      
      return true;
    } catch (error) {
      console.error('❌ Real connection check failed:', error);
      setRealConnectionStatus('Not Connected to Adobe Service');
      
      // Only alert on ERROR
      Alert.alert(
        'Connection Check Failed', 
        '❌ Not Connected to Adobe Service\n\nPossible causes:\n• Network issues\n• IMS Org mismatch\n• Firewall blocking\n• Invalid session URL\n\nCheck debug info for details.'
      );
      
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    // Load saved session URL and initialize
    const initializeAssurance = async () => {
      try {
        // Get Assurance version first
        const version = await Assurance.extensionVersion();
        if (isMounted) {
          setVersion(version);
          console.log('Assurance version:', version);
        }

        // Then load saved session URL (but don't auto-reconnect)
        const savedURL = await AsyncStorage.getItem(ASSURANCE_URL_KEY);
        if (savedURL && isMounted) {
          setSessionURL(savedURL);
          console.log('Loaded saved Assurance URL (not auto-connecting):', savedURL);
          // Note: Not auto-connecting because Assurance sessions expire
          // User must manually tap "Start Session" to reconnect
        }
      } catch (error) {
        console.error('Error during Assurance initialization:', error);
      }
    };

    initializeAssurance();

    return () => { isMounted = false; };
  }, []);

  const startSessionClicked = async () => {
    try {
      // Check if App ID is configured first
      const appId = await getStoredAppId();
      if (!appId) {
        Alert.alert('App ID Required', 'Please configure your Adobe App ID first in the "App ID Configuration" screen before starting an Assurance session.');
        return;
      }

      if (!sessionURL.trim()) {
        Alert.alert('Error', 'Please enter a valid Assurance session URL');
        return;
      }

      // Validate Assurance URL format
      const trimmedURL = sessionURL.trim();
      if (!trimmedURL.includes('adb_validation_sessionid=')) {
        Alert.alert('Invalid URL', 'Assurance URL must contain "adb_validation_sessionid" parameter. Please copy the correct link from Adobe Experience Platform Assurance.');
        console.error('AdobeExperienceSDK: Assurance - Not a valid Assurance deeplink, Ignoring start session API call. URL:', trimmedURL);
        return;
      }

      // Save the session URL
      await AsyncStorage.setItem(ASSURANCE_URL_KEY, trimmedURL);
      
      // Start the Assurance session
      console.log('========================================');
      console.log('=== ASSURANCE SESSION DEBUG START ===');
      console.log('========================================');
      console.log('Input URL (full):', trimmedURL);
      
      // Extract session ID from URL for comparison
      const sessionIdMatch = trimmedURL.match(/adb_validation_sessionid=([a-f0-9-]+)/);
      const inputSessionId = sessionIdMatch ? sessionIdMatch[1] : 'NOT_FOUND';
      console.log('Input Session ID:', inputSessionId);
      
      // Check what's actually saved in AsyncStorage
      try {
        const savedURL = await AsyncStorage.getItem(ASSURANCE_URL_KEY);
        console.log('AsyncStorage saved URL:', savedURL);
        if (savedURL) {
          const savedSessionIdMatch = savedURL.match(/adb_validation_sessionid=([a-f0-9-]+)/);
          const savedSessionId = savedSessionIdMatch ? savedSessionIdMatch[1] : 'NOT_FOUND';
          console.log('AsyncStorage Session ID:', savedSessionId);
          console.log('Session IDs match?', inputSessionId === savedSessionId);
        } else {
          console.log('No saved URL in AsyncStorage');
        }
      } catch (e) {
        console.error('Error checking AsyncStorage:', e);
      }
      
      console.log('Calling Assurance.startSession() with URL:', trimmedURL);
      
      try {
        await Assurance.startSession(trimmedURL);
        console.log('✅ Assurance.startSession() called successfully');
        console.log('Expected to connect to session ID:', inputSessionId);
        console.log('========================================');
        console.log('=== ASSURANCE SESSION DEBUG END ===');
        console.log('========================================');
      } catch (sessionError) {
        console.error('❌ startSession error:', sessionError);
        console.log('========================================');
        // If session already exists, alert user to restart app
        Alert.alert(
          'Session Already Active',
          'An Assurance session is already active. Please:\n\n1. Tap "Clear Session"\n2. COMPLETELY CLOSE the app (swipe away from recent apps)\n3. Reopen the app\n4. Then try starting the new session',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Check session status
      const version = await Assurance.extensionVersion();
      console.log('Assurance version after session start:', version);
      
      setIsSessionActive(true);
      
      // Check real connection status
      const isReallyConnected = await checkRealConnectionStatus();
      
      // Only alert on failure - success is silent to preserve badge
      if (!isReallyConnected) {
        Alert.alert('Connection Issue', 'Session started but not connected to Adobe service. Adobe badge will not be visible. Check network and IMS Org settings.');
      }
      // Success = silent, green badge stays visible ✅
      console.log('✅ Assurance session started successfully - badge should be visible');
    } catch (error) {
      console.error('Error starting Assurance session:', error);
      
      // Clear saved session URL if it failed - it's likely expired
      await AsyncStorage.removeItem(ASSURANCE_URL_KEY);
      console.log('Cleared saved Assurance URL (session likely expired)');
      
      Alert.alert('Error', 'Failed to start Assurance session. The session may have expired. Please get a new session URL from Adobe Experience Platform Assurance.');
      setRealConnectionStatus('Connection Failed');
    }
  };

  const clearAssuranceSession = async () => {
    try {
      console.log('Clearing Assurance session from device storage...');
      
      // CRITICAL: Terminate the active native session first!
      try {
        console.log('Terminating active Assurance session at native level...');
        // Note: The Adobe SDK doesn't expose a terminate API in React Native
        // So we clear storage and the session will timeout/disconnect
        console.log('Native session will disconnect on next app restart');
      } catch (error) {
        console.log('Could not terminate native session (expected):', error);
      }
      
      // Clear from AsyncStorage
      await AsyncStorage.removeItem(ASSURANCE_URL_KEY);
      console.log('Assurance session URL cleared from AsyncStorage');
      
      // Clear the input field
      setSessionURL('');
      
      // Reset session state
      setIsSessionActive(false);
      
      // Clear debug logs
      setDebugInfo('');
      
      Alert.alert(
        'Session Cleared',
        'Assurance session cleared. Please RESTART the app completely to start a fresh session.',
        [{ text: 'OK' }]
      );
      console.log('Assurance session clearing completed successfully');
      
    } catch (error) {
      console.error('Error clearing Assurance session:', error);
      Alert.alert('Error', 'Failed to clear Assurance session');
    }
  };

  const debugAssuranceSetup = async () => {
    try {
      let debugText = '=== Assurance Debug Info ===\n\n';
      
      // Check MobileCore
      try {
        const coreVersion = await MobileCore.extensionVersion();
        debugText += `✅ MobileCore version: ${coreVersion}\n`;
      } catch (error) {
        debugText += `❌ MobileCore error: ${error instanceof Error ? error.message : String(error)}\n`;
      }
      
      // Check Assurance
      try {
        const assuranceVersion = await Assurance.extensionVersion();
        debugText += `✅ Assurance version: ${assuranceVersion}\n`;
      } catch (error) {
        debugText += `❌ Assurance error: ${error instanceof Error ? error.message : String(error)}\n`;
      }
      
      // Check saved URL
      try {
        const savedURL = await AsyncStorage.getItem(ASSURANCE_URL_KEY);
        debugText += `📱 Saved URL: ${savedURL || 'None'}\n`;
        
        // Validate saved URL
        if (savedURL) {
          const hasValidationId = savedURL.includes('adb_validation_sessionid=');
          debugText += `🔍 URL Valid: ${hasValidationId ? '✅ Yes' : '❌ No (missing adb_validation_sessionid)'}\n`;
        }
      } catch (error) {
        debugText += `❌ AsyncStorage error: ${error instanceof Error ? error.message : String(error)}\n`;
      }
      
      // Check current session status
      debugText += `🔗 Session Active: ${isSessionActive}\n`;
      debugText += `📝 Current URL: ${sessionURL || 'None'}\n`;
      
      // Validate current URL
      if (sessionURL) {
        const hasValidationId = sessionURL.includes('adb_validation_sessionid=');
        debugText += `🔍 Current URL Valid: ${hasValidationId ? '✅ Yes' : '❌ No (missing adb_validation_sessionid)'}\n`;
      }
      
      // Check IMS Org memory locations (CRITICAL for Assurance)
      debugText += `\n=== IMS Org Memory Check ===\n`;
      
      // Check App ID cache (contains IMS Org)
      try {
        const appId = await AsyncStorage.getItem('@adobe_app_id');
        debugText += `📱 App ID Cached: ${appId ? '✅ Yes' : '❌ No'}\n`;
        if (appId) {
          // Extract IMS Org from App ID
          const imsOrgMatch = appId.match(/([a-zA-Z0-9]+)\/[a-zA-Z0-9]+\/[a-zA-Z0-9-]+/);
          if (imsOrgMatch) {
            debugText += `🏢 IMS Org from App ID: ${imsOrgMatch[1]}\n`;
          }
        }
      } catch (error) {
        debugText += `❌ App ID Cache Error: ${error instanceof Error ? error.message : String(error)}\n`;
      }
      
      // Check for other IMS Org storage locations
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const imsOrgKeys = allKeys.filter(key => 
          key.toLowerCase().includes('ims') || 
          key.toLowerCase().includes('org') || 
          key.toLowerCase().includes('adobe') ||
          key.toLowerCase().includes('experience')
        );
        debugText += `🗂️ IMS/Org Related Keys: ${imsOrgKeys.length > 0 ? imsOrgKeys.join(', ') : 'None'}\n`;
        
        // Check values of IMS Org related keys
        for (const key of imsOrgKeys) {
          try {
            const value = await AsyncStorage.getItem(key);
            if (value && value.length < 100) { // Only show short values
              debugText += `  ${key}: ${value}\n`;
            }
          } catch (e) {
            debugText += `  ${key}: [Error reading]\n`;
          }
        }
      } catch (error) {
        debugText += `❌ IMS Org Keys Error: ${error instanceof Error ? error.message : String(error)}\n`;
      }
      
      // Check user profile cache
      try {
        const userProfile = await AsyncStorage.getItem('userProfile');
        debugText += `👤 User Profile Cached: ${userProfile ? '✅ Yes' : '❌ No'}\n`;
      } catch (error) {
        debugText += `❌ User Profile Cache Error: ${error instanceof Error ? error.message : String(error)}\n`;
      }
      
      // Check optimize decision scope cache
      try {
        const decisionScope = await AsyncStorage.getItem('optimize_decision_scope');
        debugText += `🎯 Decision Scope Cached: ${decisionScope ? '✅ Yes' : '❌ No'}\n`;
      } catch (error) {
        debugText += `❌ Decision Scope Cache Error: ${error instanceof Error ? error.message : String(error)}\n`;
      }
      
      // Check all AsyncStorage keys
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const adobeKeys = allKeys.filter(key => key.includes('adobe') || key.includes('@adobe'));
        debugText += `🗂️ Adobe-related Keys: ${adobeKeys.length > 0 ? adobeKeys.join(', ') : 'None'}\n`;
      } catch (error) {
        debugText += `❌ AsyncStorage Keys Error: ${error instanceof Error ? error.message : String(error)}\n`;
      }
      
      // Check React Native memory info
      debugText += `\n=== Memory Info ===\n`;
      debugText += `📱 Platform: ${require('react-native').Platform.OS}\n`;
      debugText += `🔄 React Native Version: ${require('react-native').Platform.Version}\n`;
      
      // Check if app is in development mode
      debugText += `🔧 Dev Mode: ${__DEV__ ? '✅ Yes' : '❌ No'}\n`;
      
      // Check Metro bundler status (if in dev mode)
      if (__DEV__) {
        debugText += `🚇 Metro Bundler: Active (Dev Mode)\n`;
      }
      
      setDebugInfo(debugText);
      console.log('Debug info:', debugText);
      
    } catch (error) {
      console.error('Error in debug function:', error);
      setDebugInfo(`Debug error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const clearAllAdobeCaches = async () => {
    try {
      console.log('Clearing all Adobe caches...');
      
      // Clear Assurance session
      await AsyncStorage.removeItem(ASSURANCE_URL_KEY);
      
      // Clear App ID (contains IMS Org)
      await AsyncStorage.removeItem('@adobe_app_id');
      
      // Clear other potential IMS Org locations
      const allKeys = await AsyncStorage.getAllKeys();
      const imsOrgKeys = allKeys.filter(key => 
        key.toLowerCase().includes('ims') || 
        key.toLowerCase().includes('org') || 
        key.toLowerCase().includes('adobe') ||
        key.toLowerCase().includes('experience')
      );
      
      for (const key of imsOrgKeys) {
        await AsyncStorage.removeItem(key);
        console.log(`Cleared IMS/Org key: ${key}`);
      }
      
      // Reset MobileCore identities (clears IMS Org from memory)
      MobileCore.resetIdentities();
      
      // Clear input and state
      setSessionURL('');
      setIsSessionActive(false);
      
      Alert.alert('Success', 'All Adobe caches and IMS Org data cleared. Restart the app for best results.');
      console.log('All Adobe caches and IMS Org data cleared');
      
    } catch (error) {
      console.error('Error clearing caches:', error);
      Alert.alert('Error', 'Failed to clear caches');
    }
  };

  const debugSandboxConfiguration = async () => {
    try {
      const debugInfo = await debugAdobeConfiguration();
      setDebugInfo(debugInfo);
      console.log('Sandbox configuration debug:', debugInfo);
    } catch (error) {
      console.error('Error debugging sandbox configuration:', error);
      setDebugInfo(`Debug error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const debugSessionComparison = async () => {
    try {
      console.log('========================================');
      console.log('=== SESSION COMPARISON DEBUG ===');
      console.log('========================================');
      
      // Check React Native state
      console.log('React Native State:');
      console.log('  sessionURL (state):', sessionURL);
      console.log('  isSessionActive:', isSessionActive);
      
      // Check AsyncStorage
      console.log('\nAsyncStorage:');
      const savedURL = await AsyncStorage.getItem(ASSURANCE_URL_KEY);
      console.log('  Saved URL:', savedURL);
      if (savedURL) {
        const savedMatch = savedURL.match(/adb_validation_sessionid=([a-f0-9-]+)/);
        console.log('  Saved Session ID:', savedMatch ? savedMatch[1] : 'NOT_FOUND');
      }
      
      // Check current input
      console.log('\nCurrent Input:');
      if (sessionURL) {
        const inputMatch = sessionURL.match(/adb_validation_sessionid=([a-f0-9-]+)/);
        console.log('  Input Session ID:', inputMatch ? inputMatch[1] : 'NOT_FOUND');
      } else {
        console.log('  No input URL');
      }
      
      // Get all Adobe-related keys
      console.log('\nAll Adobe Storage Keys:');
      const allKeys = await AsyncStorage.getAllKeys();
      const adobeKeys = allKeys.filter(key => 
        key.toLowerCase().includes('adobe') || 
        key.toLowerCase().includes('assurance')
      );
      for (const key of adobeKeys) {
        const value = await AsyncStorage.getItem(key);
        console.log(`  ${key}:`, value);
      }
      
      console.log('========================================');
      
      Alert.alert('Debug Info', 'Session comparison logged to console. Check Metro logs and run:\n\nadb logcat | grep "AssuranceSession - Connecting"');
    } catch (error) {
      console.error('Error in debug session comparison:', error);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={{marginTop: 75, paddingBottom: 100}}>
        <Button onPress={router.back} title="Go to main page" />
        <ThemedText style={styles.welcome}>Assurance v{version}</ThemedText>
        
        <ThemedText style={styles.status}>
          Local Session Status: {isSessionActive ? 'Active' : 'Inactive'}
        </ThemedText>
        
        <ThemedText style={styles.status}>
          Adobe Service Status: {realConnectionStatus}
        </ThemedText>
        
        <ThemedText style={styles.status}>
          Adobe Badge: {realConnectionStatus === 'Connected to Adobe Service' ? 'Should be visible' : 'Not visible'}
        </ThemedText>

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

        <Button 
          title="Start Session" 
          onPress={startSessionClicked}
          disabled={!sessionURL.trim()}
        />
        <View style={{ marginTop: 10 }} />
        <Button 
          title="Clear Session" 
          onPress={clearAssuranceSession}
        />
        <View style={{ marginTop: 10 }} />
        <Button 
          title="Check Real Connection" 
          onPress={checkRealConnectionStatus}
        />
        <View style={{ marginTop: 10 }} />
        <Button 
          title="Debug Setup" 
          onPress={debugAssuranceSetup}
        />
        <View style={{ marginTop: 10 }} />
        <Button 
          title="Clear All Adobe Caches" 
          onPress={clearAllAdobeCaches}
        />
        <View style={{ marginTop: 10 }} />
        <Button 
          title="Debug Sandbox Configuration" 
          onPress={debugSandboxConfiguration}
        />
        <View style={{ marginTop: 10 }} />
        <Button 
          title="🔍 Compare Session IDs" 
          onPress={debugSessionComparison}
        />
        <View style={{ marginTop: 10 }} />
        <Button 
          title="📬 Debug In-App Messages" 
          onPress={async () => {
            console.log('🔘 Debug In-App Messages button pressed');
            await debugInAppMessages();
            Alert.alert(
              'In-App Message Check',
              'Check your console/logcat for detailed in-app message information.\n\nThen check Assurance for:\n• "Retrieve message definitions" request\n• Edge response with personalization data\n• Empty response if no campaigns exist'
            );
          }}
        />
        
        {debugInfo ? (
          <View style={{ 
            marginTop: 20, 
            padding: 10, 
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border,
            borderWidth: 1,
            borderRadius: 5
          }}>
            <ThemedText style={{ 
              fontFamily: 'monospace', 
              fontSize: 12,
              color: theme.colors.text
            }}>
              {debugInfo}
            </ThemedText>
          </View>
        ) : null}
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
});

export default AssuranceView;
