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
import {
  AuthenticatedState,
  Identity,
  IdentityItem,
  IdentityMap,
} from '@adobe/react-native-aepedgeidentity';
import styles from '../../styles/styles';
import {NavigationProps} from '../../types/props';
import { useRouter } from 'expo-router';
import { TechnicalScreen } from '../../components/TechnicalScreen';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '@react-navigation/native';

function updateIdentities() {
  var namespace1 = 'namespace1';
  var item1 = new IdentityItem('id1', AuthenticatedState.AUTHENTICATED, false);
  var item2 = new IdentityItem('id2');

  var map = new IdentityMap();
  map.addItem(item1, namespace1);
  map.addItem(item2, namespace1);
  console.log('sample app - update identity');
  Identity.updateIdentities(map);
}

function removeIdentity() {
  let namespace = 'namespace1';
  let item1 = new IdentityItem('id1');

  console.log('sample app - removeIdentity');
  Identity.removeIdentity(item1, namespace);
}

const EdgeIdentityView = ({navigation}: NavigationProps) => {
  const [version, setVersion] = useState('');
  const [identities, setIdentities] = useState('');
  const [ecid, setECID] = useState('');
  const [urlvariables, setUrlVariables] = useState('');
  Identity.extensionVersion().then(version => setVersion(version));

  function getIdentities() {
    Identity.getIdentities()
      .then(currentIdentity => {
        let identitiesStr = JSON.stringify(currentIdentity);
        setIdentities(identitiesStr);
        console.log(
          'AdobeExperienceSDK: Identity.getIdentities ' + identitiesStr,
        );
      })
      .catch(error => {
        console.warn(
          'AdobeExperienceSDK: Identity.getIdentities returned error: ',
          error,
        );
      });
  }

  function getExperienceCloudId() {
    Identity.getExperienceCloudId()
      .then(experienceCloudId => {
        setECID(experienceCloudId);
        console.log('AdobeExperienceSDK: ECID = ' + experienceCloudId);
      })
      .catch(error => {
        console.warn('AdobeExperienceSDK: ECID returned error: ', error);
      });
  }

  function getUrlVariables() {
    Identity.getUrlVariables()
      .then(urlVariables => {
        setUrlVariables(urlVariables);
        console.log('AdobeExperienceSDK: urlVariables = ' + urlVariables);
      })
  }
  const router = useRouter();

  return (
    <TechnicalScreen onBack={() => router.back()}>
        <ThemedText style={styles.welcome}>EdgeIdentity v{version}</ThemedText>
        <Button title="getExperienceCloudId()" onPress={getExperienceCloudId} />
        <Button title="updateIdentities()" onPress={updateIdentities} />
        <Button title="removeIdentity()" onPress={removeIdentity} />
        <Button title="getIdentities()" onPress={getIdentities} />
        <Button title="getUrlVariables()" onPress={getUrlVariables} />
        <View style={styles.breakLine} />
        <ThemedText>{identities}</ThemedText>
        <ThemedText>{ecid}</ThemedText>
        <ThemedText>{urlvariables}</ThemedText>
    </TechnicalScreen>
  );
};

export default EdgeIdentityView;
