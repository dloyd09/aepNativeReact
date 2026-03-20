/*
Copyright 2024 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import React, { useState } from 'react';
import {Button, View, ScrollView} from 'react-native';
import {MobileCore} from '@adobe/react-native-aepcore';
import {Messaging} from '@adobe/react-native-aepmessaging'
import styles from '../../styles/styles';
import { useRouter } from 'expo-router';
import { TechnicalScreen } from '../../components/TechnicalScreen';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '@react-navigation/native';

const SURFACES = ['android-cb-preview'];

// Content Card Event Listener Implementation
// Note: Content card methods are not yet available in the current Messaging extension version
// This structure is prepared for when content card functionality becomes available
const contentCardEventListener = {
  onDisplay: (aepUI: any) => {
    console.log('ContentCardCallback: onDisplay', aepUI);
  },
  
  onDismiss: (aepUI: any) => {
    console.log('ContentCardCallback: onDismiss', aepUI);
  },
  
  onInteract: (aepUI: any, interactionId: string | null, actionUrl: string | null): boolean => {
    console.log('ContentCardCallback: onInteract', { interactionId, actionUrl });
    
    // Handle actionable URLs
    if (actionUrl) {
      console.log('Handling action URL:', actionUrl);
      // Add your custom URL handling logic here
      // For example: open URL in browser, navigate to specific screen, etc.
      return true; // Return true if you handled the URL
    }
    
    return false; // Return false to let SDK handle the URL
  }
};

const messagingExtensionVersion = async (setLog: (msg: string) => void) => {
  const version = await Messaging.extensionVersion();
  const msg = `AdobeExperienceSDK: Messaging version: ${version}`;
  console.log(msg);
  setLog(msg);
};

const refreshInAppMessages = () => {
  Messaging.refreshInAppMessages();
  console.log('messages refreshed');
};

const setMessagingDelegate = () => {
  Messaging.setMessagingDelegate({
    onDismiss: msg => console.log('dismissed!', msg),
    onShow: msg => console.log('show', msg),
    shouldShowMessage: () => true,
    shouldSaveMessage: () => true,
    urlLoaded: (url, message) => console.log(url, message),
  });
  console.log('messaging delegate set');
};

const getPropositionsForSurfaces = async () => {
  const messages = await Messaging.getPropositionsForSurfaces(SURFACES);
  console.log(JSON.stringify(messages));
};

const trackAction = async () => {
  MobileCore.trackAction('tuesday', {full: true});
};

const updatePropositionsForSurfaces = async () => {
  Messaging.updatePropositionsForSurfaces(SURFACES);
  console.log('Updated Propositions');
};

const getCachedMessages = async () => {
  const messages = await Messaging.getCachedMessages();
  console.log('Cached messages:', messages);
};

const getLatestMessage = async () => {
  const message = await Messaging.getLatestMessage();
  console.log('Latest Message:', message);
};

// Content Card Functions (Not yet available in current version)
const setContentCardEventListener = () => {
  console.log('Content card event listener functionality not yet available in current Messaging extension version');
  console.log('Event listener structure prepared:', contentCardEventListener);
};

const getContentCards = async () => {
  console.log('getContentCards() not yet available in current Messaging extension version');
};

const refreshContentCards = async () => {
  console.log('refreshContentCards() not yet available in current Messaging extension version');
};

const getContentCardUI = async () => {
  console.log('getContentCardUI() not yet available in current Messaging extension version');
};

function MessagingView() {
  const router = useRouter();
  const [log, setLog] = useState('');
  const theme = useTheme();

  return (
    <TechnicalScreen onBack={router.back}>
        <ThemedText style={styles.welcome}>Messaging</ThemedText>
        
        {/* Existing Messaging Functions */}
        <ThemedText style={{ marginTop: 16, color: theme.colors.text, fontSize: 16, fontWeight: 'bold' }}>
          Core Messaging Functions
        </ThemedText>
        <Button title="extensionVersion()" onPress={() => messagingExtensionVersion(setLog)} />
        <Button title="refreshInAppMessages()" onPress={refreshInAppMessages} />
        <Button title="setMessagingDelegate()" onPress={setMessagingDelegate} />
        <Button
          title="getPropositionsForSurfaces()"
          onPress={getPropositionsForSurfaces}
        />
        <Button
          title="updatePropositionsForSurfaces()"
          onPress={updatePropositionsForSurfaces}
        />
        <Button title="getCachedMessages()" onPress={getCachedMessages} />
        <Button title="getLatestMessage()" onPress={getLatestMessage} />
        <Button title="trackAction()" onPress={trackAction} />
        
        {/* Content Card Functions */}
        <ThemedText style={{ marginTop: 24, color: theme.colors.text, fontSize: 16, fontWeight: 'bold' }}>
          Content Card Functions
        </ThemedText>
        <Button title="setContentCardEventListener()" onPress={setContentCardEventListener} />
        <Button title="getContentCards()" onPress={getContentCards} />
        <Button title="refreshContentCards()" onPress={refreshContentCards} />
        <Button title="getContentCardUI()" onPress={getContentCardUI} />
        
        {log ? (
          <ThemedText style={{ marginTop: 24, color: theme.colors.text, fontSize: 16, textAlign: 'center' }}>{log}</ThemedText>
        ) : null}
    </TechnicalScreen>
  );
}

export default MessagingView;
