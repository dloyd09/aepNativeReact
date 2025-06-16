import { DarkTheme, DefaultTheme, ThemeProvider, useTheme } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { Drawer } from 'expo-router/drawer';
import { useEffect } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { MobileCore, LogLevel } from '@adobe/react-native-aepcore';
import { Assurance } from '@adobe/react-native-aepassurance';
import { CartProvider } from '../components/CartContext';
import { Image } from 'react-native';
import { configureAdobe, getStoredAppId } from '../src/utils/adobeConfig';

import { useColorScheme } from '@/hooks/useColorScheme';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const isFocused = useIsFocused();
  const { colors } = useTheme();

  const isDark = scheme === 'dark';

  useEffect(() => {
    // Initialize Adobe SDK
    const initAdobe = async () => {
      try {
        const appId = await getStoredAppId();
        if (appId) {
          // Set debug logging
          MobileCore.setLogLevel(LogLevel.DEBUG);
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
  }, []);

  useEffect(() => {
    if (isFocused) {
      // Only run when HomeTab is actually focused
      try {
        MobileCore.trackState('HomeTab', {
          'web.webPageDetails.name': 'Home',
          'application.name': 'WeRetailMobileApp',
          // Add any additional dynamic data here
        });
        console.log('HomeTab viewed - Adobe tracking successful');
      } catch (error) {
        console.error('Failed to track HomeTab view:', error);
      }
    }
  }, [isFocused]);

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
          <Drawer.Screen name="(techScreens)/EdgeBridgeView" options={{ title: 'Edge Bridge', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/EdgeIdentityView" options={{ title: 'Edge Identity', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/EdgeView" options={{ title: 'Edge', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/IdentityView" options={{ title: 'Identity', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/MessagingView" options={{ title: 'Messaging', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/OptimizeView" options={{ title: 'Optimize', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/PlacesView" options={{ title: 'Places', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/ProfileView" options={{ title: 'User Profile', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(techScreens)/TargetView" options={{ title: 'Target', drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="(consumerTabs)" options={{ title: 'Consumer View' }} />
        </Drawer>
      </ThemeProvider>
    </CartProvider>
  );
}