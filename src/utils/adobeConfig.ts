/*
 * Adobe SDK Initialization Sequence:
 * 1. Set log level to DEBUG
 * 2. Initialize MobileCore with App ID
 * 3. Wait 1 second for initialization to complete
 * 4. Verify all extensions are ready
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
    
    // Set log level
    console.log('Setting log level to DEBUG');
    MobileCore.setLogLevel(LogLevel.DEBUG);
    
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