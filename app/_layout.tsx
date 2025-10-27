import { DarkTheme, DefaultTheme, ThemeProvider, useTheme } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { Drawer } from 'expo-router/drawer';
import { useEffect } from 'react';
import { MobileCore, LogLevel } from '@adobe/react-native-aepcore';
import { Assurance } from '@adobe/react-native-aepassurance';
import { CartProvider } from '../components/CartContext';
import { Image } from 'react-native';
import { configureAdobe, getStoredAppId } from '../src/utils/adobeConfig';
import * as Linking from 'expo-linking';

import { useColorScheme } from '@/hooks/useColorScheme';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const { colors } = useTheme();

  const isDark = scheme === 'dark';

  useEffect(() => {
    // Initialize Adobe SDK
    const initAdobe = async () => {
      try {
        const appId = await getStoredAppId();
        if (appId) {
          // Set verbose logging for maximum Assurance debugging
          MobileCore.setLogLevel(LogLevel.VERBOSE);
          await configureAdobe(appId);
          console.log('Adobe SDK and Assurance initialized successfully');
        } else {
          console.log('No App ID found, Adobe SDK not initialized');
        }
      } catch (error) {
        console.error('Failed to initialize Adobe SDK:', error);
      }
    };
    
    initAdobe();
    
    // Hide the splash screen after the app is ready
    SplashScreen.hideAsync();
    
    // Set up push notification deep link handler
    const setupPushHandling = async () => {
      const { PushNotificationService } = await import('../src/utils/pushNotifications');
      const pushService = PushNotificationService.getInstance();
      
      const responseListener = pushService.addNotificationResponseReceivedListener(response => {
        console.log('📲 Push notification tapped:', response);
        console.log('📲 Full notification object:', JSON.stringify(response, null, 2));
        
        // Extract the notification data
        const data = response.notification.request.content.data;
        console.log('Notification data:', data);
        console.log('Notification data type:', typeof data);
        console.log('Notification data keys:', data ? Object.keys(data) : 'N/A');
        
        // Check for Adobe deep link fields (handle both object and stringified)
        let deepLinkData = data;
        if (typeof data === 'string') {
          try {
            deepLinkData = JSON.parse(data);
          } catch (e) {
            console.error('Failed to parse notification data:', e);
          }
        }
        
        const deepLink = deepLinkData?.adb_uri || deepLinkData?.adb_deeplink || deepLinkData?.uri;
        
        if (deepLink) {
          console.log('🔗 Deep link found:', deepLink);
          
          if (typeof deepLink === 'string') {
            if (deepLink.startsWith('myapp://') || deepLink.startsWith('com.cmtBootCamp.AEPSampleAppNewArchEnabled://')) {
              // Internal deep link
              const path = deepLink.split('://')[1];
              console.log('📱 Navigating to:', path);
              
              // Small delay to ensure app is ready
              setTimeout(() => {
                try {
                  // Use Linking for more reliable deep link handling
                  Linking.openURL(deepLink);
                } catch (error) {
                  console.error('Navigation error:', error);
                }
              }, 100);
            } else if (deepLink.startsWith('http://') || deepLink.startsWith('https://')) {
              // External URL
              console.log('🌐 Opening external URL:', deepLink);
              Linking.openURL(deepLink);
            }
          }
        } else {
          console.log('⚠️ No deep link found in notification data');
        }
      });
      
      return responseListener;
    };
    
    let listener: any;
    setupPushHandling().then(l => listener = l);
    
    // Cleanup
    return () => {
      listener?.remove();
    };
  }, []);

  // Note: Page view tracking now handled by XDM events in individual consumer tabs
  // See home.tsx, cart.tsx, profile.tsx, etc. for Edge.sendEvent() implementations

  return (
    <CartProvider>
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <Drawer
          screenOptions={{
            headerTintColor: isDark ? '#fff' : colors.text,
            headerStyle: { backgroundColor: isDark ? '#181c20' : colors.background },
            headerRight: () => (
              <Image
                source={require('../assets/images/productImages/weretail-logo.png')}
                style={{ width: 100, height: 32, resizeMode: 'contain', marginRight: 16 }}
              />
            ),
          }}
        >
          <Drawer.Screen name="index" options={{ title: 'Technical View' }} />
          <Drawer.Screen name="(techScreens)/AppIdConfigView" options={{ title: 'App ID Config', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/AssuranceView" options={{ title: 'Assurance', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/ConsentView" options={{ title: 'Consent', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/CoreView" options={{ title: 'Core / Lifecycle / Signal', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/DecisioningItemsView" options={{ title: 'Decisioning Items', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/EdgeBridgeView" options={{ title: 'Edge Bridge', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/EdgeIdentityView" options={{ title: 'Edge Identity', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/EdgeView" options={{ title: 'Edge', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/IdentityView" options={{ title: 'Identity', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/MessagingView" options={{ title: 'Messaging', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/OptimizeView" options={{ title: 'Optimize', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/PlacesView" options={{ title: 'Places', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/ProfileView" options={{ title: 'User Profile', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/PushNotificationView" options={{ title: 'Push Notifications', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/TargetView" options={{ title: 'Target', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(consumerTabs)" options={{ title: 'Consumer View' }} />
        </Drawer>
      </ThemeProvider>
    </CartProvider>
  );
}