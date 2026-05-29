import Clipboard from '@react-native-clipboard/clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';

import React, { useCallback, useState, useEffect } from 'react';
import { View, Button, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '../../components/ThemedText';
import { ScrollableContainer } from '../../components/ScrollableContainer';
import { useTheme } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { Edge } from '@adobe/react-native-aepedge';
import { Identity, AuthenticatedState, IdentityMap, IdentityItem } from '@adobe/react-native-aepedgeidentity';
import { UserProfile } from '@adobe/react-native-aepuserprofile';
import { useProfile } from '../../components/ProfileContext';
import { buildPageViewEvent, buildLoginEvent, buildLogoutEvent } from '../../src/utils/xdmEventBuilders';
import { isAdobeConfigured } from '../../src/utils/adobeConfig';

export default function ProfileTab() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [inputFirstName, setInputFirstName] = useState('');
  const [inputEmail, setInputEmail] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [error, setError] = useState('');
  const { colors } = useTheme();
  const [ecid, setEcid] = useState('');
  const [identityMap, setIdentityMap] = useState({});
  const [isLoginPending, setIsLoginPending] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sdkInitTimedOut, setSdkInitTimedOut] = useState(false);
  const { profile, saveProfile, getProfile } = useProfile();
  //console.log('Profile Context:', { profile });

  const refreshIdentityState = useCallback(async () => {
    try {
      if (!(await isAdobeConfigured())) {
        setIdentityMap({});
        setEcid('');
        return {};
      }

      const result = await Identity.getIdentities();
      console.log('Profile - Raw identity result:', JSON.stringify(result, null, 2));

      const currentIdentityMap = result?.identityMap || result || {};
      setIdentityMap(currentIdentityMap);

      const currentEcid = await Identity.getExperienceCloudId();
      setEcid(currentEcid || currentIdentityMap?.ECID?.[0]?.id || '');

      return currentIdentityMap;
    } catch (identityError) {
      console.error('Profile - Failed to refresh identities:', identityError);
      setIdentityMap({});
      setEcid('');
      return {};
    }
  }, []);

  useEffect(() => {
    refreshIdentityState();
  }, [refreshIdentityState]);

  // Restore login state if profile exists in storage
  useEffect(() => {
    if (profile.firstName && profile.email) {
      console.log('Restoring previous login session:', profile);
      setLoggedIn(true);
      setFirstName(profile.firstName);
      setEmail(profile.email);
      refreshIdentityState(); // item 3.4: ensure ECID/identityMap are in sync on restore
    }
  }, [profile, refreshIdentityState]);

  // Block login until ECID arrives. After 10 s with no ECID, unblock with a warning
  // so students are not permanently stuck if SDK init failed silently (item 3.2).
  useEffect(() => {
    if (ecid) return;
    const timer = setTimeout(() => setSdkInitTimedOut(true), 10000);
    return () => clearTimeout(timer);
  }, [ecid]);

  // Send page view when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const handleFocus = async () => {
        const currentIdentityMap = await refreshIdentityState();

        // Check if identityMap is ready
        if (!currentIdentityMap || Object.keys(currentIdentityMap).length === 0) {
          console.log('Profile - IdentityMap not ready, skipping page view');
          return;
        }

        const currentProfile = getProfile();

        // Send page view
        try {
          const pageViewEvent = await buildPageViewEvent({
            identityMap: currentIdentityMap,
            profile: currentProfile,
            pageTitle: 'Profile',
            pagePath: '/profile',
            pageType: 'profile'
          });

          console.log('📤 Sending profile page view event');
          await Edge.sendEvent(pageViewEvent);
          
          console.log('✅ Profile page view sent successfully:', {
            participantName: currentProfile?.firstName || 'Guest User',
            loginStatus: currentProfile?.firstName ? 'logged_in' : 'guest'
          });
        } catch (error) {
          console.error('❌ Error sending profile page view:', error);
        }
      };

      handleFocus();
    }, [refreshIdentityState, getProfile])
  );

  const handleLogin = async () => {
    if (!inputFirstName || !inputEmail || !inputPassword) {
      setError('Please fill in all fields.');
      return;
    }

    // item 3.1: show loading state while async chain runs — UI stays on login form
    // until ECID and identityMap are confirmed populated.
    setIsLoginPending(true);
    setError('');

    // AEP's Email namespace is case-sensitive: 'Dtboards09@gmail.com' and
    // 'dtboards09@gmail.com' anchor two separate identity graphs that never merge,
    // fragmenting the profile and stranding push tokens on the wrong cluster.
    // Normalize once here (lowercase + trim) and use this canonical value for the
    // identity, profile storage, attributes, and the login event so every downstream
    // consumer agrees. Mirrors hashEmail()'s normalization in identityHelpers.ts.
    // See docs/Push-Platform-Collision-APNS-vs-FCM.md.
    const normalizedEmail = inputEmail.trim().toLowerCase();

    try {
      // item 10.2: await the UserProfile call so failures are visible in Assurance logs
      try {
        await UserProfile.updateUserAttributes({
          firstName: inputFirstName,
          email: normalizedEmail,
        });
        console.log('User profile updated in AEP');
      } catch (profileError) {
        console.warn('[Profile] UserProfile.updateUserAttributes failed:', profileError);
      }

      // Create an IdentityMap and add the email and ECID identities
      // ECID is primary (stable device identity), email is secondary (user identity)
      const currentEcid = ecid || await Identity.getExperienceCloudId();
      setEcid(currentEcid || '');

      const newIdentityMap = new IdentityMap();
      const emailIdentity = new IdentityItem(normalizedEmail, AuthenticatedState.AUTHENTICATED, false);
      newIdentityMap.addItem(emailIdentity, 'Email');
      if (currentEcid) {
        const ecidIdentity = new IdentityItem(currentEcid, AuthenticatedState.AUTHENTICATED, true);
        newIdentityMap.addItem(ecidIdentity, 'ECID');
      }

      // Update identities in AEP
      await Identity.updateIdentities(newIdentityMap);
      console.log('Email and ECID set as authenticated identities in AEP');

      saveProfile({ firstName: inputFirstName, email: normalizedEmail });
      console.log('Profile saved to ProfileContext:', { firstName: inputFirstName, email: normalizedEmail });

      // Send login success event with updated identityMap
      try {
        // Fetch updated identityMap after setting authenticated identities
        const updatedIdentities = await Identity.getIdentities();
        const currentIdentityMap = updatedIdentities.identityMap || updatedIdentities;

        const loginEvent = await buildLoginEvent({
          identityMap: currentIdentityMap,
          profile: { firstName: inputFirstName, email: normalizedEmail },
          success: true,
          method: 'basic'
        });

        console.log('📤 Sending login success event');
        await Edge.sendEvent(loginEvent);

        console.log('✅ Login event sent successfully:', {
          participantName: inputFirstName,
          email: normalizedEmail,
          loginStatus: 'logged_in'
        });

        // Update local identityMap state
        setIdentityMap(currentIdentityMap);
        setEcid(currentIdentityMap?.ECID?.[0]?.id || currentEcid || '');

        // Re-sync the current push token now that the authenticated Email identity
        // is attached. registerTokenWithAdobe polls ECID inline, so there is no
        // longer a deferred-token queue to drain (the old retryPendingPushToken
        // machinery was removed); re-registering here ensures the push profile
        // event lands while the authenticated identityMap is active, which helps
        // the token attach to the logged-in profile rather than an anonymous one.
        // See docs/Push-Platform-Collision-APNS-vs-FCM.md.
        try {
          const { pushNotificationService } = require('../../src/utils/pushNotifications');
          await pushNotificationService.registerCurrentTokenWithAdobe();
        } catch (syncError) {
          console.log('[Push] token re-sync skipped at login time:', syncError);
        }
      } catch (error) {
        console.error('❌ Error sending login event:', error);
      }

      // item 3.1: switch to logged-in view only after ECID and identityMap are populated
      setFirstName(inputFirstName);
      setEmail(normalizedEmail);
      setLoggedIn(true);

    } catch (error) {
      console.error('❌ Error during login:', error);
      setError('Login failed. Please try again.');
    } finally {
      setIsLoginPending(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true); // item 3.3: disable button immediately so students don't double-tap
    const currentEmail = email;
    const currentEcid = ecid;
    // Send logout event BEFORE clearing state
    try {
      const logoutEvent = await buildLogoutEvent({
        identityMap,
        profile: { firstName, email }
      });

      console.log('📤 Sending logout event');
      await Edge.sendEvent(logoutEvent);
      
      console.log('✅ Logout event sent successfully');
    } catch (error) {
      console.error('❌ Error sending logout event:', error);
    }

    try {
      await UserProfile.removeUserAttributes(['firstName', 'email']);
      console.log('User profile removed from AEP');
    } catch (profileError) {
      console.error('Failed to clear AEP user profile:', profileError);
    }

    try {
      if (currentEmail) {
        const emailIdentity = new IdentityItem(currentEmail);
        await Identity.removeIdentity(emailIdentity, 'Email');
        console.log('Email identity removed from AEP');
      }
    } catch (identityError) {
      console.error('Failed to remove AEP email identity:', identityError);
    }

    // Clear local state
    setLoggedIn(false);
    setFirstName('');
    setEmail('');
    setInputFirstName('');
    setInputEmail('');
    setInputPassword('');
    setError('');

    saveProfile({ firstName: '', email: '' });
    setIdentityMap(currentEcid ? { ECID: [{ id: currentEcid }] } : {});
    setEcid(currentEcid || '');
    console.log('User logged out and profile cleared');
  };

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
    //console.log('Text copied to clipboard:', text);
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <ScrollableContainer contentContainerStyle={{ justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
      <Ionicons name="person" size={48} color={colors.primary} />
      <ThemedText type="title" style={{ marginTop: 12 }}>Profile</ThemedText>
      <View style={{ marginTop: 24, width: '80%' }}>
        {loggedIn ? (
          <>
            <ThemedText style={{ marginBottom: 12 }}>Welcome, {firstName}!</ThemedText>
            <ThemedText style={{ marginBottom: 12 }}>Email: {email}</ThemedText>
            <ThemedText style={{ marginBottom: 12 }}>ECID: {ecid}</ThemedText>
            <ThemedText style={{ marginBottom: 12 }}>Identity Map: {JSON.stringify(identityMap)}</ThemedText>
            <Button title="Copy Identity Map" onPress={() => copyToClipboard(JSON.stringify(identityMap))} />
            <Button title={isLoggingOut ? 'Logging out...' : 'Log Out'} onPress={handleLogout} disabled={isLoggingOut} />
          </>
        ) : (
          <>
            <TextInput
              placeholder="First Name"
              value={inputFirstName}
              onChangeText={setInputFirstName}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8, marginBottom: 12, backgroundColor: colors.card, color: colors.text }}
              placeholderTextColor={colors.text + '99'}
              autoCapitalize="words"
            />
            <TextInput
              placeholder="Email Address"
              value={inputEmail}
              onChangeText={setInputEmail}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8, marginBottom: 12, backgroundColor: colors.card, color: colors.text }}
              placeholderTextColor={colors.text + '99'}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              placeholder="Password"
              value={inputPassword}
              onChangeText={setInputPassword}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8, marginBottom: 12, backgroundColor: colors.card, color: colors.text }}
              placeholderTextColor={colors.text + '99'}
              secureTextEntry
            />
            {!ecid && !sdkInitTimedOut && (
              <ThemedText style={{ color: colors.text + '99', marginBottom: 8, fontSize: 12 }}>
                Adobe SDK initializing...
              </ThemedText>
            )}
            {sdkInitTimedOut && !ecid && (
              <ThemedText style={{ color: 'orange', marginBottom: 8, fontSize: 12 }}>
                Adobe SDK may not be fully initialized. Check your App ID configuration.
              </ThemedText>
            )}
            {error ? <ThemedText style={{ color: 'red', marginBottom: 12 }}>{error}</ThemedText> : null}
            <Button
              title={isLoginPending ? 'Logging in...' : 'Log In'}
              onPress={handleLogin}
              disabled={isLoginPending || (!ecid && !sdkInitTimedOut)}
            />
          </>
        )}
      </View>
      </ScrollableContainer>
    </SafeAreaView>
  );
}
