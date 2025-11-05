import Clipboard from '@react-native-clipboard/clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';

import React, { useCallback, useState, useEffect } from 'react';
import { View, Button, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { ScrollableContainer } from '../../components/ScrollableContainer';
import { useTheme } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { Edge } from '@adobe/react-native-aepedge';
import { Identity, AuthenticatedState, IdentityMap, IdentityItem } from '@adobe/react-native-aepedgeidentity';
import { UserProfile } from '@adobe/react-native-aepuserprofile';
import { useProfileStorage } from '../../hooks/useProfileStorage';
import { buildPageViewEvent, buildLoginEvent, buildLogoutEvent } from '../../src/utils/xdmEventBuilders';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfileTab() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inputFirstName, setInputFirstName] = useState('');
  const [inputEmail, setInputEmail] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [error, setError] = useState('');
  const { colors } = useTheme();
  const [ecid, setEcid] = useState('');
  const [identityMap, setIdentityMap] = useState({});
  const { profile, setProfile } = useProfileStorage();
  //console.log('Profile Context:', { profile });

  // Initialize identityMap on component mount
  useEffect(() => {
    Identity.getIdentities().then((result) => {
      console.log('Profile - Raw identity result:', JSON.stringify(result, null, 2));
      if (result && result.identityMap) {
        setIdentityMap(result.identityMap);
      } else {
        setIdentityMap(result);
      }
    });

    // Also fetch ECID for display
    Identity.getExperienceCloudId().then(setEcid);
  }, []);

  // Restore login state if profile exists in storage
  useEffect(() => {
    if (profile.firstName && profile.email) {
      console.log('Restoring previous login session:', profile);
      setLoggedIn(true);
      setFirstName(profile.firstName);
      setEmail(profile.email);
    }
  }, [profile]);

  // Send page view when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const handleFocus = async () => {
        // Check if identityMap is ready
        if (!identityMap || Object.keys(identityMap).length === 0) {
          console.log('Profile - IdentityMap not ready, skipping page view');
          return;
        }

        // Get fresh profile from AsyncStorage
        let currentProfile = { firstName: '', email: '' };
        try {
          const storedProfile = await AsyncStorage.getItem('userProfile');
          if (storedProfile) {
            currentProfile = JSON.parse(storedProfile);
          }
        } catch (error) {
          console.error('Failed to read profile:', error);
        }

        // Send page view
        try {
          const pageViewEvent = await buildPageViewEvent({
            identityMap,
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
    }, [identityMap])
  );

  const handleLogin = async () => {
    if (!inputFirstName || !inputEmail || !inputPassword) {
      setError('Please fill in all fields.');
      return;
    }

    // Update local state
    setFirstName(inputFirstName);
    setEmail(inputEmail);
    setPassword(''); // Don't store password
    setLoggedIn(true);
    setError('');

    // Update user profile in AEP UserProfile extension
    UserProfile.updateUserAttributes({
      firstName: inputFirstName,
      email: inputEmail,
    });
    console.log('User profile updated in AEP');

    // Create an IdentityMap and add the email and ECID identities
    // ECID is primary (stable device identity), email is secondary (user identity)
    const newIdentityMap = new IdentityMap();
    const emailIdentity = new IdentityItem(inputEmail, AuthenticatedState.AUTHENTICATED, false);
    const ecidIdentity = new IdentityItem(ecid, AuthenticatedState.AUTHENTICATED, true);
    newIdentityMap.addItem(emailIdentity, 'Email');
    newIdentityMap.addItem(ecidIdentity, 'ECID');

    // Update identities in AEP
    Identity.updateIdentities(newIdentityMap);
    console.log('Email and ECID set as authenticated identities in AEP');

    // Save profile to AsyncStorage
    setProfile({ firstName: inputFirstName, email: inputEmail });
    console.log('Profile saved to AsyncStorage:', { firstName: inputFirstName, email: inputEmail });

    // Send login success event with updated identityMap
    try {
      // Fetch updated identityMap after setting authenticated identities
      const updatedIdentities = await Identity.getIdentities();
      const currentIdentityMap = updatedIdentities.identityMap || updatedIdentities;

      const loginEvent = await buildLoginEvent({
        identityMap: currentIdentityMap,
        profile: { firstName: inputFirstName, email: inputEmail },
        success: true,
        method: 'basic'
      });

      console.log('📤 Sending login success event');
      await Edge.sendEvent(loginEvent);
      
      console.log('✅ Login event sent successfully:', {
        participantName: inputFirstName,
        email: inputEmail,
        loginStatus: 'logged_in'
      });

      // Update local identityMap state
      setIdentityMap(currentIdentityMap);
    } catch (error) {
      console.error('❌ Error sending login event:', error);
    }
  };

  const handleLogout = async () => {
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

    // Clear local state
    setLoggedIn(false);
    setFirstName('');
    setEmail('');
    setInputFirstName('');
    setInputEmail('');
    setInputPassword('');
    setError('');

    // Clear profile from AsyncStorage
    setProfile({ firstName: '', email: '' });
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
            <Button title="Log Out" onPress={handleLogout} />
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
            {error ? <ThemedText style={{ color: 'red', marginBottom: 12 }}>{error}</ThemedText> : null}
            <Button title="Log In" onPress={handleLogin} />
          </>
        )}
      </View>
      </ScrollableContainer>
    </SafeAreaView>
  );
}
