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

import React, {useState} from 'react';
import {Button, View, ScrollView} from 'react-native';
import {Consent} from '@adobe/react-native-aepedgeconsent';
import {MobileCore} from '@adobe/react-native-aepcore';
import styles from '../../styles/styles';
import {  useRouter } from 'expo-router';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '@react-navigation/native';

function updateCollectConsent(allowed: boolean) {
  var collectConsentStatus = allowed ? {val: 'y'} : {val: 'n'};

  var consents: {[keys: string]: any} = {
    consents: {collect: collectConsentStatus},
  };
  Consent.update(consents);
  console.log(
    'AdobeExperienceSDK: Consent.update called with:  ' +
      JSON.stringify(consents),
  );
}

function setDefaultConsent(allowed: boolean) {
  var collectConsentStatus = allowed ? {val: 'y'} : {val: 'n'};
  var defaultConsents: {[keys: string]: any} = {
    'consent.default': {consents: {collect: collectConsentStatus}},
  };
  MobileCore.updateConfiguration(defaultConsents);
}

const ConsentView = () => {
  const [version, setVersion] = useState('');
  const [consents, setConsents] = useState('');
  Consent.extensionVersion().then(version => setVersion(version));
  const router = useRouter();
  const theme = useTheme();

  function getConsents() {
    var consents = {consents: {collect: {val: 'n'}}};
    Consent.getConsents()
      .then(currentConsents => {
        let consentsStr = JSON.stringify(currentConsents);
        setConsents(consentsStr);
        console.log(
          'AdobeExperienceSDK: Consent.getConsents returned current consent preferences:  ' +
            consentsStr,
        );
      })
      .catch(error => {
        console.warn(
          'AdobeExperienceSDK: Consent.getConsents returned error: ',
          error,
        );
      });
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={{marginTop: 75}}>
        <Button onPress={router.back} title="Go to main page" />
        <ThemedText style={styles.welcome}>Consent v{version}</ThemedText>
        <Button
          title="Set Default Consent - Yes"
          onPress={() => setDefaultConsent(true)}
        />
        <Button
          title="Set Collect Consent - Yes"
          onPress={() => updateCollectConsent(true)}
        />
        <Button
          title="Set Collect Consent - No"
          onPress={() => updateCollectConsent(false)}
        />
        <Button title="Get Consents" onPress={getConsents} />
        <View style={styles.breakLine} />
        <ThemedText style={styles.text}>{consents}</ThemedText>
      </ScrollView>
    </ThemedView>
  );
};

export default ConsentView;
