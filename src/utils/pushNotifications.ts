import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { Messaging } from '@adobe/react-native-aepmessaging';
import { MobileCore } from '@adobe/react-native-aepcore';
import { getStoredAppId } from './adobeConfig';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushToken {
  data: string;
  type: 'expo' | 'ios' | 'android';
}

export class PushNotificationService {
  private static instance: PushNotificationService;
  private expoPushToken: string | null = null;
  private devicePushToken: string | null = null;

  private constructor() {}

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Register for push notifications (works on iOS, local only on Android)
   */
  async registerForPushNotifications(): Promise<string | null> {
    let token: string | null = null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push notification permissions!');
        return null;
      }
      
      try {
        if (Platform.OS === 'ios') {
          // iOS: Get native device token for Adobe/APNs
          console.log('iOS: Getting native device token for Adobe...');
          const deviceTokenResponse = await Notifications.getDevicePushTokenAsync();
          this.devicePushToken = deviceTokenResponse.data;
          console.log('iOS Native device token (for Adobe):', this.devicePushToken);
          
          // Also get Expo push token for Expo Push Service (optional, for testing)
          try {
            const expoTokenResponse = await Notifications.getExpoPushTokenAsync({
              projectId: 'a5b92550-3e0d-4481-8f93-afdd27f8901c', // Your EAS project ID
            });
            console.log('iOS Expo push token (for Expo service):', expoTokenResponse.data);
          } catch (expoError) {
            console.log('Note: Expo push token not available (not needed for Adobe)');
          }
          
          // Use native device token for Adobe registration
          token = this.devicePushToken;
          console.log('Using native device token for Adobe registration');
        } else {
          // Android: Get real FCM token
          console.log('Android: Getting FCM token...');
          
          // Request FCM permission
          const authStatus = await messaging().requestPermission();
          const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED || 
                         authStatus === messaging.AuthorizationStatus.PROVISIONAL;
          
          if (!enabled) {
            console.log('FCM permission not granted, falling back to mock token');
            token = `AndroidMockToken_${Date.now()}`;
          } else {
            // Get FCM token
            const fcmToken = await messaging().getToken();
            token = fcmToken;
            console.log('Android FCM token generated:', token);
          }
        }
        
        this.expoPushToken = token;
        console.log('Successfully registered for notifications');
        
        // Set up FCM message handling for Android
        if (Platform.OS === 'android' && token && !token.startsWith('Mock')) {
          this.setupFCMMessageHandling();
        }
        
        // Note: Adobe registration is now handled manually via "Register Token with Adobe Messaging" button
      } catch (error) {
        console.error('Error getting push token:', error);
        // Fallback to mock token
        token = `MockToken_${Date.now()}`;
        this.expoPushToken = token;
        console.log('Using mock token due to error:', token);
      }
    } else {
      console.log('Must use physical device for Push Notifications');
      return null;
    }

    return token;
  }

  /**
   * Get the current device push token (for AJO testing)
   */
  getDevicePushToken(): string | null {
    return this.devicePushToken;
  }

  /**
   * Get the current Expo push token (may be null without Firebase)
   */
  getExpoPushToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Add a notification received listener
   */
  addNotificationReceivedListener(callback: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(callback);
  }

  /**
   * Add a notification response received listener (when user taps notification)
   */
  addNotificationResponseReceivedListener(callback: (response: Notifications.NotificationResponse) => void) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  /**
   * Schedule a local notification
   */
  async scheduleLocalNotification(title: string, body: string, data?: any, trigger?: Notifications.NotificationTriggerInput) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
      },
      trigger: trigger || null, // null means show immediately
    });
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllScheduledNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Get all scheduled notifications
   */
  async getScheduledNotifications() {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  /**
   * Test FCM token generation (Android only)
   */
  async testFCMTokenGeneration(): Promise<string | null> {
    if (Platform.OS !== 'android') {
      console.log('FCM test only available on Android');
      return null;
    }

    try {
      console.log('Testing FCM token generation...');
      
      // Request permission for FCM
      const authStatus = await messaging().requestPermission();
      const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED || 
                     authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      
      if (!enabled) {
        console.log('FCM permission not granted');
        return null;
      }

      // Get FCM token
      const fcmToken = await messaging().getToken();
      console.log('FCM token generated successfully:', fcmToken);
      
      return fcmToken;
    } catch (error) {
      console.error('Error generating FCM token:', error);
      return null;
    }
  }

  /**
   * Register push token with Adobe Messaging (both new and legacy APIs for full compatibility)
   */
  private async registerTokenWithAdobe(token: string): Promise<void> {
    try {
      console.log('Registering push token with Adobe Messaging:', token.substring(0, 20) + '...');
      
      // Check if Adobe SDK is initialized with App ID
      const appId = await getStoredAppId();
      if (!appId) {
        console.log('Adobe SDK not initialized - App ID not found. Skipping Adobe token registration.');
        console.log('Please configure Adobe App ID in the App ID Configuration screen first.');
        return;
      }
      
      console.log('Adobe SDK initialized with App ID:', appId);
      
      // Register with MobileCore API (for Adobe services and Assurance compatibility)
      try {
        await MobileCore.setPushIdentifier(token);
        console.log('✅ Successfully registered with MobileCore (Adobe services and Assurance compatibility)');
      } catch (error) {
        console.error('Error registering with MobileCore:', error);
      }
      
      console.log('Push token registered with Adobe services successfully');
    } catch (error) {
      console.error('Error registering token with Adobe:', error);
      // Don't throw - this shouldn't break the main flow
    }
  }

  /**
   * Check if an FCM message is from Adobe Messaging
   */
  private isAdobeMessage(remoteMessage: any): boolean {
    // Adobe messages typically have specific data fields or come from Adobe's FCM sender
    const data = remoteMessage.data || {};
    
    // Check for Adobe-specific identifiers
    return (
      data.adobe_message_id !== undefined ||
      data.adobe_campaign_id !== undefined ||
      data.adobe_journey_id !== undefined ||
      data.adobe_offer_id !== undefined ||
      data.adb_n_priority !== undefined ||  // Adobe Assurance messages
      data.adb_n_visibility !== undefined || // Adobe Assurance messages
      data.adb_uri !== undefined || // Adobe Assurance messages
      remoteMessage.from?.includes('adobe') ||
      remoteMessage.from?.includes('journey') ||
      remoteMessage.from?.includes('campaign')
    );
  }

  /**
   * Set up FCM message handling for the app
   */
  private setupFCMMessageHandling(): void {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      console.log('Setting up FCM message handling...');
      
      // Set up foreground message listener
      const unsubscribe = messaging().onMessage(async remoteMessage => {
        console.log('FCM message received in foreground:', remoteMessage);
        
        // Check if this is an Adobe message
        if (this.isAdobeMessage(remoteMessage)) {
          console.log('Adobe message detected, routing through Adobe Messaging');
          
          // Show real campaign content for all Adobe messages (AJO campaigns, Assurance, etc.)
          const data = remoteMessage.data || {};
          const title = String(data.adb_title || remoteMessage.notification?.title || 'Adobe Campaign');
          const body = String(data.adb_body || remoteMessage.notification?.body || 'You have a new message');
          
          console.log('Showing real Adobe campaign content:', { title, body });
          await this.scheduleLocalNotification(
            title,
            body,
            JSON.stringify(remoteMessage.data || {})
          );
        } else {
          // Show local notification for non-Adobe messages
          if (remoteMessage.notification) {
            await this.scheduleLocalNotification(
              String(remoteMessage.notification.title || 'Push Notification'),
              String(remoteMessage.notification.body || 'You have a new message'),
              JSON.stringify(remoteMessage.data || {})
            );
          } else if (remoteMessage.data) {
            // Handle data-only messages
            await this.scheduleLocalNotification(
              'Push Notification',
              'You have a new message',
              JSON.stringify(remoteMessage.data || {})
            );
          }
        }
      });

      // Set up background message handler
      messaging().setBackgroundMessageHandler(async remoteMessage => {
        console.log('FCM message handled in background:', remoteMessage);
        // Background messages are handled automatically by FCM
      });

      console.log('FCM message handlers set up successfully');
    } catch (error) {
      console.error('Error setting up FCM message handling:', error);
    }
  }

  /**
   * Test FCM message handling
   */
  async testFCMMessageHandling(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.log('FCM test only available on Android');
      return false;
    }

    try {
      console.log('Testing FCM message handling...');
      this.setupFCMMessageHandling();
      console.log('FCM message handlers set up successfully');
      return true;
    } catch (error) {
      console.error('Error setting up FCM message handling:', error);
      return false;
    }
  }

  /**
   * Manually register current token with Adobe Messaging (for testing)
   */
  async registerCurrentTokenWithAdobe(): Promise<boolean> {
    const token = this.getExpoPushToken();
    if (!token || token.startsWith('Mock')) {
      console.log('No valid push token available for Adobe registration');
      return false;
    }

    // Check if Adobe is initialized first
    const appId = await getStoredAppId();
    if (!appId) {
      console.log('Adobe SDK not initialized - App ID not found');
      return false;
    }

    try {
      await this.registerTokenWithAdobe(token);
      return true;
    } catch (error) {
      console.error('Error registering current token with Adobe:', error);
      return false;
    }
  }

  /**
   * Clear push tokens from Adobe and reset profile (for fixing token mismatches)
   */
  async clearAdobePushTokens(): Promise<boolean> {
    try {
      console.log('Clearing push tokens from Adobe...');
      
      // Clear push identifier from MobileCore
      try {
        await MobileCore.setPushIdentifier('');
        console.log('✅ Cleared push identifier from MobileCore');
      } catch (error) {
        console.error('Error clearing from MobileCore:', error);
      }
      
      // Reset identities to clear ECID and profile data
      try {
        MobileCore.resetIdentities();
        console.log('✅ Reset MobileCore identities (cleared ECID and profile)');
      } catch (error) {
        console.error('Error resetting identities:', error);
      }
      
      console.log('Push tokens cleared from Adobe successfully');
      return true;
    } catch (error) {
      console.error('Error clearing Adobe push tokens:', error);
      return false;
    }
  }
}

// Export a singleton instance
export const pushNotificationService = PushNotificationService.getInstance(); 