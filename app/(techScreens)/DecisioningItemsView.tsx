/**
 * Decisioning Items Configuration View
 * 
 * This screen allows configuration of Adobe Journey Optimizer Code-Based Experiences (CBE).
 * 
 * Required parameters for AJO CBE:
 * - App ID: Already configured in AppIdConfigView
 * - Surface/Location: Where content will be rendered in the app (e.g. 'hero-banner', 'product-rail')
 * - Preview URL: Deep link for on-device previews
 * - Campaign Activity ID: Optional, for specific campaign targeting
 * 
 * Author: AI Assistant for Decisioning Items implementation
 */

import React, { useState, useEffect } from 'react';
import { Alert, ScrollView, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Messaging } from '@adobe/react-native-aepmessaging';

// AsyncStorage keys for Decisioning Items configuration
const DECISIONING_ITEMS_CONFIG_KEY = '@decisioning_items_config';
const LEGACY_EDGE_OFFERS_CONFIG_KEY = '@edge_offers_config'; // For migration from old key

// Fixed preview URL for AJO code-based experiences
const PREVIEW_URL = 'com.cmtBootCamp.AEPSampleAppNewArchEnabled://decisioning-items';

// Default surface for bootcamp users
const DEFAULT_SURFACE = 'edge-offers';

interface DecisioningItemsConfig {
  surface: string;
  previewUrl: string; // Always set to PREVIEW_URL, kept for backwards compatibility
}

export default function DecisioningItemsView() {
  const router = useRouter();
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');

  // Configuration state - defaults to "edge-offers" for bootcamp users
  const [config, setConfig] = useState<DecisioningItemsConfig>({
    surface: DEFAULT_SURFACE,
    previewUrl: PREVIEW_URL,
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  // Load saved configuration on component mount
  useEffect(() => {
    loadSavedConfig();
  }, []);

  const loadSavedConfig = async () => {
    try {
      // First, try to load the new config
      let savedConfig = await AsyncStorage.getItem(DECISIONING_ITEMS_CONFIG_KEY);
      
      // If no new config found, check for legacy Edge Offers config and migrate
      if (!savedConfig) {
        const legacyConfig = await AsyncStorage.getItem(LEGACY_EDGE_OFFERS_CONFIG_KEY);
        
        if (legacyConfig) {
          // Migrate the config
          await AsyncStorage.setItem(DECISIONING_ITEMS_CONFIG_KEY, legacyConfig);
          await AsyncStorage.removeItem(LEGACY_EDGE_OFFERS_CONFIG_KEY);
          savedConfig = legacyConfig;
        }
      }
      
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig);
        // Always use the fixed preview URL, ignore any saved value
        setConfig({
          surface: parsedConfig.surface || DEFAULT_SURFACE,
          previewUrl: PREVIEW_URL
        });
      } else {
        // No saved config - auto-save the default for bootcamp users
        const defaultConfig: DecisioningItemsConfig = {
          surface: DEFAULT_SURFACE,
          previewUrl: PREVIEW_URL
        };
        await AsyncStorage.setItem(DECISIONING_ITEMS_CONFIG_KEY, JSON.stringify(defaultConfig));
        console.log('✅ Auto-saved default decisioning items config:', defaultConfig);
        setConfig(defaultConfig);
      }
      setIsInitialized(true);
    } catch (error) {
      console.error('🔴 Error loading Decisioning Items config:', error);
      setIsInitialized(true);
    }
  };

  const saveConfig = async () => {
    try {
      // Validate required field
      if (!config.surface.trim()) {
        Alert.alert('Error', 'Surface/Location is required');
        return;
      }

      const configToSave: DecisioningItemsConfig = {
        surface: config.surface.trim(),
        previewUrl: PREVIEW_URL // Always use fixed preview URL
      };

      await AsyncStorage.setItem(DECISIONING_ITEMS_CONFIG_KEY, JSON.stringify(configToSave));
      
      Alert.alert('Success', 'Decisioning Items configuration saved successfully');
    } catch (error) {
      console.error('🔴 Error saving Decisioning Items config:', error);
      Alert.alert('Error', 'Failed to save Decisioning Items configuration');
    }
  };

  const validateConfig = async () => {
    try {
      const savedConfig = await AsyncStorage.getItem(DECISIONING_ITEMS_CONFIG_KEY);
      
      if (!savedConfig) {
        Alert.alert('Validation', 'No configuration found. Please save configuration first.');
        return;
      }

      const parsedConfig = JSON.parse(savedConfig);
      
      let validationMessage = '✅ Configuration Validation:\n\n';
      validationMessage += `Surface: ${parsedConfig.surface || 'Not set'}\n`;
      validationMessage += `Preview URL: ${PREVIEW_URL}\n\n`;
      
      // Check if required field is present
      const isValid = parsedConfig.surface;
      validationMessage += isValid ? 'Status: ✅ Valid configuration' : 'Status: ❌ Missing required field (Surface)';
      
      Alert.alert('Configuration Status', validationMessage);
    } catch (error) {
      console.error('🔴 Error validating config:', error);
      Alert.alert('Error', 'Failed to validate configuration');
    }
  };

  const clearConfig = async () => {
    try {
      // Reset to default config instead of clearing completely
      const defaultConfig: DecisioningItemsConfig = {
        surface: DEFAULT_SURFACE,
        previewUrl: PREVIEW_URL
      };
      await AsyncStorage.setItem(DECISIONING_ITEMS_CONFIG_KEY, JSON.stringify(defaultConfig));
      setConfig(defaultConfig);
      Alert.alert('Reset to Default', `Decisioning Items configuration reset to default (surface: "${DEFAULT_SURFACE}")`);
    } catch (error) {
      console.error('🔴 Error clearing config:', error);
      Alert.alert('Error', 'Failed to reset configuration');
    }
  };

  const updateField = (field: keyof DecisioningItemsConfig, value: string) => {
    setConfig(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const testConnection = async () => {
    try {
      // Validate surface is set
      if (!config.surface.trim()) {
        Alert.alert('Error', 'Please enter a Surface/Location before testing');
        return;
      }

      setIsTesting(true);
      setTestResult('');

      const surface = config.surface.trim();
      console.log('🧪 Testing connection with surface:', surface);

      // Fetch propositions from Adobe
      await Messaging.updatePropositionsForSurfaces([surface]);
      const propositionsResult = await Messaging.getPropositionsForSurfaces([surface]);

      // Convert result to array
      let propositionsArray: any[] = [];
      if (Array.isArray(propositionsResult)) {
        propositionsArray = propositionsResult;
      } else if (propositionsResult && typeof propositionsResult === 'object') {
        propositionsArray = Object.values(propositionsResult).flat();
      }

      // Format the result for display
      const resultSummary = {
        status: 'SUCCESS',
        surface: surface,
        propositionsCount: propositionsArray.length,
        propositions: propositionsArray.map(p => ({
          id: p.id,
          scope: p.scope,
          itemsCount: p.items?.length || 0,
        })),
        fullResponse: propositionsArray
      };

      const resultJson = JSON.stringify(resultSummary, null, 2);
      setTestResult(resultJson);

      console.log('✅ Test connection successful:', resultSummary);
      Alert.alert(
        'Connection Test Successful',
        `Found ${propositionsArray.length} proposition(s) for surface "${surface}"\n\nSee full response below.`,
        [{ text: 'OK' }]
      );

    } catch (error: any) {
      console.error('🔴 Test connection failed:', error);
      const errorResult = {
        status: 'ERROR',
        surface: config.surface.trim(),
        error: error.message || 'Unknown error',
        errorDetails: error.toString()
      };
      setTestResult(JSON.stringify(errorResult, null, 2));
      Alert.alert('Connection Test Failed', `Error: ${error.message || 'Unknown error'}\n\nSee details below.`);
    } finally {
      setIsTesting(false);
    }
  };

  if (!isInitialized) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ThemedText>Loading configuration...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, backgroundColor }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ThemedText style={{ fontSize: 16, color: tintColor }}>← Back</ThemedText>
        </TouchableOpacity>
        <ThemedText type="title">Decisioning Items</ThemedText>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ marginVertical: 10, backgroundColor: tintColor + '10', padding: 15, borderRadius: 5 }}>
        <ThemedText style={{ fontWeight: 'bold', marginBottom: 5 }}>Adobe Journey Optimizer Code-Based Experience</ThemedText>
        <ThemedText style={{ fontSize: 12, marginBottom: 3 }}>Configure surface location for AJO campaigns</ThemedText>
        <ThemedText style={{ fontSize: 12 }}>• Surface: Where content appears in your app</ThemedText>
        <ThemedText style={{ fontSize: 12, fontWeight: 'bold', color: '#4CAF50', marginTop: 5 }}>✅ Default set to: "edge-offers" for bootcamp users</ThemedText>
      </View>

      <View style={{ marginVertical: 15 }}>
        <ThemedText style={{ marginBottom: 5, fontWeight: 'bold' }}>Surface/Location *</ThemedText>
        <ThemedText style={{ fontSize: 12, marginBottom: 5, opacity: 0.7 }}>
          Surface identifier for AJO campaigns (e.g., 'edge-offers', 'home-banner', 'product-recommendations')
        </ThemedText>
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: tintColor,
            padding: 12,
            marginBottom: 5,
            borderRadius: 5,
            color: textColor,
            backgroundColor: backgroundColor
          }}
          value={config.surface}
          onChangeText={(text) => updateField('surface', text)}
          placeholder="edge-offers (default)"
          placeholderTextColor={textColor + '80'}
        />
        
        {/* Show note about surface naming */}
        {config.surface && (
          <View style={{ 
            backgroundColor: tintColor + '10', 
            padding: 10, 
            borderRadius: 5, 
            marginBottom: 5,
            borderWidth: 1,
            borderColor: tintColor + '20'
          }}>
            <ThemedText style={{ fontSize: 11, opacity: 0.8 }}>
              💡 Use this exact surface name when creating campaigns in Adobe Journey Optimizer
            </ThemedText>
          </View>
        )}
      </View>

      {/* Display the fixed preview URL */}
      <View style={{ marginVertical: 15, backgroundColor: tintColor + '10', padding: 12, borderRadius: 5 }}>
        <ThemedText style={{ fontWeight: 'bold', marginBottom: 5, fontSize: 12 }}>Preview URL (Fixed)</ThemedText>
        <ThemedText style={{ fontSize: 11, fontFamily: 'monospace', opacity: 0.8 }}>
          {PREVIEW_URL}
        </ThemedText>
        <ThemedText style={{ fontSize: 10, marginTop: 5, opacity: 0.6 }}>
          This URL is used for on-device campaign previews
        </ThemedText>
      </View>

      {/* Action Buttons */}
      <View style={{ marginVertical: 20 }}>
        <TouchableOpacity
          style={{
            backgroundColor: tintColor,
            padding: 15,
            borderRadius: 5,
            alignItems: 'center',
            marginBottom: 10
          }}
          onPress={saveConfig}
        >
          <ThemedText style={{ color: backgroundColor, fontWeight: 'bold' }}>Save Configuration</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: '#4CAF50',
            padding: 15,
            borderRadius: 5,
            alignItems: 'center',
            marginBottom: 10,
            opacity: isTesting ? 0.6 : 1
          }}
          onPress={testConnection}
          disabled={isTesting}
        >
          {isTesting ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 10 }} />
              <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>Testing Connection...</ThemedText>
            </View>
          ) : (
            <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>Test Connection (Fetch Propositions)</ThemedText>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: tintColor + '20',
            borderWidth: 1,
            borderColor: tintColor,
            padding: 15,
            borderRadius: 5,
            alignItems: 'center',
            marginBottom: 10
          }}
          onPress={validateConfig}
        >
          <ThemedText style={{ color: tintColor, fontWeight: 'bold' }}>Validate Configuration</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: '#ff4444' + '20',
            borderWidth: 1,
            borderColor: '#ff4444',
            padding: 15,
            borderRadius: 5,
            alignItems: 'center'
          }}
          onPress={clearConfig}
        >
          <ThemedText style={{ color: '#ff4444', fontWeight: 'bold' }}>Reset to Default (edge-offers)</ThemedText>
        </TouchableOpacity>
      </View>

      {/* Current Configuration Display */}
      <View style={{ marginTop: 30 }}>
        <ThemedText type="subtitle">Current Configuration:</ThemedText>
        <View style={{ backgroundColor: tintColor + '20', padding: 15, borderRadius: 5, marginTop: 10 }}>
          <ThemedText style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {JSON.stringify(config, null, 2)}
          </ThemedText>
        </View>
      </View>

      {/* Test Result Display */}
      {testResult && (
        <View style={{ marginTop: 20 }}>
          <ThemedText type="subtitle">Last Test Result:</ThemedText>
          <ScrollView 
            style={{ 
              backgroundColor: testResult.includes('"status": "SUCCESS"') ? '#4CAF50' + '20' : '#ff4444' + '20', 
              padding: 15, 
              borderRadius: 5, 
              marginTop: 10,
              maxHeight: 300
            }}
          >
            <ThemedText style={{ fontFamily: 'monospace', fontSize: 11 }}>
              {testResult}
            </ThemedText>
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
}
