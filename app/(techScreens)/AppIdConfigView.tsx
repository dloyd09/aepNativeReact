import React, { useState, useEffect } from 'react';
import { Button, Text, View, TextInput, ScrollView, Alert, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MobileCore } from '@adobe/react-native-aepcore';
import { Optimize } from '@adobe/react-native-aepoptimize';
import { Target } from '@adobe/react-native-aeptarget';
import styles from '../../styles/styles';
import { useRouter } from 'expo-router';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '@react-navigation/native';
import { configureAdobe } from '../../src/utils/adobeConfig';

const { AppIdModule } = NativeModules;
const APP_ID_STORAGE_KEY = '@adobe_app_id';

const AppIdConfigView = () => {
  const [appId, setAppId] = useState('');
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    // Load saved App ID when component mounts
    loadSavedAppId();
  }, []);

  const loadSavedAppId = async () => {
    try {
      const savedAppId = await AsyncStorage.getItem(APP_ID_STORAGE_KEY);
      console.log('Loaded saved App ID:', savedAppId);
      if (savedAppId) {
        setAppId(savedAppId);
        // Configure SDK with saved App ID
        await configureAdobe(savedAppId);
      }
    } catch (error) {
      console.error('Error loading App ID:', error);
    }
  };

  const saveAppId = async () => {
    try {
      if (!appId.trim()) {
        Alert.alert('Error', 'Please enter a valid App ID');
        return;
      }

      console.log('Attempting to save App ID:', appId.trim());
      
      // Save to AsyncStorage
      await AsyncStorage.setItem(APP_ID_STORAGE_KEY, appId.trim());
      console.log('Successfully saved App ID to AsyncStorage');
      
      // Configure Adobe SDK with new App ID
      console.log('Configuring Adobe SDK with App ID:', appId.trim());
      try {
        await configureAdobe(appId.trim());
        Alert.alert('Success', 'App ID saved and SDK configured successfully');
      } catch (configError) {
        console.error('Adobe SDK configuration error:', configError);
        Alert.alert('Partial Success', 'App ID saved to device, but Adobe SDK configuration had issues. Check console for details.');
      }
    } catch (error) {
      console.error('Error saving App ID:', error);
      Alert.alert('Error', 'Failed to save App ID');
    }
  };

  const clearAppId = async () => {
    try {
      console.log('Clearing App ID from device storage and Adobe cache...');
      
      // Clear from AsyncStorage
      await AsyncStorage.removeItem(APP_ID_STORAGE_KEY);
      console.log('App ID cleared from AsyncStorage');
      
      // Clear the input field
      setAppId('');
      
      // Clear Adobe SDK caches comprehensively
      try {
        // Clear Optimize cached propositions
        Optimize.clearCachedPropositions();
        console.log('Optimize cached propositions cleared');
        
        // Clear Target prefetch cache
        Target.clearPrefetchCache();
        console.log('Target prefetch cache cleared');
        
        // Reset identities (clears ECID and other identity data)
        MobileCore.resetIdentities();
        console.log('MobileCore identities reset');
        
        // Clear other potential caches
        try {
          // Clear User Profile data
          UserProfile.removeUserAttributes();
          console.log('User Profile data cleared');
        } catch (error) {
          console.log('User Profile clearing not available or failed');
        }
        
        try {
          // Clear Places data
          Places.clear();
          console.log('Places data cleared');
        } catch (error) {
          console.log('Places clearing not available or failed');
        }
        
        try {
          // Clear Consent data - reset to default "no"
          const { Consent } = require('@adobe/react-native-aepedgeconsent');
          const resetConsents = {
            consents: {collect: {val: 'n'}}
          };
          Consent.update(resetConsents);
          console.log('Consent data cleared and reset to "no"');
        } catch (error) {
          console.log('Consent clearing not available or failed');
        }
        
        try {
          // Clear Target experience data
          Target.resetExperience();
          console.log('Target experience data cleared');
        } catch (error) {
          console.log('Target experience clearing not available or failed');
        }
        
        try {
          // Clear MobileCore updated configuration
          MobileCore.clearUpdatedConfiguration();
          console.log('MobileCore updated configuration cleared');
        } catch (error) {
          console.log('MobileCore configuration clearing not available or failed');
        }
        
        // Clear specific known AsyncStorage keys
        const knownKeys = [
          'userProfile', // Consumer offers profile data
          'optimize_decision_scope', // Optimize decision scope
          '@adobe_assurance_url' // Assurance session URL
        ];
        
        for (const key of knownKeys) {
          try {
            await AsyncStorage.removeItem(key);
            console.log(`Cleared known AsyncStorage key: ${key}`);
          } catch (error) {
            console.log(`Failed to clear key ${key}:`, error);
          }
        }
        
        // Clear any other Adobe-related AsyncStorage keys
        const allKeys = await AsyncStorage.getAllKeys();
        const adobeKeys = allKeys.filter(key => 
          key.toLowerCase().includes('adobe') ||
          key.toLowerCase().includes('optimize') ||
          key.toLowerCase().includes('target') ||
          key.toLowerCase().includes('assurance') ||
          key.toLowerCase().includes('edge') ||
          key.toLowerCase().includes('consent') ||
          key.toLowerCase().includes('profile')
        );
        
        for (const key of adobeKeys) {
          await AsyncStorage.removeItem(key);
          console.log(`Cleared Adobe-related key: ${key}`);
        }
        
      } catch (sdkError) {
        console.error('Error clearing Adobe SDK caches:', sdkError);
      }
      
      Alert.alert('Success', 'App ID and all Adobe caches cleared. Restart the app for best results.');
      console.log('Comprehensive App ID clearing completed successfully');
      
    } catch (error) {
      console.error('Error clearing App ID:', error);
      Alert.alert('Error', 'Failed to clear App ID');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={{ marginTop: 75, paddingBottom: 100 }}>
        <Button onPress={() => router.back()} title="Go to main page" />
        <ThemedText style={styles.welcome}>Adobe App ID Configuration</ThemedText>
        <ThemedText style={styles.text}>Enter your Adobe Launch App ID:</ThemedText>
        <TextInput
          style={{
            height: 40,
            borderColor: theme.colors.border,
            borderWidth: 1,
            margin: 10,
            padding: 10,
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
          }}
          value={appId}
          onChangeText={setAppId}
          placeholder="Enter App ID"
        />
        <Button title="Save App ID" onPress={saveAppId} />
        <View style={{ marginTop: 10 }} />
        <Button title="Clear App ID" onPress={clearAppId} />
        <ThemedText style={styles.text}>
          Current App ID: {appId || 'Not configured'}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
};

export default AppIdConfigView; 