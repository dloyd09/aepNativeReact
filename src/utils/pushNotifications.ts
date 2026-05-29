import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { MobileCore } from '@adobe/react-native-aepcore';
import { Identity } from '@adobe/react-native-aepedgeidentity';
import { Edge } from '@adobe/react-native-aepedge';
import { getStoredAppId } from './adobeConfig';
import { buildPushRegistrationEvent } from './xdmEventBuilders';

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

/**
 * Safety net for placeholder tokens. The app no longer fabricates mock tokens
 * (registerForPushNotifications returns null when no real token is available),
 * but this guard remains to defend against any legacy value that might still be
 * cached or stored — a placeholder must NEVER reach setPushIdentifier, where it
 * would write a junk token onto the AJO push profile and bounce every send.
 *
 * Covers both historical prefixes: iOS 'MockToken_…' and Android
 * 'AndroidMockToken_…'. Use this instead of token.startsWith('Mock') —
 * 'AndroidMockToken_' does NOT start with 'Mock', so the bare check silently
 * lets Android mocks through. Single source of truth — also used by the tech screens.
 */
export const isMockToken = (token: string): boolean =>
  token.startsWith('MockToken_') || token.startsWith('AndroidMockToken_');

export class PushNotificationService {
  private static instance: PushNotificationService;
  private expoPushToken: string | null = null;
  private devicePushToken: string | null = null;
  private fcmMessageHandlingInitialized = false;
  private fcmTokenRefreshListenerInitialized = false;
  // APNs token refresh subscription (iOS only). Stored so it can be removed in cleanup()
  // and not leak when the service is re-initialized after an instructor reset.
  private apnsTokenRefreshSubscription: Notifications.Subscription | null = null;

  private constructor() {}

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  private getFirebaseMessagingModule(): any | null {
    if (Platform.OS !== 'android') {
      return null;
    }

    try {
      return require('@react-native-firebase/messaging').default;
    } catch (error) {
      console.error('Failed to load Firebase Messaging module:', error);
      return null;
    }
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
          const firebaseMessaging = this.getFirebaseMessagingModule();

          if (!firebaseMessaging) {
            console.log('Firebase Messaging module unavailable on Android — cannot obtain an FCM token. ' +
              'Push requires a dev/production build with Firebase configured (not Expo Go).');
            this.expoPushToken = null;
            return null;
          }

          // Request FCM permission
          const authStatus = await firebaseMessaging().requestPermission();
          const enabled = authStatus === firebaseMessaging.AuthorizationStatus.AUTHORIZED ||
                         authStatus === firebaseMessaging.AuthorizationStatus.PROVISIONAL;

          if (!enabled) {
            console.log('FCM permission not granted — no push token will be obtained.');
            this.expoPushToken = null;
            return null;
          }

          // Get FCM token
          const fcmToken = await firebaseMessaging().getToken();
          token = fcmToken;
          console.log('Android FCM token generated:', token);
        }
        
        this.expoPushToken = token;

        // item 4.1: log token acquisition with platform label, truncated value, and timestamp
        if (token) {
          const tokenTs = new Date().toISOString();
          const tokenTruncated = token.length > 16
            ? `${token.substring(0, 8)}…${token.substring(token.length - 8)}`
            : token;
          const tokenPlatform = Platform.OS === 'ios' ? 'iOS/APNs' : 'Android/FCM';
          console.log(`[Push][4.1] Token acquired — platform: ${tokenPlatform}, value: ${tokenTruncated}, ts: ${tokenTs}`);
        }

        console.log('Successfully registered for notifications');
        
        // Set up FCM message handling for Android
        if (Platform.OS === 'android' && token && !isMockToken(token)) {
          this.setupFCMMessageHandling();
          this.setupFCMTokenRefreshHandling();
        }

        if (token && !isMockToken(token)) {
          await this.tryAutoRegisterTokenWithAdobe(token);
        }
      } catch (error) {
        // No fabricated fallback: a placeholder token only pollutes the AJO push
        // profile and falsely signals "registered" on a simulator. Surface the
        // failure honestly and leave the token unset.
        console.error('Error getting push token — no token will be registered:', error);
        this.expoPushToken = null;
        return null;
      }
    } else {
      console.log('Must use physical device for Push Notifications');
      return null;
    }

    return token;
  }

  /**
   * Remove all active push listeners. Call at the start of initialize() to prevent
   * duplicate listeners when the service is re-initialized (e.g. after instructor reset).
   * Also called from clearAdobePushTokens() to ensure a full clean state.
   */
  cleanup(): void {
    if (this.apnsTokenRefreshSubscription) {
      this.apnsTokenRefreshSubscription.remove();
      this.apnsTokenRefreshSubscription = null;
      console.log('[Push] APNs token refresh listener removed.');
    }
  }

  /**
   * Initialize push handling after Adobe SDK startup.
   * If permission already exists, sync the current platform token back to Adobe.
   */
  async initialize(): Promise<void> {
    try {
      // Remove existing listeners before attaching new ones — prevents duplicate listeners
      // if initialize() is called again (e.g. after configureAdobe re-runs on App ID change).
      this.cleanup();

      const appId = await getStoredAppId();
      if (!appId) {
        console.log('PushNotificationService.initialize(): Adobe App ID not configured; skipping token sync.');
        return;
      }

      if (Platform.OS === 'android') {
        this.setupFCMTokenRefreshHandling();
      }

      if (!Device.isDevice) {
        console.log('PushNotificationService.initialize(): push token sync requires a physical device.');
        return;
      }

      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        console.log('PushNotificationService.initialize(): notification permission not granted; skipping token sync.');
        return;
      }

      // iOS: listen for APNs token rotation and re-register the new token with Adobe.
      // Android token rotation is handled by FCM onTokenRefresh (setupFCMTokenRefreshHandling).
      // Without this listener, a rotated APNs token is never updated in Adobe and
      // subsequent AJO journey sends to that device bounce silently.
      if (Platform.OS === 'ios') {
        this.apnsTokenRefreshSubscription = Notifications.addPushTokenListener(
          async (tokenData) => {
            const newToken = tokenData.data;
            console.log('[Push] APNs token rotated — attempting re-registration with Adobe');
            if (newToken && !isMockToken(newToken)) {
              this.devicePushToken = newToken;
              this.expoPushToken = newToken;
              // registerTokenWithAdobe polls for ECID inline (up to ~10s) before
              // calling setPushIdentifier — no deferred-state machinery needed.
              await this.registerTokenWithAdobe(newToken);
            }
          }
        );
        console.log('[Push] APNs token refresh listener registered (iOS).');
      }

      const currentToken = await this.getCurrentPlatformToken();
      if (!currentToken || isMockToken(currentToken)) {
        console.log('PushNotificationService.initialize(): no valid platform push token available.');
        return;
      }

      await this.registerTokenWithAdobe(currentToken);
      console.log('PushNotificationService.initialize(): current push token synced to Adobe.');
    } catch (error) {
      console.error('PushNotificationService.initialize(): failed to sync push token with Adobe:', error);
    }
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
    console.log('📝 Scheduling local notification with data:', data);
    console.log('📝 Data type:', typeof data);
    console.log('📝 Data stringified:', JSON.stringify(data));
    
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
      const firebaseMessaging = this.getFirebaseMessagingModule();

      if (!firebaseMessaging) {
        console.log('Firebase Messaging module unavailable');
        return null;
      }
      
      // Request permission for FCM
      const authStatus = await firebaseMessaging().requestPermission();
      const enabled = authStatus === firebaseMessaging.AuthorizationStatus.AUTHORIZED || 
                     authStatus === firebaseMessaging.AuthorizationStatus.PROVISIONAL;
      
      if (!enabled) {
        console.log('FCM permission not granted');
        return null;
      }

      // Get FCM token
      const fcmToken = await firebaseMessaging().getToken();
      console.log('FCM token generated successfully:', fcmToken);
      
      return fcmToken;
    } catch (error) {
      console.error('Error generating FCM token:', error);
      return null;
    }
  }

  /**
   * Register push token with Adobe Messaging.
   *
   * Polls for ECID inline (up to ~10s) instead of deferring with external retry.
   * The previous defer-and-retry pattern silently failed for prospect users who
   * never logged in, leaving the AJO Push Profile Dataset empty for ~80% of
   * targeted profiles. No AsyncStorage state is kept across this call.
   *
   * On success this fires TWO events:
   *   1) MobileCore.setPushIdentifier — OOTB AJO push profile sync (populates
   *      the AJO Push Profile Dataset, but carries only identityMap.ECID).
   *   2) buildPushRegistrationEvent — custom XDM event that carries the
   *      _adobecmteas.identities.ecid primary identity descriptor required by
   *      the davidMobileInteractions schema. Without this companion event the
   *      registration is invisible to tenant-scoped journey qualification.
   */
  private async registerTokenWithAdobe(token: string): Promise<void> {
    try {
      console.log('Registering push token with Adobe Messaging:', token.substring(0, 20) + '...');

      const appId = await getStoredAppId();
      if (!appId) {
        console.log('Adobe SDK not initialized - App ID not found. Skipping Adobe token registration.');
        console.log('Please configure Adobe App ID in the App ID Configuration screen first.');
        return;
      }
      console.log('[Push] Adobe SDK initialized with App ID:', appId);

      // Bounded ECID poll — Identity.getExperienceCloudId resolves only after the
      // Edge Identity extension completes its first hydrate, which can lag SDK
      // init by several seconds on cold start. 20 × 500ms = 10s upper bound.
      const POLL_INTERVAL_MS = 500;
      const POLL_MAX_ATTEMPTS = 20;
      let ecid: string | null | undefined = null;
      for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt++) {
        try {
          ecid = await Identity.getExperienceCloudId();
        } catch {
          ecid = null;
        }
        if (ecid) {
          console.log(`[Push] ECID resolved after ${attempt} attempt(s) — proceeding with registration`);
          break;
        }
        if (attempt < POLL_MAX_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      }

      if (!ecid) {
        console.error('[Push] ECID did not resolve within timeout — push registration aborted. ' +
          'This profile will not be reachable by AJO. Verify Adobe SDK config, Edge datastream, and network.');
        return;
      }

      // 1) OOTB AJO push profile sync — required for AJO push delivery and Assurance visibility.
      try {
        await MobileCore.setPushIdentifier(token);
        console.log('✅ Push token registered via MobileCore.setPushIdentifier');
      } catch (error) {
        console.error('[Push] MobileCore.setPushIdentifier failed:', error);
      }

      // 2) Custom XDM registration event — carries _adobecmteas.identities.ecid
      // (schema primary identity descriptor). OOTB setPushIdentifier omits it.
      try {
        const rawIdentityResult: any = await Identity.getIdentities();
        const identityMap = rawIdentityResult?.identityMap ?? rawIdentityResult ?? {};
        const registrationEvent = await buildPushRegistrationEvent({
          identityMap,
          pushProvider: Platform.OS === 'ios' ? 'apns' : 'fcm',
          pushToken: token,
        });
        await Edge.sendEvent(registrationEvent);
        console.log('✅ Push registration XDM event sent to Edge (with tenant ECID)');
      } catch (xdmError) {
        console.error('[Push] Push registration XDM event failed:', xdmError);
      }
    } catch (error) {
      console.error('Error registering token with Adobe:', error);
    }
  }

  private async tryAutoRegisterTokenWithAdobe(token: string): Promise<void> {
    try {
      const appId = await getStoredAppId();
      if (!appId) {
        console.log('Adobe App ID not configured yet; skipping automatic token registration.');
        return;
      }

      await this.registerTokenWithAdobe(token);
      console.log('Push token automatically registered with Adobe.');
    } catch (error) {
      console.error('Automatic Adobe token registration failed:', error);
    }
  }

  private async getCurrentPlatformToken(): Promise<string | null> {
    if (Platform.OS === 'ios') {
      const deviceTokenResponse = await Notifications.getDevicePushTokenAsync();
      this.devicePushToken = deviceTokenResponse.data;
      this.expoPushToken = this.devicePushToken;
      return this.devicePushToken;
    }

    const firebaseMessaging = this.getFirebaseMessagingModule();
    if (!firebaseMessaging) {
      return null;
    }

    const fcmToken = await firebaseMessaging().getToken();
    this.expoPushToken = fcmToken;
    this.setupFCMMessageHandling();
    return fcmToken;
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

    if (this.fcmMessageHandlingInitialized) {
      return;
    }

    try {
      console.log('Setting up FCM message handling...');
      const firebaseMessaging = this.getFirebaseMessagingModule();
      if (!firebaseMessaging) {
        console.log('Firebase Messaging module unavailable; skipping FCM message handling setup.');
        return;
      }

      // Set up foreground message listener
      firebaseMessaging().onMessage(async (remoteMessage: any) => {
        console.log('FCM message received in foreground:', remoteMessage);
        
        // Check if this is an Adobe message
        if (this.isAdobeMessage(remoteMessage)) {
          console.log('Adobe message detected, routing through Adobe Messaging');
          
          // Show real campaign content for all Adobe messages (AJO campaigns, Assurance, etc.)
          const data = remoteMessage.data || {};
          const title = String(data.adb_title || remoteMessage.notification?.title || 'Adobe Campaign');
          const body = String(data.adb_body || remoteMessage.notification?.body || 'You have a new message');
          
          console.log('Showing real Adobe campaign content:', { title, body });
          // Stamp _origin so the tap handler in _layout.tsx can tell a real AJO
          // foreground mirror apart from a local-test push and route it to Edge
          // tracking. The real _xdm/correlationID rides along in remoteMessage.data.
          await this.scheduleLocalNotification(
            title,
            body,
            { ...(remoteMessage.data || {}), _origin: 'ajo-foreground' }
          );
        } else {
          // Show local notification for non-Adobe messages
          if (remoteMessage.notification) {
            await this.scheduleLocalNotification(
              String(remoteMessage.notification.title || 'Push Notification'),
              String(remoteMessage.notification.body || 'You have a new message'),
              remoteMessage.data || {}
            );
          } else if (remoteMessage.data) {
            // Handle data-only messages
            await this.scheduleLocalNotification(
              'Push Notification',
              'You have a new message',
              remoteMessage.data || {}
            );
          }
        }
      });

      // Set up background message handler.
      //
      // AJO sends data-only FCM messages (no `notification` block), which the
      // default Firebase service will NOT auto-display while the app is backgrounded
      // or killed — so nothing would appear in the tray and there would be nothing
      // to tap. We mirror the push into a local expo notification here so a
      // backgrounded data-only AJO push actually displays AND becomes a tappable
      // expo notification (a tray tap from warm background DOES fire
      // addNotificationResponseReceivedListener in _layout.tsx). The real
      // _xdm/correlationID is carried forward in the data payload, and _origin
      // marks it as an AJO push so the tap handler routes it to Edge tracking.
      firebaseMessaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
        console.log('FCM message handled in background:', remoteMessage);

        // Only mirror Adobe messages — non-Adobe data-only messages are not part
        // of the bootcamp push curriculum and should not fabricate tray entries.
        if (!this.isAdobeMessage(remoteMessage)) {
          return;
        }

        const data = remoteMessage.data || {};
        const title = String(data.adb_title || remoteMessage.notification?.title || 'Adobe Campaign');
        const body = String(data.adb_body || remoteMessage.notification?.body || 'You have a new message');

        try {
          await this.scheduleLocalNotification(
            title,
            body,
            { ...data, _origin: 'ajo-background' }
          );
        } catch (error) {
          console.error('[Push] Failed to mirror background AJO push into a local notification:', error);
        }
      });

      // Mark initialized only after all handlers are successfully registered — not before,
      // so a setup failure leaves the flag false and allows retry on next call.
      this.fcmMessageHandlingInitialized = true;
      console.log('FCM message handlers set up successfully');
    } catch (error) {
      this.fcmMessageHandlingInitialized = false;
      console.error('Error setting up FCM message handling:', error);
    }
  }

  private setupFCMTokenRefreshHandling(): void {
    if (Platform.OS !== 'android' || this.fcmTokenRefreshListenerInitialized) {
      return;
    }

    try {
      console.log('Setting up FCM token refresh handling...');
      const firebaseMessaging = this.getFirebaseMessagingModule();
      if (!firebaseMessaging) {
        console.log('Firebase Messaging module unavailable; skipping FCM token refresh handling.');
        return;
      }

      firebaseMessaging().onTokenRefresh(async (refreshedToken: string) => {
        console.log('FCM token refreshed:', refreshedToken);
        this.expoPushToken = refreshedToken;

        try {
          await this.tryAutoRegisterTokenWithAdobe(refreshedToken);
        } catch (error) {
          console.error('Failed to register refreshed FCM token with Adobe:', error);
        }
      });

      // Mark initialized only after listener is successfully registered — not before,
      // so a setup failure leaves the flag false and allows retry on next call.
      this.fcmTokenRefreshListenerInitialized = true;
      console.log('FCM token refresh handler set up successfully');
    } catch (error) {
      this.fcmTokenRefreshListenerInitialized = false;
      console.error('Error setting up FCM token refresh handling:', error);
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
    if (!token || isMockToken(token)) {
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
      console.log('[Push] Clearing push tokens from Adobe...');

      // Remove active listeners so the next initialize() starts clean.
      this.cleanup();
      
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
