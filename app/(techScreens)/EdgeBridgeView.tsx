/*
Copyright 2023 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import React, {useState} from 'react';
import {Button, View, ScrollView} from 'react-native';
import {EdgeBridge} from '@adobe/react-native-aepedgebridge';
import {MobileCore} from '@adobe/react-native-aepcore';
import styles from '../../styles/styles';
import {  useRouter } from 'expo-router';
import { TechnicalScreen } from '../../components/TechnicalScreen';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '@react-navigation/native';


const EdgeBridgeView = () => {
  const [version, setVersion] = useState('');
  EdgeBridge.extensionVersion().then(version => setVersion(version));

  const router = useRouter();

function trackAction() {
  MobileCore.trackAction("purchase", {
    "&&products": ";Running Shoes;1;69.95;event1|event2=55.99;eVar1=12345,;Running Socks;10;29.99;event2=10.95;eVar1=54321",
    "cart.totalValue": "99.90",
    "cart.itemCount": "2",
    "user.id": "user123",
    "timestamp": new Date().toISOString()
  });
}

function trackState() {
  MobileCore.trackState("products/189025/runningshoes/12345", {
    "&&products": ";Running Shoes;1;69.95;prodView|event2=55.99;eVar1=12345",
    "view.name": "Product Detail",
    "navigation.previousView": "Home",
    "user.id": "user123",
    "timestamp": new Date().toISOString()
  });
}

  return (
    <TechnicalScreen onBack={router.back}>
        <ThemedText style={styles.welcome}>Edge Bridge v{version}</ThemedText>

        {/* item 5.4: EdgeBridge context — explain what this extension does and why
            it is registered but idle in this app, so students aren't confused. */}
        <ThemedText style={{ marginTop: 16, marginBottom: 8, fontWeight: 'bold' }}>
          What is Edge Bridge?
        </ThemedText>
        <ThemedText style={{ marginBottom: 12, fontSize: 13, opacity: 0.85 }}>
          Edge Bridge lets existing apps that use{' '}
          <ThemedText style={{ fontFamily: 'monospace' }}>MobileCore.trackAction()</ThemedText> and{' '}
          <ThemedText style={{ fontFamily: 'monospace' }}>MobileCore.trackState()</ThemedText> send
          those legacy Analytics calls to the Edge Network without rewriting them as XDM events.
          It acts as a translation layer during migrations.
        </ThemedText>
        <ThemedText style={{ marginBottom: 8, fontWeight: 'bold' }}>
          Why is it idle in this app?
        </ThemedText>
        <ThemedText style={{ marginBottom: 12, fontSize: 13, opacity: 0.85 }}>
          This app uses native Edge XDM events directly (
          <ThemedText style={{ fontFamily: 'monospace' }}>Edge.sendEvent()</ThemedText>
          ), which is the recommended modern pattern. Edge Bridge is registered here as a
          reference — if you were migrating a legacy Analytics app, you would activate it
          by configuring the Edge Bridge extension in your Launch tag property.
        </ThemedText>
        <ThemedText style={{ marginBottom: 16, fontWeight: 'bold' }}>
          Demo buttons below (fires bridge calls):
        </ThemedText>

        <Button title="MobileCore.trackAction()" onPress={trackAction} />
        <Button title="MobileCore.trackState()" onPress={trackState} />
    </TechnicalScreen>
  );
};

export default EdgeBridgeView;
