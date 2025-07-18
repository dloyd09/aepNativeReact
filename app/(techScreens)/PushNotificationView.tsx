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
import { Button, View, ScrollView, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '@react-navigation/native';
import { pushNotificationService } from '../../src/utils/pushNotifications';
import styles from '../../styles/styles';

function PushNotificationView() {
  const router = useRouter();
  const [log, setLog] = useState('');
  const [pushToken, setPushToken] = useState<string | null>(null);
  const theme = useTheme();

  useEffect(() => {
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
      if (token) {
        setPushToken(token);
        setLog(prev => prev + '\nSuccessfully registered for push notifications');
        Alert.alert('Success', 'Registered for push notifications!');
      } else {
        setLog(prev => prev + '\nFailed to register for push notifications');
        Alert.alert('Error', 'Failed to register for push notifications');
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

  const sendTestNotification = async () => {
    try {
      await pushNotificationService.scheduleLocalNotification(
        'Test Notification',
        'This is a test notification from your app!',
        { test: true, timestamp: Date.now() }
      );
      setLog(prev => prev + '\nTest notification scheduled');
      Alert.alert('Success', 'Test notification sent!');
    } catch (error) {
      console.error('Error sending test notification:', error);
      setLog(prev => prev + '\nError sending test notification: ' + error);
    }
  };

  const sendDelayedNotification = async () => {
    try {
      await pushNotificationService.scheduleLocalNotification(
        'Delayed Notification',
        'This notification was scheduled 5 seconds ago!',
        { delayed: true, timestamp: Date.now() }
      );
      setLog(prev => prev + '\nDelayed notification scheduled (5 seconds)');
      Alert.alert('Success', 'Delayed notification scheduled for 5 seconds from now!');
    } catch (error) {
      console.error('Error sending delayed notification:', error);
      setLog(prev => prev + '\nError sending delayed notification: ' + error);
    }
  };

  const getScheduledNotifications = async () => {
    try {
      const notifications = await pushNotificationService.getScheduledNotifications();
      setLog(prev => prev + '\nScheduled notifications: ' + notifications.length);
      Alert.alert('Scheduled Notifications', `You have ${notifications.length} scheduled notifications`);
    } catch (error) {
      console.error('Error getting scheduled notifications:', error);
      setLog(prev => prev + '\nError getting scheduled notifications: ' + error);
    }
  };

  const cancelAllNotifications = async () => {
    try {
      await pushNotificationService.cancelAllScheduledNotifications();
      setLog(prev => prev + '\nAll scheduled notifications cancelled');
      Alert.alert('Success', 'All scheduled notifications cancelled!');
    } catch (error) {
      console.error('Error cancelling notifications:', error);
      setLog(prev => prev + '\nError cancelling notifications: ' + error);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={{marginTop: 75}}>
        <Button onPress={router.back} title="Go to main page" />
        <ThemedText style={styles.welcome}>Push Notifications</ThemedText>
        
        <ThemedText style={{ marginTop: 16, color: theme.colors.text, fontSize: 16, fontWeight: 'bold' }}>
          {Platform.OS === 'ios' ? 'Push Notification Setup (iOS)' : 'Local Notification Setup (Android)'}
        </ThemedText>
        <Button title={Platform.OS === 'ios' ? 'Register for Push Notifications' : 'Register for Local Notifications'} onPress={registerForNotifications} />
        <Button title={Platform.OS === 'ios' ? 'Get Push Token' : 'Get Current Token (Mock)'} onPress={getCurrentToken} />
        
        <ThemedText style={{ marginTop: 24, color: theme.colors.text, fontSize: 16, fontWeight: 'bold' }}>
          Test Notifications
        </ThemedText>
        <Button title="Send Test Notification" onPress={sendTestNotification} />
        <Button title="Send Delayed Notification (5s)" onPress={sendDelayedNotification} />
        
        <ThemedText style={{ marginTop: 24, color: theme.colors.text, fontSize: 16, fontWeight: 'bold' }}>
          Notification Management
        </ThemedText>
        <Button title="Get Scheduled Notifications" onPress={getScheduledNotifications} />
        <Button title="Cancel All Notifications" onPress={cancelAllNotifications} />
        
        {pushToken && (
          <ThemedText style={{ marginTop: 16, color: theme.colors.text, fontSize: 14, textAlign: 'center' }}>
            Push Token: {pushToken.substring(0, 20)}...
          </ThemedText>
        )}
        
        {log ? (
          <ThemedText style={{ marginTop: 24, color: theme.colors.text, fontSize: 12, textAlign: 'left' }}>
            {log}
          </ThemedText>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

export default PushNotificationView; 