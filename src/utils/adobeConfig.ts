/*
 * Adobe SDK Initialization Sequence:
 * 1. Set log level to ERROR
 * 2. Initialize MobileCore with App ID
 * 3. Wait 1 second for initialization to complete
 * 4. Verify all extensions are ready
 * 5. Set consent to "Yes" (default and collect)
 * 6. Configure messaging delegate for in-app messages
 * 
 * IMPORTANT: Do not modify this sequence as it ensures proper initialization order
 * and prevents race conditions between MobileCore and extensions.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { MobileCore, LogLevel } from '@adobe/react-native-aepcore';
import { Assurance } from '@adobe/react-native-aepassurance';
import { Edge } from '@adobe/react-native-aepedge';
import { Identity } from '@adobe/react-native-aepedgeidentity';
import { Optimize } from '@adobe/react-native-aepoptimize';
import { Consent } from '@adobe/react-native-aepedgeconsent';
import { Messaging } from '@adobe/react-native-aepmessaging';
import { Places } from '@adobe/react-native-aepplaces';
import { Target } from '@adobe/react-native-aeptarget';
import { UserProfile } from '@adobe/react-native-aepuserprofile';

const { AppIdModule } = NativeModules;

export const APP_ID_STORAGE_KEY = '@adobe_app_id';

export const configureWithAppId = async (appId: string) => {
  try {
    console.log('Configuring native module with App ID:', appId);
    await AsyncStorage.setItem(APP_ID_STORAGE_KEY, appId);
    await AppIdModule.configureWithAppId(appId);
    console.log('Native module configuration successful');
  } catch (error) {
    console.error('Error configuring Adobe App ID:', error);
    throw error;
  }
};

export const getStoredAppId = async (): Promise<string | null> => {
  try {
    const appId = await AsyncStorage.getItem(APP_ID_STORAGE_KEY);
    console.log('Retrieved stored App ID:', appId);
    return appId;
  } catch (error) {
    console.error('Error getting stored App ID:', error);
    return null;
  }
};

export const initializeAdobe = async () => {
  try {
    const appId = await getStoredAppId();
    if (appId) {
      console.log('Initializing Adobe SDK with stored App ID:', appId);
      await configureAdobe(appId);
    } else {
      console.log('No stored App ID found, Adobe SDK not initialized');
    }
  } catch (error) {
    console.error('Error initializing Adobe:', error);
  }
};

export const configureAdobe = async (appId: string) => {
  try {
    console.log('Starting Adobe SDK configuration...');
    
    // Set log level to ERROR for normal operation (use VERBOSE for debugging)
    console.log('Setting log level to ERROR');
    MobileCore.setLogLevel(LogLevel.ERROR);
    
    // Initialize with App ID
    console.log('Initializing MobileCore with App ID:', appId);
    await MobileCore.initializeWithAppId(appId);
    
    // Apply minimal configuration - let Launch property handle all messaging configuration
    try {
      const minimalConfig: any = {};

      console.log('Applying minimal Adobe configuration:', minimalConfig);
      await MobileCore.updateConfiguration(minimalConfig);
      console.log('Adobe configuration applied successfully');
      console.log('Note: Edge Configuration ID should come from Launch property automatically');
    } catch (error) {
      console.error('Error applying Adobe configuration:', error);
    }
    
    // Wait a moment for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify all extensions are ready
    try {
      console.log('Verifying all Adobe extensions are ready...');
      
      const assuranceVersion = await Assurance.extensionVersion();
      console.log('Assurance version:', assuranceVersion);
      
      const edgeVersion = await Edge.extensionVersion();
      console.log('Edge version:', edgeVersion);
      
      const identityVersion = await Identity.extensionVersion();
      console.log('Edge Identity version:', identityVersion);
      
      const optimizeVersion = await Optimize.extensionVersion();
      console.log('Optimize version:', optimizeVersion);
      
      const consentVersion = await Consent.extensionVersion();
      console.log('Edge Consent version:', consentVersion);
      
      const messagingVersion = await Messaging.extensionVersion();
      console.log('Messaging version:', messagingVersion);
      
      const placesVersion = await Places.extensionVersion();
      console.log('Places version:', placesVersion);
      
      const targetVersion = await Target.extensionVersion();
      console.log('Target version:', targetVersion);
      
      const userProfileVersion = await UserProfile.extensionVersion();
      console.log('User Profile version:', userProfileVersion);
      
      console.log('All Adobe extensions verified and ready');
    } catch (error) {
      console.error('Error verifying Adobe extensions:', error);
    }
    
    // Automatically set consent to "Yes" for bootcamp/demo purposes
    try {
      console.log('Setting default consent to Yes...');
      
      // Set default consent
      const defaultConsents = {
        'consent.default': {
          consents: {
            collect: { val: 'y' }
          }
        }
      };
      await MobileCore.updateConfiguration(defaultConsents);
      console.log('✅ Default consent set to Yes');
      
      // Set collect consent
      const collectConsents = {
        consents: {
          collect: { val: 'y' }
        }
      };
      await Consent.update(collectConsents);
      console.log('✅ Collect consent set to Yes');
      
    } catch (error) {
      console.error('Error setting consent:', error);
    }
    
    // Set up messaging delegate for in-app messages
    try {
      console.log('Configuring messaging delegate...');
      const { Linking } = require('react-native');
      
      Messaging.setMessagingDelegate({
        onDismiss: msg => console.log('In-app message dismissed:', msg),
        onShow: msg => console.log('In-app message shown:', msg),
        shouldShowMessage: () => true,  // Always show messages
        shouldSaveMessage: () => true,  // Save messages for later retrieval
        urlLoaded: (url, message) => {
          console.log('🔗 In-app message URL loaded:', url);
          console.log('📨 In-app message data:', message);
          
          // Handle deep links from in-app messages
          if (url && typeof url === 'string') {
            if (url.startsWith('myapp://') || url.startsWith('com.cmtBootCamp.AEPSampleAppNewArchEnabled://')) {
              // Internal deep link
              console.log('📱 In-app message: Navigating to internal route:', url);
              setTimeout(() => {
                try {
                  Linking.openURL(url);
                } catch (error) {
                  console.error('❌ In-app message navigation error:', error);
                }
              }, 100);
            } else if (url.startsWith('http://') || url.startsWith('https://')) {
              // External URL
              console.log('🌐 In-app message: Opening external URL:', url);
              Linking.openURL(url);
            } else {
              // Log unhandled URL format
              console.log('⚠️ In-app message: Unhandled URL format:', url);
            }
          }
        },
      });
      console.log('✅ Messaging delegate configured with deep link handling');
    } catch (error) {
      console.error('Error setting messaging delegate:', error);
    }
    
    console.log('Adobe SDK initialized successfully');
  } catch (error) {
    console.error('Error configuring Adobe SDK:', error);
    throw error;
  }
};

/**
 * Debug function to check current Adobe configuration
 */
export const debugAdobeConfiguration = async (): Promise<string> => {
  try {
    let debugInfo = '=== Adobe Configuration Debug ===\n\n';
    
    // Check if App ID is configured
    const appId = await getStoredAppId();
    debugInfo += `App ID: ${appId || 'NOT CONFIGURED'}\n`;
    
    if (!appId) {
      debugInfo += '\n❌ App ID not configured - this is required for all Adobe services\n';
      return debugInfo;
    }
    
    // Check extension versions
    try {
      const coreVersion = await MobileCore.extensionVersion();
      debugInfo += `MobileCore version: ${coreVersion}\n`;
      
      const edgeVersion = await Edge.extensionVersion();
      debugInfo += `Edge version: ${edgeVersion}\n`;
      
      const identityVersion = await Identity.extensionVersion();
      debugInfo += `Edge Identity version: ${identityVersion}\n`;
      
      const optimizeVersion = await Optimize.extensionVersion();
      debugInfo += `Optimize version: ${optimizeVersion}\n`;
      
      const messagingVersion = await Messaging.extensionVersion();
      debugInfo += `Messaging version: ${messagingVersion}\n`;
      
    } catch (error) {
      debugInfo += `Error getting extension versions: ${error}\n`;
    }
    
    // Check ECID
    try {
      const ecid = await Identity.getExperienceCloudId();
      debugInfo += `ECID: ${ecid || 'NOT AVAILABLE'}\n`;
    } catch (error) {
      debugInfo += `Error getting ECID: ${error}\n`;
    }
    
    // Check Edge location hint
    try {
      const locationHint = await Edge.getLocationHint();
      debugInfo += `Edge Location Hint: ${locationHint || 'NOT AVAILABLE'}\n`;
    } catch (error) {
      debugInfo += `Error getting Edge location hint: ${error}\n`;
    }
    
    // Check current configuration
    try {
      const config = await MobileCore.getSdkIdentities();
      debugInfo += `Current Configuration: ${JSON.stringify(config, null, 2)}\n`;
    } catch (error) {
      debugInfo += `Error getting current configuration: ${error}\n`;
    }
    
    debugInfo += '\n=== Sandbox Configuration Notes ===\n';
    debugInfo += 'The "Sandbox: unknown" issue in Assurance typically means:\n';
    debugInfo += '1. Launch property is not configured with Edge Configuration ID\n';
    debugInfo += '2. Edge Configuration ID is not pointing to the correct sandbox\n';
    debugInfo += '3. Events are not reaching Adobe Experience Platform\n\n';
    debugInfo += '=== Bootcamp User Instructions ===\n';
    debugInfo += 'For bootcamp users to fix this:\n';
    debugInfo += '1. Go to Adobe Experience Platform Data Collection\n';
    debugInfo += '2. Open your Launch property (matching the App ID above)\n';
    debugInfo += '3. Ensure Edge Configuration ID is configured in the property\n';
    debugInfo += '4. Save and publish the Launch property\n';
    debugInfo += '5. Restart the app to pick up the new configuration\n\n';
    debugInfo += 'The Edge Configuration ID should be automatically provided by the Launch property.\n';
    debugInfo += 'If it\'s missing, the Launch property needs to be configured properly.\n';
    
    return debugInfo;
  } catch (error) {
    return `Error in debug function: ${error}`;
  }
}; 