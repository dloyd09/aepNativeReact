import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { Drawer } from 'expo-router/drawer';
import { useEffect } from 'react';
import { MobileCore, LogLevel } from '@adobe/react-native-aepcore';
import { CartProvider } from '../components/CartContext';
import { ProfileProvider } from '../components/ProfileContext';
import { StartupErrorBoundary } from '../components/StartupErrorBoundary';
import { Image, InteractionManager, Platform } from 'react-native';
import { Edge } from '@adobe/react-native-aepedge';
import { configureAdobe, getStoredAppId } from '../src/utils/adobeConfig';
import { setAdobeReadiness } from '../src/utils/adobeReadiness';
import { pushNotificationService } from '../src/utils/pushNotifications';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import { buildPushTrackingEvent } from '../src/utils/xdmEventBuilders';
import { safeParseJSON } from '../src/utils/safeParseJSON';
import { useColorScheme } from '@/hooks/useColorScheme';

try {
  require('expo-dev-client');
} catch {
  // Optional in builds without expo-dev-client installed.
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const STARTUP_ENABLE_ADOBE = process.env.EXPO_PUBLIC_ENABLE_ADOBE_STARTUP !== '0';
const STARTUP_ENABLE_PUSH = process.env.EXPO_PUBLIC_ENABLE_PUSH_STARTUP !== '0';

function logStartup(step: string, details?: unknown) {
  if (details === undefined) {
    console.log(`[startup] ${step}`);
    return;
  }

  console.log(`[startup] ${step}`, details);
}

// Distinctive, greppable prefix for the push-tap decision trail. Cold-start taps
// log during the startup avalanche where individual lines are easy to miss —
// filter Metro by "PUSH-TAP" to see exactly which branch a tap took (local-test
// suppressed vs. AJO tracking sent). This is the line a bootcamp learner reads.
function logTap(step: string, details?: unknown) {
  if (details === undefined) {
    console.log(`[PUSH-TAP] ${step}`);
    return;
  }

  console.log(`[PUSH-TAP] ${step}`, details);
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const navigationTheme = isDark ? DarkTheme : DefaultTheme;

  useEffect(() => {
    logStartup('RootLayout.useEffect entered', {
      enableAdobeStartup: STARTUP_ENABLE_ADOBE,
      enablePushStartup: STARTUP_ENABLE_PUSH,
      executionEnvironment: Constants.executionEnvironment,
    });

    logStartup('App version snapshot', {
      version: Constants.expoConfig?.version,
      manifestVersion: (Constants.manifest as any)?.version,
      manifest2Version: Constants.manifest2?.extra?.expoClient?.version,
      appName: Constants.expoConfig?.name,
      iosBundleIdentifier: Constants.expoConfig?.ios?.bundleIdentifier,
      androidPackage: Constants.expoConfig?.android?.package,
    });

    const initAdobe = async () => {
      try {
        logStartup('Adobe init started');
        const appId = await getStoredAppId();
        logStartup('Adobe App ID lookup completed', { hasStoredAppId: Boolean(appId) });

        if (!appId) {
          logStartup('No App ID found, Adobe SDK not initialized');
          setAdobeReadiness('idle');
          return;
        }

        logStartup('Setting Adobe log level to VERBOSE');
        MobileCore.setLogLevel(LogLevel.VERBOSE);

        logStartup('Calling configureAdobe');
        await configureAdobe(appId);
        logStartup('configureAdobe completed');

        if (STARTUP_ENABLE_PUSH) {
          logStartup('Calling pushNotificationService.initialize');
          await pushNotificationService.initialize();
          logStartup('pushNotificationService.initialize completed');
        } else {
          logStartup('Push startup disabled by EXPO_PUBLIC_ENABLE_PUSH_STARTUP');
        }

        logStartup('Adobe SDK startup completed successfully');
      } catch (error) {
        console.error('[startup] Failed to initialize Adobe SDK:', error);
      }
    };

    if (STARTUP_ENABLE_ADOBE) {
      void initAdobe();
    } else {
      logStartup('Adobe startup disabled by EXPO_PUBLIC_ENABLE_ADOBE_STARTUP');
    }

    logStartup('Calling SplashScreen.hideAsync');
    SplashScreen.hideAsync()
      .then(() => {
        logStartup('SplashScreen.hideAsync completed');
      })
      .catch((error) => {
        console.error('[startup] SplashScreen.hideAsync failed:', error);
      });

    // Tracks notification identifiers already processed this session so a single
    // tap can't be double-counted. A cold-start launch tap is delivered by
    // getLastNotificationResponseAsync AND (on some OS/expo versions) re-delivered
    // to the live listener; this Set makes the tap-tracking idempotent.
    const handledTapIds = new Set<string>();

    /**
     * Single source of truth for what a push tap MEANS, reused by both the live
     * response listener and the cold-start catch. Two intents, one primitive:
     *
     *  - Real AJO push  → carries a real `_xdm` (or a real AJO messageID) →
     *                     extract correlationID + messageID → send pushTracking to Edge.
     *  - Local-test push → no real `_xdm` → deep-link + log only, NEVER touch Edge.
     *
     * Gating Edge tracking on a real `_xdm`/messageID is what walls the test crutch
     * off from Adobe and stops the fabricated bare-UUID `applicationOpened` events
     * that used to pollute Assurance. Deep-link navigation runs for BOTH paths.
     */
    const handlePushTap = async (
      response: Notifications.NotificationResponse,
      trigger: 'listener' | 'cold-start'
    ) => {
      const { actionIdentifier } = response;
      const notificationId = response.notification.request.identifier;

      if (handledTapIds.has(notificationId)) {
        logTap('Tap already handled this session — skipping duplicate', { notificationId, trigger });
        return;
      }
      handledTapIds.add(notificationId);

      // item 4.4: log push interaction type (open, dismiss, or action button)
      const isDismiss = actionIdentifier === 'expo.modules.notifications.actions.DISMISS';
      const isOpen = actionIdentifier === 'expo.modules.notifications.actions.DEFAULT';
      const interactionType = isDismiss ? 'dismissed' : isOpen ? 'opened' : `action:${actionIdentifier}`;
      logTap(`(4.4) interaction=${interactionType} trigger=${trigger}`, {
        actionIdentifier,
        notificationId,
      });

      if (isDismiss) {
        // No deep link navigation or tracking for dismiss — log and exit
        logTap('OUTCOME → dismissed, no tracking event sent');
        return;
      }

      console.log('Full notification object:', JSON.stringify(response, null, 2));

      const data = response.notification.request.content.data;
      logStartup('Notification payload extracted', {
        dataType: typeof data,
        dataKeys: data ? Object.keys(data) : 'N/A',
      });

      // Tolerant `_xdm` read: AJO delivers it as a JSON string, but if expo ever
      // hands it back already-parsed as an object, JSON.parse(object) would throw
      // and silently yield null. Accept both shapes. The raw-type log makes the
      // next on-device test unambiguous about which shape arrived.
      const rawXdm = (data as any)?._xdm;
      logStartup('[4.8] _xdm raw type', { type: typeof rawXdm });
      const parsedXdm =
        typeof rawXdm === 'string'
          ? safeParseJSON<any>(rawXdm, null, '[4.8] _xdm parse')
          : (rawXdm ?? null);

      // AJO embeds correlationID inside the _xdm under
      // mixins._experience.decisioning.propositions[0].scopeDetails.correlationID.
      // Flat keys (adb_correlation_id, etc.) are checked as fallbacks for
      // non-AJO senders or future payload format changes.
      const correlationID =
        parsedXdm?.mixins?._experience?.decisioning?.propositions?.[0]?.scopeDetails?.correlationID ||
        (data as any)?.adb_correlation_id ||
        (data as any)?._adobe?.correlationid ||
        (data as any)?.adobe_correlation_id ||
        undefined;

      // The real AJO message ID — preferred over the local mirror's expo UUID so
      // pushProviderMessageID carries the genuine `-N`-suffixed AJO messageID.
      const ajoMessageID =
        parsedXdm?.mixins?._experience?.customerJourneyManagement?.messageExecution?.messageID ||
        (data as any)?.adobe_message_id ||
        (data as any)?.adb_n_id ||
        undefined;

      // PRIMARY GUARD — only a real AJO push (real _xdm OR real messageID) is
      // allowed to reach Edge. A local-test push has neither, so it is local-only.
      const origin = (data as any)?._origin;
      const isAjoPush = Boolean(parsedXdm) || Boolean(ajoMessageID);

      logTap('(4.8) origin classified', {
        origin: origin ?? 'unspecified',
        isAjoPush,
        correlationIDPresent: Boolean(correlationID),
        correlationID: correlationID ?? 'not found',
      });

      if (!isAjoPush) {
        // Local-test tap (or any push with no real Adobe payload): deep-link only.
        logTap('OUTCOME → LOCAL-TEST tap, Adobe tracking SUPPRESSED (no real _xdm/messageID)', {
          origin: origin ?? 'unspecified',
        });
      } else if (!ajoMessageID) {
        // Real AJO signal (a parsed _xdm) but no messageID could be resolved from it.
        // Do NOT invent one: a fabricated bare-UUID messageID is exactly the junk
        // `applicationOpened` event this separation exists to eliminate. Skip the
        // send and surface it — a real AJO push always carries a messageID, so this
        // means the payload is malformed and worth seeing in the log.
        logTap('OUTCOME → AJO push but no real messageID resolved, tracking SKIPPED (not fabricating one)', {
          correlationIDPresent: Boolean(correlationID),
        });
      } else {
        // item 4.5: send push open tracking event to Edge Network and log result.
        try {
          const { Identity } = require('@adobe/react-native-aepedgeidentity');

          // Bounded identity poll — on a cold-start tap the Edge Identity extension
          // may not have hydrated the identityMap yet. A few short retries let the
          // tracking event fire on the launch that the tap triggered instead of
          // being silently dropped. 5 × 600ms ≈ 3s upper bound.
          let identityMap: any = {};
          for (let attempt = 1; attempt <= 5; attempt++) {
            const rawIdentityResult = await Identity.getIdentities();
            identityMap = rawIdentityResult?.identityMap ?? rawIdentityResult ?? {};
            if (identityMap && Object.keys(identityMap).length > 0) {
              break;
            }
            if (attempt < 5) {
              await new Promise((resolve) => setTimeout(resolve, 600));
            }
          }

          if (!identityMap || Object.keys(identityMap).length === 0) {
            logTap('OUTCOME → AJO tap but identityMap not ready after poll, tracking SKIPPED', { trigger });
          } else {
            const trackingEvent = await buildPushTrackingEvent({
              identityMap,
              pushProvider: Platform.OS === 'ios' ? 'apns' : 'fcm',
              // Guaranteed present — the branch above skips when ajoMessageID is missing.
              pushProviderMessageID: ajoMessageID,
              interaction: isOpen ? 'opened' : 'customAction',
              correlationID,
              ...(!isOpen && { actionID: actionIdentifier }),
            });
            await Edge.sendEvent(trackingEvent);
            logTap('OUTCOME → AJO tap, tracking SENT to Edge ✓', {
              trigger,
              correlationID: correlationID ?? 'none',
              messageID: ajoMessageID,
            });
          }
        } catch (trackingError) {
          console.error('[PUSH-TAP] OUTCOME → AJO tracking FAILED to send:', trackingError);
        }
      }

      // Deep-link navigation runs for BOTH paths (test pushes deep-link too).
      let deepLinkData = data;
      if (typeof data === 'string') {
        try {
          deepLinkData = JSON.parse(data);
        } catch (error) {
          console.error('[startup] Failed to parse notification data:', error);
        }
      }

      const deepLink = (deepLinkData as any)?.adb_uri || (deepLinkData as any)?.adb_deeplink || (deepLinkData as any)?.uri;

      if (!deepLink) {
        logStartup('No deep link found in notification data');
        return;
      }

      logStartup('Deep link found in notification', { deepLink });

      if (typeof deepLink !== 'string') {
        return;
      }

      if (deepLink.startsWith('myapp://') || deepLink.startsWith('com.cmtBootCamp.AEPSampleAppNewArchEnabled://')) {
        const path = deepLink.split('://')[1];
        logStartup('Navigating to internal deep link', { path });

        // Defer navigation until animations finish — avoids race on cold start (item 10.4)
        InteractionManager.runAfterInteractions(() => {
          Linking.openURL(deepLink).catch((error: unknown) => {
            console.error('[startup] Navigation error:', error);
          });
        });

        return;
      }

      if (deepLink.startsWith('http://') || deepLink.startsWith('https://')) {
        logStartup('Opening external deep link', { deepLink });
        Linking.openURL(deepLink);
      }
    };

    const setupPushHandling = () => {
      // item 4.3: log foreground push receipt with payload shape
      const receivedListener = pushNotificationService.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data;
        logStartup('[4.3] Push received in foreground', {
          title: notification.request.content.title,
          body: notification.request.content.body,
          dataKeys: data ? Object.keys(data) : [],
          hasDeepLink: Boolean(data?.adb_uri || data?.adb_deeplink || data?.uri),
          hasAdobeMessageId: Boolean(data?.adobe_message_id || data?.adb_n_id),
        });
      });

      logStartup('Installing push notification response listener');
      const responseListener = pushNotificationService.addNotificationResponseReceivedListener((response) => {
        void handlePushTap(response, 'listener');
      });

      // Cold-start capture: a tap that launches the app from a killed state is not
      // delivered to the live listener — it is only available via this one-shot read.
      // Running the same handler here means a cold-launch AJO tap still tracks.
      Notifications.getLastNotificationResponseAsync()
        .then((lastResponse) => {
          if (lastResponse) {
            logTap('Cold-start tap detected via getLastNotificationResponseAsync');
            void handlePushTap(lastResponse, 'cold-start');
          }
        })
        .catch((error) => {
          console.error('[startup] getLastNotificationResponseAsync failed:', error);
        });

      return { receivedListener, responseListener };
    };

    const { receivedListener, responseListener } = setupPushHandling();

    return () => {
      receivedListener?.remove();
      responseListener?.remove();
    };
  }, []);

  return (
    <StartupErrorBoundary>
      <ProfileProvider>
        <CartProvider>
          <ThemeProvider value={navigationTheme}>
            <StatusBar
              style={isDark ? 'light' : 'dark'}
              backgroundColor={isDark ? '#181c20' : navigationTheme.colors.background}
            />
            <Drawer
              screenOptions={{
                headerTintColor: isDark ? '#fff' : navigationTheme.colors.text,
                headerStyle: { backgroundColor: isDark ? '#181c20' : navigationTheme.colors.background },
                headerRight: () => (
                  <Image
                    source={require('../assets/images/productImages/weretail-logo.png')}
                    style={{ width: 100, height: 32, resizeMode: 'contain', marginRight: 16 }}
                  />
                ),
              }}
            >
              <Drawer.Screen name="index" options={{ drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen name="(consumerTabs)" options={{ title: 'Consumer View' }} />
              <Drawer.Screen name="(techScreens)/index" options={{ title: 'Technical View' }} />
              <Drawer.Screen name="(techScreens)/AppIdConfigView" options={{ title: 'App ID Configuration', drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen name="(techScreens)/AssuranceView" options={{ title: 'Assurance', drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen name="(techScreens)/ConsentView" options={{ title: 'Consent', drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen name="(techScreens)/CoreView" options={{ title: 'Setup', drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen name="(techScreens)/DecisioningItemsView" options={{ title: 'Decisioning', drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen name="(techScreens)/EdgeBridgeView" options={{ title: 'Edge Bridge', drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen name="(techScreens)/EdgeIdentityView" options={{ title: 'Edge Identity', drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen name="(techScreens)/MessagingView" options={{ title: 'Messaging', drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen name="(techScreens)/OptimizeView" options={{ title: 'Optimize', drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen name="(techScreens)/PlacesView" options={{ title: 'Places', drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen name="(techScreens)/ProfileView" options={{ title: 'User Profile', drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen name="(techScreens)/PushNotificationView" options={{ title: 'Push', drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen name="(techScreens)/IdentityView" options={{ title: 'Identity', drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen name="(techScreens)/TargetView" options={{ title: 'Target', drawerItemStyle: { display: 'none' } }} />
            </Drawer>
          </ThemeProvider>
        </CartProvider>
      </ProfileProvider>
    </StartupErrorBoundary>
  );
}
