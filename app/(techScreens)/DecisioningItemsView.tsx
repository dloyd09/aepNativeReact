import React, { useEffect, useState } from 'react';
import { Alert, Button, ScrollView, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Messaging } from '@adobe/react-native-aepmessaging';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import styles from '../../styles/styles';

const DECISIONING_ITEMS_CONFIG_KEY = '@decisioning_items_config';
const PREVIEW_URL = 'com.cmtBootCamp.AEPSampleAppNewArchEnabled://decisioning-items';
const DEFAULT_SURFACE = 'edge-offers';

interface DecisioningItemsConfig {
  surface: string;
  previewUrl: string;
}

export default function DecisioningItemsView() {
  const router = useRouter();
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');

  const [config, setConfig] = useState<DecisioningItemsConfig>({
    surface: DEFAULT_SURFACE,
    previewUrl: PREVIEW_URL,
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>('');
  const [lastInAppRefresh, setLastInAppRefresh] = useState<string>('');

  useEffect(() => {
    const loadSavedConfig = async () => {
      try {
        const savedConfig = await AsyncStorage.getItem(DECISIONING_ITEMS_CONFIG_KEY);

        if (savedConfig) {
          const parsedConfig = JSON.parse(savedConfig);
          setConfig({
            surface: parsedConfig.surface || DEFAULT_SURFACE,
            previewUrl: PREVIEW_URL,
          });
        } else {
          const defaultConfig: DecisioningItemsConfig = {
            surface: DEFAULT_SURFACE,
            previewUrl: PREVIEW_URL,
          };
          await AsyncStorage.setItem(DECISIONING_ITEMS_CONFIG_KEY, JSON.stringify(defaultConfig));
          setConfig(defaultConfig);
        }
      } catch (error) {
        console.error('Error loading decisioning config:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    loadSavedConfig();
  }, []);

  const fetchPropositions = async () => {
    try {
      const surface = config.surface.trim();
      if (!surface) {
        Alert.alert('Missing Surface', 'Enter a valid decisioning surface before fetching propositions.');
        return;
      }

      setIsTesting(true);
      setTestResult('');

      await Messaging.updatePropositionsForSurfaces([surface]);
      const propositionsResult = await Messaging.getPropositionsForSurfaces([surface]);
      await AsyncStorage.setItem(
        DECISIONING_ITEMS_CONFIG_KEY,
        JSON.stringify({ surface, previewUrl: PREVIEW_URL })
      );
      setConfig(prev => ({ ...prev, surface }));

      let propositionsArray: any[] = [];
      if (Array.isArray(propositionsResult)) {
        propositionsArray = propositionsResult;
      } else if (propositionsResult && typeof propositionsResult === 'object') {
        propositionsArray = Object.values(propositionsResult).flat();
      }

      const resultSummary = {
        status: 'SUCCESS',
        surface,
        propositionsCount: propositionsArray.length,
        propositions: propositionsArray.map(p => ({
          id: p.id,
          scope: p.scope,
          itemsCount: p.items?.length || 0,
        })),
      };

      setTestResult(JSON.stringify(resultSummary, null, 2));
      Alert.alert('Fetch Complete', `Found ${propositionsArray.length} proposition(s) for "${surface}".`);
    } catch (error: any) {
      console.error('Decisioning fetch failed:', error);
      const failure = {
        status: 'ERROR',
        surface: config.surface.trim(),
        error: error?.message || 'Unknown error',
      };
      setTestResult(JSON.stringify(failure, null, 2));
      Alert.alert('Fetch Failed', error?.message || 'Unknown error');
    } finally {
      setIsTesting(false);
    }
  };

  const refreshInAppMessages = async () => {
    try {
      await Messaging.refreshInAppMessages();
      setLastInAppRefresh(`Success at ${new Date().toLocaleString()}`);
      Alert.alert('In-App Refresh Complete', 'Requested the latest in-app messages from Adobe Messaging.');
    } catch (error: any) {
      const message = error?.message || 'Unknown error';
      setLastInAppRefresh(`Failed: ${message}`);
      Alert.alert('In-App Refresh Failed', message);
    }
  };

  if (!isInitialized) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ThemedText>Loading decisioning configuration...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={{ marginTop: 75, paddingBottom: 100, paddingHorizontal: 20 }}>
        <Button title="Go to main page" onPress={() => router.back()} />
        <ThemedText style={styles.welcome}>Decisioning</ThemedText>

        <ThemedText style={{ marginTop: 8, color: textColor, fontSize: 13, textAlign: 'center' }}>
          Supported decisioning diagnostics for this app.
        </ThemedText>

        <View style={{ marginTop: 20, backgroundColor: tintColor + '10', padding: 12, borderRadius: 5 }}>
          <ThemedText style={{ fontWeight: 'bold', marginBottom: 5, fontSize: 12 }}>Current State</ThemedText>
          <ThemedText style={{ fontSize: 11, opacity: 0.8 }}>Current Surface: {config.surface || DEFAULT_SURFACE}</ThemedText>
          <ThemedText style={{ fontSize: 11, opacity: 0.8, marginTop: 6 }}>Preview URL: {PREVIEW_URL}</ThemedText>
          {lastInAppRefresh ? (
            <ThemedText style={{ fontSize: 11, opacity: 0.8, marginTop: 6 }}>Last In-App Refresh: {lastInAppRefresh}</ThemedText>
          ) : null}
        </View>

        <ThemedText style={{ marginTop: 24, color: textColor, fontSize: 16, fontWeight: 'bold' }}>
          Surface
        </ThemedText>
        <ThemedText style={{ fontSize: 12, marginTop: 8, marginBottom: 8, opacity: 0.7, color: textColor }}>
          Use the exact surface name configured in Adobe Journey Optimizer for this app experience.
        </ThemedText>
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: tintColor,
            padding: 12,
            borderRadius: 5,
            color: textColor,
            backgroundColor: backgroundColor,
          }}
          value={config.surface}
          onChangeText={text => setConfig(prev => ({ ...prev, surface: text }))}
          placeholder="edge-offers"
          placeholderTextColor={textColor + '80'}
        />
        <ThemedText style={{ fontSize: 11, opacity: 0.7, marginTop: 8, color: textColor }}>
          The current field value is used directly when fetching propositions.
        </ThemedText>

        <ThemedText style={{ marginTop: 24, color: textColor, fontSize: 16, fontWeight: 'bold' }}>
          Actions
        </ThemedText>
        <View style={{ marginTop: 8 }}>
          <Button
            title={isTesting ? 'Fetching Propositions...' : 'Fetch Propositions'}
            onPress={fetchPropositions}
            disabled={isTesting}
          />
          <View style={{ marginTop: 10 }} />
          <Button
            title="Refresh In-App Messages"
            onPress={refreshInAppMessages}
          />
        </View>

        {testResult ? (
          <View style={{ marginTop: 20 }}>
            <ThemedText style={{ color: textColor, fontSize: 16, fontWeight: 'bold' }}>Last Fetch Result</ThemedText>
            <ScrollView
              style={{
                backgroundColor: testResult.includes('"status": "SUCCESS"') ? '#4CAF50' + '20' : '#ff4444' + '20',
                padding: 15,
                borderRadius: 5,
                marginTop: 10,
                maxHeight: 300,
              }}
            >
              <ThemedText style={{ fontFamily: 'monospace', fontSize: 11 }}>{testResult}</ThemedText>
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}
