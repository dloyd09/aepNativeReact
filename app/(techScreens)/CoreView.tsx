import React, { useEffect, useState } from 'react';
import { Alert, Button, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Lifecycle, MobileCore, PrivacyStatus } from '@adobe/react-native-aepcore';
import { Consent } from '@adobe/react-native-aepedgeconsent';
import { Identity } from '@adobe/react-native-aepedgeidentity';
import { Optimize } from '@adobe/react-native-aepoptimize';
import { Places } from '@adobe/react-native-aepplaces';
import { Target } from '@adobe/react-native-aeptarget';
import { useRouter } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import Constants from 'expo-constants';
import { TechnicalScreen } from '../../components/TechnicalScreen';
import { ThemedText } from '../../components/ThemedText';
import styles from '../../styles/styles';
import { getStoredAppId, APP_ID_STORAGE_KEY, resetAdobeInitState } from '../../src/utils/adobeConfig';
import { pushNotificationService } from '../../src/utils/pushNotifications';

// ─── Types ────────────────────────────────────────────────────────────────────

type DotColor = 'green' | 'red' | 'grey';

type SetupStatus = {
  appId: string;
  coreVersion: string;
  lifecycleVersion: string;
  privacyStatus: string;
  consentCollect: string;
  ecid: string;
  sdkIdentities: string;
  pushToken: string;       // item 1.2
  pushTokenIsMock: boolean; // item 1.2 / 9.3: drives red dot for simulator tokens
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncateToken(token: string): string {
  if (token.length <= 20) return token;
  return `${token.substring(0, 8)}…${token.substring(token.length - 8)}`;
}

function isMockToken(token: string): boolean {
  return token.startsWith('MockToken_') || token.startsWith('AndroidMockToken_');
}

// item 1.1: status dot logic per row
function appIdDot(v: string): DotColor {
  if (v === 'Loading...') return 'grey';
  if (v === 'Not configured') return 'red';
  return 'green';
}
function versionDot(v: string): DotColor {
  if (v === 'Loading...') return 'grey';
  if (v === 'Unavailable') return 'red';
  return 'green';
}
function ecidDot(v: string): DotColor {
  if (v === 'Loading...') return 'grey';
  if (!v || v === 'Unavailable') return 'red';
  return 'green';
}
function consentDot(v: string): DotColor {
  if (v === 'y') return 'green';
  if (v === 'n') return 'red';
  return 'grey';
}
function privacyDot(v: string): DotColor {
  if (v === 'OPT_IN' || v === 'optedIn') return 'green';
  if (v === 'OPT_OUT' || v === 'optedOut') return 'red';
  return 'grey';
}
function pushTokenDot(isMock: boolean, v: string): DotColor {
  if (v === 'Loading...') return 'grey';
  if (v === 'Not registered' || v === 'Unavailable' || isMock) return 'red';
  return 'green';
}

// ─── SetupRow component ───────────────────────────────────────────────────────

function SetupRow({
  label,
  value,
  dot,
  themeText,
}: {
  label: string;
  value: string;
  dot: DotColor;
  themeText: string;
}) {
  const dotColor = dot === 'green' ? '#4CAF50' : dot === 'red' ? '#F44336' : '#9E9E9E';
  return (
    <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'flex-start' }}>
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: dotColor,
          marginTop: 4,
          marginRight: 8,
          flexShrink: 0,
        }}
      />
      <View style={{ flex: 1 }}>
        <ThemedText style={{ color: themeText, fontSize: 16, fontWeight: 'bold' }}>
          {label}
        </ThemedText>
        <ThemedText style={{ color: themeText, fontSize: 14, marginTop: 4 }}>
          {value}
        </ThemedText>
      </View>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const CoreView = () => {
  const router = useRouter();
  const theme = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [status, setStatus] = useState<SetupStatus>({
    appId: 'Loading...',
    coreVersion: 'Loading...',
    lifecycleVersion: 'Loading...',
    privacyStatus: 'Loading...',
    consentCollect: 'Loading...',
    ecid: 'Loading...',
    sdkIdentities: 'Loading...',
    pushToken: 'Loading...',
    pushTokenIsMock: false,
  });

  const refreshStatus = async () => {
    try {
      setIsRefreshing(true);

      const [
        appId,
        coreVersion,
        lifecycleVersion,
        privacyStatus,
        consents,
        ecid,
        sdkIdentities,
      ] = await Promise.all([
        getStoredAppId(),
        MobileCore.extensionVersion(),
        Lifecycle.extensionVersion(),
        MobileCore.getPrivacyStatus().catch(() => null),
        Consent.getConsents().catch(() => null),
        Identity.getExperienceCloudId().catch(() => null),
        MobileCore.getSdkIdentities().catch(() => null),
      ]);

      const consentCollect =
        consents?.consents?.collect?.val ??
        consents?.consents?.['consent.default']?.collect?.val ??
        'Unavailable';

      // item 1.2: fetch push token from the service and flag mock tokens
      const rawToken = pushNotificationService.getExpoPushToken();
      const tokenIsMock = rawToken ? isMockToken(rawToken) : false;
      let pushTokenDisplay: string;
      if (!rawToken) {
        pushTokenDisplay = 'Not registered';
      } else if (tokenIsMock) {
        pushTokenDisplay = `Simulator — ${truncateToken(rawToken)}`;
      } else {
        pushTokenDisplay = truncateToken(rawToken);
      }

      setStatus({
        appId: appId || 'Not configured',
        coreVersion: coreVersion || 'Unavailable',
        lifecycleVersion: lifecycleVersion || 'Unavailable',
        privacyStatus: String(privacyStatus ?? PrivacyStatus.UNKNOWN),
        consentCollect: String(consentCollect),
        ecid: ecid || 'Unavailable',
        sdkIdentities: sdkIdentities ? JSON.stringify(sdkIdentities) : 'Unavailable',
        pushToken: pushTokenDisplay,
        pushTokenIsMock: tokenIsMock,
      });
    } catch (error) {
      console.error('Failed to refresh setup status:', error);
      setStatus({
        appId: 'Unavailable',
        coreVersion: 'Unavailable',
        lifecycleVersion: 'Unavailable',
        privacyStatus: 'Unavailable',
        consentCollect: 'Unavailable',
        ecid: 'Unavailable',
        sdkIdentities: 'Unavailable',
        pushToken: 'Unavailable',
        pushTokenIsMock: false,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  // item 1.3: Instructor Reset — clears all Adobe state for the next student
  const handleInstructorReset = () => {
    Alert.alert(
      'Reset for New User',
      'This will clear the App ID, all Adobe identities, push token, user profile, and cached SDK data. The next student must re-enter their App ID.\n\nAre you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setIsResetting(true);
            try {
              console.log('[Reset] Starting instructor reset...');

              // 1. Clear stored App ID
              await AsyncStorage.removeItem(APP_ID_STORAGE_KEY);
              console.log('[Reset] App ID cleared');

              // 2. Reset Adobe identities (wipes ECID)
              MobileCore.resetIdentities();
              console.log('[Reset] MobileCore identities reset');

              // 3. Clear push token from Adobe
              try { await MobileCore.setPushIdentifier(''); } catch { /* best-effort */ }
              console.log('[Reset] Push identifier cleared');

              // 4. Clear pending push token (prevents pre-reset token re-registering)
              pushNotificationService.clearPendingToken();
              console.log('[Reset] Pending push token cleared');

              // 5. Clear user profile from AsyncStorage
              await AsyncStorage.removeItem('userProfile');
              console.log('[Reset] User profile cleared');

              // 6. Clear Optimize cached propositions
              try { Optimize.clearCachedPropositions(); } catch { /* best-effort */ }
              console.log('[Reset] Optimize cache cleared');

              // 7. Clear Target cache
              try { Target.clearPrefetchCache(); Target.resetExperience(); } catch { /* best-effort */ }
              console.log('[Reset] Target cache cleared');

              // 8. Clear Places data
              try { Places.clear(); } catch { /* best-effort */ }
              console.log('[Reset] Places cleared');

              // 9. Clear all Adobe-related AsyncStorage keys
              try {
                const allKeys = await AsyncStorage.getAllKeys();
                const adobeKeys = allKeys.filter(key =>
                  key.toLowerCase().includes('adobe') ||
                  key.toLowerCase().includes('optimize') ||
                  key.toLowerCase().includes('target') ||
                  key.toLowerCase().includes('assurance') ||
                  key.toLowerCase().includes('edge') ||
                  key.toLowerCase().includes('consent') ||
                  key.toLowerCase().includes('profile')
                );
                if (adobeKeys.length) {
                  await AsyncStorage.multiRemove(adobeKeys);
                  console.log('[Reset] Cleared Adobe-related AsyncStorage keys:', adobeKeys);
                }
              } catch (e) {
                console.warn('[Reset] AsyncStorage key scan failed:', e);
              }

              // 10. Reset the double-init guard so the next App ID entry re-runs init
              resetAdobeInitState();
              console.log('[Reset] Adobe init state reset');

              console.log('[Reset] Instructor reset complete');

              // Refresh status so all dots go grey/red
              await refreshStatus();

              Alert.alert(
                'Reset Complete',
                'All Adobe state cleared. The next student can now enter their App ID in App ID Configuration.'
              );
            } catch (error) {
              console.error('[Reset] Instructor reset failed:', error);
              Alert.alert('Reset Failed', 'Some state may not have been cleared. Check the console for details.');
            } finally {
              setIsResetting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <TechnicalScreen onBack={() => router.back()}>
        <ThemedText style={styles.welcome}>Setup</ThemedText>
        <ThemedText style={{ marginVertical: 12, color: theme.colors.text, fontSize: 14, textAlign: 'center' }}>
          Read-only setup diagnostics for the current app and Adobe SDK state.
        </ThemedText>
        <Button
          title={isRefreshing ? 'Refreshing...' : 'Refresh Setup Status'}
          onPress={refreshStatus}
          disabled={isRefreshing || isResetting}
        />

        <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
          <SetupRow label="App Version" value={Constants.expoConfig?.version || 'Unknown'} dot="grey" themeText={theme.colors.text} />
          <SetupRow label="Android Package" value={Constants.expoConfig?.android?.package || 'N/A'} dot="grey" themeText={theme.colors.text} />
          <SetupRow label="iOS Bundle ID" value={Constants.expoConfig?.ios?.bundleIdentifier || 'N/A'} dot="grey" themeText={theme.colors.text} />
          <SetupRow label="Adobe App ID" value={status.appId} dot={appIdDot(status.appId)} themeText={theme.colors.text} />
          <SetupRow label="MobileCore Version" value={status.coreVersion} dot={versionDot(status.coreVersion)} themeText={theme.colors.text} />
          <SetupRow label="Lifecycle Version" value={status.lifecycleVersion} dot={versionDot(status.lifecycleVersion)} themeText={theme.colors.text} />
          <SetupRow label="Privacy Status" value={status.privacyStatus} dot={privacyDot(status.privacyStatus)} themeText={theme.colors.text} />
          <SetupRow label="Consent Collect" value={status.consentCollect} dot={consentDot(status.consentCollect)} themeText={theme.colors.text} />
          <SetupRow label="ECID" value={status.ecid} dot={ecidDot(status.ecid)} themeText={theme.colors.text} />
          <SetupRow label="SDK Identities" value={status.sdkIdentities} dot="grey" themeText={theme.colors.text} />
          <SetupRow
            label="Push Token"
            value={status.pushToken}
            dot={pushTokenDot(status.pushTokenIsMock, status.pushToken)}
            themeText={theme.colors.text}
          />
          {status.pushTokenIsMock && (
            <ThemedText style={{ fontSize: 12, color: '#F44336', marginTop: 4, paddingLeft: 18 }}>
              Simulator token — not registered with Adobe. Use a physical device for push testing.
            </ThemedText>
          )}
        </View>

        {/* item 1.3: Instructor Reset */}
        <View style={{ marginTop: 32, paddingHorizontal: 16, paddingBottom: 16 }}>
          <ThemedText style={{ fontSize: 13, color: theme.colors.text, opacity: 0.7, marginBottom: 8, textAlign: 'center' }}>
            Instructor only — clears all Adobe state for the next student session.
          </ThemedText>
          <Button
            title={isResetting ? 'Resetting...' : 'Reset for New User'}
            onPress={handleInstructorReset}
            disabled={isResetting || isRefreshing}
            color="#F44336"
          />
        </View>
    </TechnicalScreen>
  );
};

export default CoreView;
