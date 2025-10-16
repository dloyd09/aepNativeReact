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
import { View, Button, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from 'expo-router';
import styles from '@/styles/styles';

type NavigationProps = {
  navigate: (screen: string) => void;
};

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProps>();
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={localStyles.buttonContainer}>
        <Button onPress={() => navigation.navigate('(techScreens)/AppIdConfigView')} title="AppIdConfigView" />
        <Button onPress={() => navigation.navigate('(techScreens)/CoreView')} title="Core/Lifecycle/Signal" />
        <Button onPress={() => navigation.navigate('(techScreens)/ProfileView')} title="UserProfile" />
        <Button onPress={() => navigation.navigate('(techScreens)/IdentityView')} title="Identity" />
        <Button onPress={() => navigation.navigate('(techScreens)/MessagingView')} title="Messaging" />
        <Button onPress={() => navigation.navigate('(techScreens)/OptimizeView')} title="Optimize" />
        <Button onPress={() => navigation.navigate('(techScreens)/EdgeView')} title="Edge" />
        <Button onPress={() => navigation.navigate('(techScreens)/EdgeIdentityView')} title="EdgeIdentity" />
        <Button onPress={() => navigation.navigate('(techScreens)/ConsentView')} title="Consent" />
        <Button onPress={() => navigation.navigate('(techScreens)/EdgeBridgeView')} title="Edge Bridge" />
        <Button onPress={() => navigation.navigate('(techScreens)/AssuranceView')} title="Assurance" />
        <Button onPress={() => navigation.navigate('(techScreens)/TargetView')} title="Target" />
        <Button onPress={() => navigation.navigate('(techScreens)/PlacesView')} title="Places" />
        <Button onPress={() => navigation.navigate('(techScreens)/PushNotificationView')} title="Push Notifications" />
        <Button onPress={() => navigation.navigate('(techScreens)/DecisioningItemsView')} title="AJO-Decisioning Items" />
      </View>
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 20,
    gap: 10,
  },
});