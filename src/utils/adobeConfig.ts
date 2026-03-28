/*
 * Adobe SDK Initialization Sequence:
 * 1. Initialize MobileCore with App ID (log level set by caller before this)
 * 2. Poll extensionVersion() up to 5 times with 300ms backoff to confirm SDK ready
 * 3. Verify all extensions are registered
 * 4. Set consent to "Yes" (default and collect)
 * 5. Configure messaging delegate for in-app messages
 * 6. Retry any push token that arrived before ECID was available
 *
 * IMPORTANT: Do not modify this sequence as it ensures proper initialization order
 * and prevents race conditions between MobileCore and extensions.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform, InteractionManager } from 'react-native';
import { MobileCore } from '@adobe/react-native-aepcore';
import { setAdobeReadiness } from './adobeReadiness';
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
    if (AppIdModule && typeof AppIdModule.configureWithAppId === 'function') {
      await AppIdModule.configureWithAppId(appId);
      console.log('Native module configuration successful');
    } else {
      console.log('AppIdModule not available on this platform; skipping native config call');
    }
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

export const isAdobeConfigured = async (): Promise<boolean> => {
  const appId = await getStoredAppId();
  return Boolean(appId && appId.trim());
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

// Tracks the App ID that was last successfully initialized (item 2.2).
// Prevents calling initializeWithAppId() more than once per session with the
// same ID (AppIdConfigView loads saved ID on mount, which would otherwise
// trigger a second init immediately after _layout.tsx already ran one).
let _initializedAppId: string | null = null;

/**
 * Reset init state so the next configureAdobe() call re-initializes even if the
 * App ID hasn't changed. Call this from the instructor reset flow (item 1.3) after
 * clearing all Adobe state, so the next student's SDK init runs fresh.
 */
export function resetAdobeInitState(): void {
  _initializedAppId = null;
  setAdobeReadiness('idle');
}

export const configureAdobe = async (appId: string) => {
  if (_initializedAppId === appId) {
    console.log('[Adobe] SDK already initialized with this App ID, skipping re-init');
    return;
  }

  // Signal that init is now in progress (item 2.1)
  setAdobeReadiness('initializing');

  try {
    console.log('Starting Adobe SDK configuration...');
    // Log level is controlled by the caller — _layout.tsx sets VERBOSE (item 2.3)

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
    
    // Poll for SDK readiness instead of a fixed sleep — on slow devices or cold starts
    // 1 second is not enough, and on fast devices it is unnecessary overhead.
    // Poll MobileCore.extensionVersion() up to 5 times with 300ms backoff.
    let sdkReady = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await MobileCore.extensionVersion();
        sdkReady = true;
        console.log(`Adobe SDK ready after attempt ${attempt}`);
        break;
      } catch {
        console.log(`Adobe SDK not ready yet (attempt ${attempt}/5), waiting 300ms...`);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    if (!sdkReady) {
      console.warn('Adobe SDK did not confirm ready after 5 attempts — proceeding anyway.');
    }

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
              // Internal deep link — defer until animations finish (item 10.4)
              console.log('📱 In-app message: Navigating to internal route:', url);
              InteractionManager.runAfterInteractions(() => {
                Linking.openURL(url).catch((error: unknown) => {
                  console.error('❌ In-app message navigation error:', error);
                });
              });
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
    
    // Log in-app message response after initialization
    try {
      console.log('🔍 Checking for in-app messages...');
      
      // Trigger a refresh to see what comes back
      await Messaging.refreshInAppMessages();
      console.log('✅ In-app message refresh completed');
      
      // Wait a moment for messages to be processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try to get any cached messages (this won't show much, but worth trying)
      console.log('📬 Checking message cache...');
      
    } catch (error) {
      console.log('⚠️ In-app message check completed with status:', error);
      // Note: This might not be an error - could just mean no messages available
    }
    
    // Retry any push token that was deferred because ECID was not yet available
    // when the token arrived (common on first open before SDK finishes init).
    // Dynamic require breaks the circular dependency:
    //   pushNotifications.ts → adobeConfig.ts (getStoredAppId)
    //   adobeConfig.ts → pushNotifications.ts (retryPendingPushToken)
    try {
      const { pushNotificationService } = require('./pushNotifications');
      await pushNotificationService.retryPendingPushToken();
    } catch (retryError) {
      console.log('[Push] retryPendingPushToken skipped at configureAdobe time:', retryError);
    }

    _initializedAppId = appId; // mark initialized only on full success (item 2.2)
    setAdobeReadiness('ready'); // signal screens that SDK + ECID are ready (item 2.1)
    console.log('Adobe SDK initialized successfully');
  } catch (error) {
    _initializedAppId = null; // reset so the next call can retry (item 2.2)
    setAdobeReadiness('error'); // let screens surface the failure (item 2.1)
    console.error('Error configuring Adobe SDK:', error);
    throw error;
  }
};

/**
 * Debug function to check in-app message responses
 * Call this from any screen to see what messages are available
 */
export const debugInAppMessages = async (): Promise<void> => {
  try {
    console.log('═══════════════════════════════════════');
    console.log('🔍 DEBUG: Checking In-App Messages');
    console.log('═══════════════════════════════════════');
    
    // Get current ECID
    const ecid = await Identity.getExperienceCloudId();
    console.log('📱 Current ECID:', ecid);
    
    // Get identity map
    const identities = await Identity.getIdentities();
    console.log('🆔 Identity Map:', JSON.stringify(identities, null, 2));
    
    // Refresh messages from server
    console.log('📡 Refreshing in-app messages from server...');
    await Messaging.refreshInAppMessages();
    console.log('✅ Refresh completed');
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('═══════════════════════════════════════');
    console.log('📬 In-App Message Check Complete');
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log('What to look for in Assurance:');
    console.log('1. "Retrieve message definitions" request');
    console.log('2. Edge Network response with handle type "personalization:decisions"');
    console.log('3. If no campaigns: empty response or no response event');
    console.log('');
    console.log('Expected surface: mobileapp://com.cmtBootCamp.AEPSampleAppNewArchEnabled');
    console.log('═══════════════════════════════════════');
    
  } catch (error) {
    console.error('❌ Error in debugInAppMessages:', error);
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
