/*
Copyright 2022 Adobe. All rights reserved.
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
import {
  MobileCore,
  Lifecycle,
  Signal,
  Event,
  Identity,
  LogLevel,
  PrivacyStatus,
} from '@adobe/react-native-aepcore';
import styles from '../../styles/styles';
import {NavigationProps} from '../../types/props';

import { Stack, useRouter } from 'expo-router';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '@react-navigation/native';
import Constants from 'expo-constants';


function trackAction() {
  MobileCore.trackAction('action name', {key: 'value'});
}

function trackState() {
  MobileCore.trackState('state name', {key: 'value'});
}

function setPushIdentifier() {
  MobileCore.setPushIdentifier('xxx');
}

function collectPii() {
  MobileCore.collectPii({myPii: 'data'});
}

function dispatchEvent() {
  var event = new Event('eventName', 'eventType', 'eventSource', {
    testDataKey: 'testDataValue',
  });
  MobileCore.dispatchEvent(event);
}

function dispatchEventWithResponseCallback() {
  var event = new Event('eventName', 'eventType', 'eventSource', {
    testDataKey: 'testDataValue',
  });
  MobileCore.dispatchEventWithResponseCallback(event, 1500).then(responseEvent =>
    console.log('AdobeExperienceSDK: responseEvent = ' + responseEvent),
  );
}

function setAdvertisingIdentifier() {
  MobileCore.setAdvertisingIdentifier('adID');
}
function getSdkIdentities(setLog: (msg: string) => void) {
  MobileCore.getSdkIdentities().then(identities => {
    const msg = 'AdobeExperienceSDK: Identities = ' + identities;
    console.log(msg);
    setLog(msg);
  });
}

function updateConfiguration() {
  MobileCore.updateConfiguration({'global.privacy': 'optedin'});
}

function clearUpdatedConfiguration() {
  MobileCore.clearUpdatedConfiguration();
}

function getLogLevel(setLog: (msg: string) => void) {
  MobileCore.getLogLevel().then(level => {
    const msg = 'AdobeExperienceSDK: Log Level = ' + level;
    console.log(msg);
    setLog(msg);
  });
}

function setLogLevel() {
  MobileCore.setLogLevel(LogLevel.VERBOSE);
}

function lifecycleExtensionVersion(setLog: (msg: string) => void) {
  Lifecycle.extensionVersion().then(version => {
    const msg = 'AdobeExperienceSDK: Lifecycle version: ' + version;
    console.log(msg);
    setLog(msg);
  });
}

function identityExtensionVersion() {
  Identity.extensionVersion().then(version =>
    console.log('AdobeExperienceSDK: Identity version: ' + version),
  );
}

function signalExtensionVersion(setLog: (msg: string) => void) {
  Signal.extensionVersion().then(version => {
    const msg = 'AdobeExperienceSDK: Signal version: ' + version;
    console.log(msg);
    setLog(msg);
  });
}

function coreExtensionVersion(setLog: (msg: string) => void) {
  MobileCore.extensionVersion().then(version => {
    const msg = 'AdobeExperienceSDK: MobileCore version: ' + version;
    console.log(msg);
    setLog(msg);
  });
}

function setPrivacyOptIn() {
  MobileCore.setPrivacyStatus(PrivacyStatus.OPT_OUT);
}

function getPrivacyStatus(setLog: (msg: string) => void) {
  MobileCore.getPrivacyStatus().then(status => {
    const msg = 'AdobeExperienceSDK: Privacy Status = ' + status;
    console.log(msg);
    setLog(msg);
  });
}

function resetIdentities() {
  MobileCore.resetIdentities();
}

const CoreView = () => {
  const router = useRouter();
  const [log, setLog] = useState('');
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={{marginTop: 75, paddingBottom: 100}}>
        <Button onPress={() => router.back()} title="Go to main page" />
        <ThemedText style={styles.welcome}>Core</ThemedText>
        <ThemedText style={{ marginVertical: 12, color: theme.colors.text, fontSize: 14, textAlign: 'center' }}>
          App Version: {Constants.expoConfig?.version || 'Unknown'}
        </ThemedText>
        <Button title="extensionVersion()" onPress={() => coreExtensionVersion(setLog)} />
        <Button title="updateConfiguration" onPress={updateConfiguration} />
        <Button title="clearUpdatedConfiguration" onPress={clearUpdatedConfiguration} />
        <Button title="setPrivacyStatus(OptIn)" onPress={setPrivacyOptIn} />
        <Button title="getPrivacyStatus()" onPress={() => getPrivacyStatus(setLog)} />
        <Button title="setLogLevel(LogLevel.VERBOSE)" onPress={setLogLevel} />
        <Button title="getLogLevel()" onPress={() => getLogLevel(setLog)} />
        <Button title="setPushIdentifier()" onPress={setPushIdentifier} />
        <Button
          title="setAdvertisingIdentifier()"
          onPress={setAdvertisingIdentifier}
        />
        <Button title="getSdkIdentities()" onPress={() => getSdkIdentities(setLog)} />
        <Button title="collectPii()" onPress={collectPii} />
        <Button title="trackAction()" onPress={trackAction} />
        <Button title="trackState()" onPress={trackState} />
        <Button title="dispatchEvent()" onPress={dispatchEvent} />
        <Button
          title="dispatchEventWithResponseCallback()"
          onPress={dispatchEventWithResponseCallback}
        />
        <Button title="resetIdentities()" onPress={resetIdentities} />
        <ThemedText style={styles.welcome}>Lifecycle</ThemedText>
        <Button
          title="Lifecycle::extensionVersion()"
          onPress={() => lifecycleExtensionVersion(setLog)}
        />
        <ThemedText style={styles.welcome}>Signal</ThemedText>
        <Button
          title="Signal::extensionVersion()"
          onPress={() => signalExtensionVersion(setLog)}
        />
        {log ? (
          <ThemedText style={{ marginTop: 24, color: theme.colors.text, fontSize: 16, textAlign: 'center' }}>{log}</ThemedText>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
};

export default CoreView;
