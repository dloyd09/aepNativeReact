/*
Copyright 2024 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import React, { useState, useEffect } from 'react';
import { Button, ScrollView, Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { TechnicalScreen } from '../../components/TechnicalScreen';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '@react-navigation/native';
import { pushNotificationService, isMockToken } from '../../src/utils/pushNotifications';
import styles from '../../styles/styles';

const TEST_PUSH_PAYLOAD = {
  adb_title: 'Push Capability Test',
  adb_body: 'Local notification triggered from the technical push screen.',
  adb_uri: 'myapp://(consumerTabs)/profile',
  source: 'technical-push-test',
  // Origin marker read by the tap handler in app/_layout.tsx. A local-test push
  // intentionally carries NO real _xdm, so the handler walls it off from Edge:
  // it deep-links and logs, but never sends a pushTracking event to Adobe.
  // (`source` is kept for backward compatibility; `_origin` is the standardized seam.)
  _origin: 'local-test',
  templateData: {
    firstName: 'Test User',
    campaign: 'local-push-validation',
  },
};

function PushNotificationView() {
  const router = useRouter();
  const [log, setLog] = useState('');
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const theme = useTheme();

  useEffect(() => {
    const loadCurrentState = async () => {
      const permissions = await Notifications.getPermissionsAsync();
      setPermissionStatus(permissions.status);
      setPushToken(pushNotificationService.getExpoPushToken());
    };

    loadCurrentState();

    // Set up notification listeners when component mounts
    const notificationListener = pushNotificationService.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      setLog(prev => prev + '\nNotification received: ' + JSON.stringify(notification.request.content));
    });

    const responseListener = pushNotificationService.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      setLog(prev => prev + '\nNotification tapped: ' + JSON.stringify(response.notification.request.content));
    });

    // Cleanup listeners when component unmounts
    return () => {
      notificationListener?.remove();
      responseListener?.remove();
    };
  }, []);

  const registerForNotifications = async () => {
    try {
      const token = await pushNotificationService.registerForPushNotifications();
      const permissions = await Notifications.getPermissionsAsync();
      setPermissionStatus(permissions.status);
      if (token) {
        setPushToken(token);
        setLog(prev => prev + '\nSuccessfully registered for push notifications and triggered Adobe auto-sync');
        Alert.alert('Success', 'Registered for push notifications. Adobe token sync runs automatically.');
      } else {
        // No token is returned on a simulator/emulator, when notification
        // permission is denied, or when FCM is unavailable. The app no longer
        // fabricates a placeholder — surface the real reason instead of implying success.
        const reason = !Device.isDevice
          ? 'Push notifications require a physical device — not available on a simulator/emulator.'
          : permissions.status !== 'granted'
            ? 'Notification permission was not granted. Enable notifications in system settings and try again.'
            : 'Could not obtain a push token. On Android, confirm the build includes Firebase (not Expo Go).';
        setLog(prev => prev + '\nPush unavailable: ' + reason);
        Alert.alert('Push Unavailable', reason);
      }
    } catch (error) {
      console.error('Error registering for notifications:', error);
      setLog(prev => prev + '\nError: ' + error);
    }
  };

  const getCurrentToken = () => {
    const token = pushNotificationService.getExpoPushToken();
    if (token) {
      setLog(prev => prev + '\nCurrent push token: ' + token);
      Alert.alert('Push Token', token);
    } else {
      setLog(prev => prev + '\nNo push token available');
      Alert.alert('No Token', 'No push token available. Register for notifications first.');
    }
  };

  const clearAdobePushTokens = async () => {
    try {
      const success = await pushNotificationService.clearAdobePushTokens();
      if (success) {
        setLog(prev => prev + '\nAdobe push tokens cleared successfully');
        Alert.alert(
          'Success', 
          'Adobe push tokens cleared! This will fix token mismatch issues. Restart the app and reconfigure everything for best results.'
        );
      } else {
        setLog(prev => prev + '\nFailed to clear Adobe push tokens');
        Alert.alert('Error', 'Failed to clear Adobe push tokens');
      }
    } catch (error) {
      console.error('Error clearing Adobe push tokens:', error);
      setLog(prev => prev + '\nError clearing Adobe push tokens: ' + error);
    }
  };

  const triggerLocalPushTest = async () => {
    try {
      await pushNotificationService.scheduleLocalNotification(
        TEST_PUSH_PAYLOAD.adb_title,
        TEST_PUSH_PAYLOAD.adb_body,
        TEST_PUSH_PAYLOAD
      );

      setLog(prev => prev + '\nTriggered local push test with payload: ' + JSON.stringify(TEST_PUSH_PAYLOAD));
      Alert.alert(
        'Test Push Sent',
        'A local test notification was scheduled immediately. This validates app-side push handling and deep-link parsing.'
      );
    } catch (error) {
      console.error('Error triggering local push test:', error);
      setLog(prev => prev + '\nError triggering local push test: ' + error);
      Alert.alert('Error', 'Failed to trigger local push test notification.');
    }
  };


  return (
    <TechnicalScreen onBack={router.back}>
        <ThemedText style={styles.welcome}>Push Notifications</ThemedText>
        <ThemedText style={{ marginTop: 8, color: theme.colors.text, fontSize: 13, textAlign: 'center' }}>
          Push token registration now auto-syncs to Adobe after permission grant and app startup.
        </ThemedText>

        <ThemedText style={{ marginTop: 20, color: theme.colors.text, fontSize: 16, fontWeight: 'bold' }}>
          Current Status
        </ThemedText>
        <ThemedText style={{ marginTop: 6, color: theme.colors.text, fontSize: 14 }}>
          Permission: {permissionStatus}
        </ThemedText>
        <ThemedText style={{ marginTop: 4, color: theme.colors.text, fontSize: 14 }}>
          Token Type: {Platform.OS === 'ios' ? 'APNs Device Token' : 'FCM Token'}
        </ThemedText>
        
        <ThemedText style={{ marginTop: 16, color: theme.colors.text, fontSize: 16, fontWeight: 'bold' }}>
          {Platform.OS === 'ios' ? 'Push Notification Setup (iOS)' : 'Push Notification Setup (Android)'}
        </ThemedText>
        <Button title={Platform.OS === 'ios' ? 'Request Push Permission / Token' : 'Request FCM Permission / Token'} onPress={registerForNotifications} />
        <Button title={Platform.OS === 'ios' ? 'Show Current APNs Token' : 'Show Current FCM Token'} onPress={getCurrentToken} />

        <ThemedText style={{ marginTop: 24, color: theme.colors.text, fontSize: 16, fontWeight: 'bold' }}>
          Local Push Test
        </ThemedText>
        <ThemedText style={{ marginTop: 8, color: theme.colors.text, fontSize: 12, fontStyle: 'italic' }}>
          Sends a local notification with a basic Adobe-style JSON payload so you can verify display, tap handling, and deep linking from the device itself.
        </ThemedText>
        <Button title="Trigger Local Test Push" onPress={triggerLocalPushTest} />
        
        <ThemedText style={{ marginTop: 24, color: theme.colors.text, fontSize: 16, fontWeight: 'bold' }}>
          Recovery
        </ThemedText>
        <ThemedText style={{ marginTop: 8, color: theme.colors.text, fontSize: 12, fontStyle: 'italic' }}>
          Use recovery only when you need to clear the token/profile association in Adobe.
        </ThemedText>
        <Button title="Clear Adobe Push Tokens (Fix Mismatch)" onPress={clearAdobePushTokens} color="#ff6b6b" />
        
        {pushToken && (
          <ThemedText style={{ marginTop: 16, color: theme.colors.text, fontSize: 14, textAlign: 'center' }}>
            {Platform.OS === 'ios' ? 'APNs Device Token' : 'FCM Token'}: {pushToken.substring(0, 20)}...
            {Platform.OS === 'android' && (
              <ThemedText style={{ color: isMockToken(pushToken) ? '#ff6b6b' : '#51cf66', fontSize: 12 }}>
                {'\n'}({isMockToken(pushToken) ? 'Mock Token' : 'Real FCM Token'})
              </ThemedText>
            )}
          </ThemedText>
        )}
        
        {log ? (
          <ThemedText style={{ marginTop: 24, color: theme.colors.text, fontSize: 12, textAlign: 'left' }}>
            {log}
          </ThemedText>
        ) : null}
    </TechnicalScreen>
  );
}

export default PushNotificationView; 
