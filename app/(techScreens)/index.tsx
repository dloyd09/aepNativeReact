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

import React from 'react';
import { View, Button, StyleSheet } from 'react-native';
import { useNavigation } from 'expo-router';
import { TechnicalScreen } from '@/components/TechnicalScreen';
import { ThemedText } from '@/components/ThemedText';

type NavigationProps = {
  navigate: (screen: string) => void;
};

export default function TechnicalHomeScreen() {
  const navigation = useNavigation<NavigationProps>();

  return (
    <TechnicalScreen showBackButton={false} contentContainerStyle={{ paddingVertical: 24 }}>
      <View style={localStyles.buttonContainer}>
        <ThemedText style={localStyles.sectionTitle}>Primary Diagnostics</ThemedText>
        <ThemedText style={localStyles.sectionBody}>
          These screens reflect the supported operational path for this app.
        </ThemedText>
        <Button onPress={() => navigation.navigate('(techScreens)/CoreView')} title="Setup" />
        <Button onPress={() => navigation.navigate('(techScreens)/AssuranceView')} title="Assurance" />
        <Button onPress={() => navigation.navigate('(techScreens)/PushNotificationView')} title="Push" />
        <Button onPress={() => navigation.navigate('(techScreens)/DecisioningItemsView')} title="Decisioning" />

        <ThemedText style={localStyles.sectionTitle}>Configuration</ThemedText>
        <ThemedText style={localStyles.sectionBody}>
          Use this when you need to update the Adobe Launch App ID stored on the device.
        </ThemedText>
        <Button onPress={() => navigation.navigate('(techScreens)/AppIdConfigView')} title="App ID Configuration" />
      </View>
    </TechnicalScreen>
  );
}

const localStyles = StyleSheet.create({
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 20,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 20,
    marginTop: 16,
    fontWeight: '600',
    textAlign: 'left',
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
    textAlign: 'left',
    marginBottom: 4,
  },
});
