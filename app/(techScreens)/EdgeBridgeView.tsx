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
        <Button title="MobileCore.trackAction()" onPress={trackAction} />
        <Button title="MobileCore.trackState()" onPress={trackState} />
    </TechnicalScreen>
  );
};

export default EdgeBridgeView;
