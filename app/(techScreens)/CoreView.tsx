import React, { useEffect, useState } from 'react';
import { Button, ScrollView, View } from 'react-native';
import { Lifecycle, MobileCore, PrivacyStatus } from '@adobe/react-native-aepcore';
import { Consent } from '@adobe/react-native-aepedgeconsent';
import { Identity } from '@adobe/react-native-aepedgeidentity';
import { useRouter } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import Constants from 'expo-constants';
import { TechnicalScreen } from '../../components/TechnicalScreen';
import { ThemedText } from '../../components/ThemedText';
import styles from '../../styles/styles';
import { getStoredAppId } from '../../src/utils/adobeConfig';

type SetupStatus = {
  appId: string;
  coreVersion: string;
  lifecycleVersion: string;
  privacyStatus: string;
  consentCollect: string;
  ecid: string;
  sdkIdentities: string;
};

function SetupRow({
  label,
  value,
  themeText,
}: {
  label: string;
  value: string;
  themeText: string;
}) {
  return (
    <View style={{ marginTop: 16 }}>
      <ThemedText style={{ color: themeText, fontSize: 16, fontWeight: 'bold' }}>
        {label}
      </ThemedText>
      <ThemedText style={{ color: themeText, fontSize: 14, marginTop: 4 }}>
        {value}
      </ThemedText>
    </View>
  );
}

const CoreView = () => {
  const router = useRouter();
  const theme = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [status, setStatus] = useState<SetupStatus>({
    appId: 'Loading...',
    coreVersion: 'Loading...',
    lifecycleVersion: 'Loading...',
    privacyStatus: 'Loading...',
    consentCollect: 'Loading...',
    ecid: 'Loading...',
    sdkIdentities: 'Loading...',
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
        MobileCore.getPrivacyStatus(),
        Consent.getConsents().catch(() => null),
        Identity.getExperienceCloudId().catch(() => null),
        MobileCore.getSdkIdentities().catch(() => null),
      ]);

      const consentCollect =
        consents?.consents?.collect?.val ??
        consents?.consents?.['consent.default']?.collect?.val ??
        'Unavailable';

      setStatus({
        appId: appId || 'Not configured',
        coreVersion: coreVersion || 'Unavailable',
        lifecycleVersion: lifecycleVersion || 'Unavailable',
        privacyStatus: String(privacyStatus ?? PrivacyStatus.UNKNOWN),
        consentCollect: String(consentCollect),
        ecid: ecid || 'Unavailable',
        sdkIdentities: sdkIdentities ? JSON.stringify(sdkIdentities) : 'Unavailable',
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
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  return (
    <TechnicalScreen onBack={() => router.back()}>
        <ThemedText style={styles.welcome}>Setup</ThemedText>
        <ThemedText style={{ marginVertical: 12, color: theme.colors.text, fontSize: 14, textAlign: 'center' }}>
          Read-only setup diagnostics for the current app and Adobe SDK state.
        </ThemedText>
        <Button
          title={isRefreshing ? 'Refreshing...' : 'Refresh Setup Status'}
          onPress={refreshStatus}
          disabled={isRefreshing}
        />

        <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
          <SetupRow label="App Version" value={Constants.expoConfig?.version || 'Unknown'} themeText={theme.colors.text} />
          <SetupRow label="Android Package" value={Constants.expoConfig?.android?.package || 'N/A'} themeText={theme.colors.text} />
          <SetupRow label="iOS Bundle ID" value={Constants.expoConfig?.ios?.bundleIdentifier || 'N/A'} themeText={theme.colors.text} />
          <SetupRow label="Adobe App ID" value={status.appId} themeText={theme.colors.text} />
          <SetupRow label="MobileCore Version" value={status.coreVersion} themeText={theme.colors.text} />
          <SetupRow label="Lifecycle Version" value={status.lifecycleVersion} themeText={theme.colors.text} />
          <SetupRow label="Privacy Status" value={status.privacyStatus} themeText={theme.colors.text} />
          <SetupRow label="Consent Collect" value={status.consentCollect} themeText={theme.colors.text} />
          <SetupRow label="ECID" value={status.ecid} themeText={theme.colors.text} />
          <SetupRow label="SDK Identities" value={status.sdkIdentities} themeText={theme.colors.text} />
        </View>
    </TechnicalScreen>
  );
};

export default CoreView;
