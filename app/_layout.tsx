import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { Drawer } from 'expo-router/drawer';
import { useEffect } from 'react';
import { MobileCore, LogLevel } from '@adobe/react-native-aepcore';
import { CartProvider } from '../components/CartContext';
import { StartupErrorBoundary } from '../components/StartupErrorBoundary';
import { Image } from 'react-native';
import { configureAdobe, getStoredAppId } from '../src/utils/adobeConfig';
import { pushNotificationService } from '../src/utils/pushNotifications';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';

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
      manifestVersion: Constants.manifest?.version,
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

    const setupPushHandling = () => {
      logStartup('Installing push notification response listener');
      return pushNotificationService.addNotificationResponseReceivedListener((response) => {
        logStartup('Push notification tapped');
        console.log('Full notification object:', JSON.stringify(response, null, 2));

        const data = response.notification.request.content.data;
        logStartup('Notification payload extracted', {
          dataType: typeof data,
          dataKeys: data ? Object.keys(data) : 'N/A',
        });

        let deepLinkData = data;
        if (typeof data === 'string') {
          try {
            deepLinkData = JSON.parse(data);
          } catch (error) {
            console.error('[startup] Failed to parse notification data:', error);
          }
        }

        const deepLink = deepLinkData?.adb_uri || deepLinkData?.adb_deeplink || deepLinkData?.uri;

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

          setTimeout(() => {
            try {
              Linking.openURL(deepLink);
            } catch (error) {
              console.error('[startup] Navigation error:', error);
            }
          }, 100);

          return;
        }

        if (deepLink.startsWith('http://') || deepLink.startsWith('https://')) {
          logStartup('Opening external deep link', { deepLink });
          Linking.openURL(deepLink);
        }
      });
    };

    const listener = setupPushHandling();

    return () => {
      listener?.remove();
    };
  }, []);

  return (
    <StartupErrorBoundary>
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
            <Drawer.Screen name="(techScreens)/EdgeView" options={{ title: 'Edge', drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="(techScreens)/IdentityView" options={{ title: 'Identity', drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="(techScreens)/MessagingView" options={{ title: 'Messaging', drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="(techScreens)/OptimizeView" options={{ title: 'Optimize', drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="(techScreens)/PlacesView" options={{ title: 'Places', drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="(techScreens)/ProfileView" options={{ title: 'User Profile', drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="(techScreens)/PushNotificationView" options={{ title: 'Push', drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="(techScreens)/TargetView" options={{ title: 'Target', drawerItemStyle: { display: 'none' } }} />
          </Drawer>
        </ThemeProvider>
      </CartProvider>
    </StartupErrorBoundary>
  );
}
