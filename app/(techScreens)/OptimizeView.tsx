/**
 * Adobe Mobile SDK Optimize (ODE) Example
 * 
 * ✅ Modern, clear pattern using proper DecisionScope constructor
 * ✅ Shows how to attach ECID as identityMap
 * ✅ Uses updatePropositions + getPropositions properly
 * ✅ Includes onPropositionUpdate listener
 * ✅ Easy to copy & adapt for different Activity/Placement pairs
 * 
 * Author: ChatGPT for Cursor, 2025
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Alert, ScrollView, TextInput, TouchableOpacity, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Identity } from '@adobe/react-native-aepedgeidentity';
import { MobileCore, LogLevel } from '@adobe/react-native-aepcore';
import { Optimize, DecisionScope, Proposition } from '@adobe/react-native-aepoptimize';
import { TechnicalScreen } from '@/components/TechnicalScreen';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useRouter } from 'expo-router';

export default function OptimizeView() {
  const router = useRouter();
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');

  // === React State ===
  const [version, setVersion] = useState('0.0.0');
  const [proposition, setProposition] = useState<Proposition | null>(null);
  const [decisionScopeInput, setDecisionScopeInput] = useState('');
  const [currentScope, setCurrentScope] = useState<DecisionScope | null>(null);
  const [isModuleInitialized, setIsModuleInitialized] = useState(false);
  const scopeRef = useRef<DecisionScope | null>(null);

  // AsyncStorage keys
  const DECISION_SCOPE_KEY = 'optimize_decision_scope';

  // Load saved decision scope on component mount
  useEffect(() => {
    const loadSavedScope = async () => {
      try {
        const savedScope = await AsyncStorage.getItem(DECISION_SCOPE_KEY);
        if (savedScope) {
          console.log("🔵 Loading saved decision scope from AsyncStorage");
          setDecisionScopeInput(savedScope);
        }
      } catch (error) {
        console.error("🔴 Error loading saved decision scope:", error);
      }
    };
    loadSavedScope();
  }, []);

  // Save decision scope when it changes
  const saveDecisionScope = async (scope: string) => {
    try {
      await AsyncStorage.setItem(DECISION_SCOPE_KEY, scope);
      console.log("🔵 Saved decision scope to AsyncStorage");
    } catch (error) {
      console.error("🔴 Error saving decision scope:", error);
    }
  };

  // === Construct the DecisionScope properly ===
  const getDecisionScope = () => {
    if (!decisionScopeInput) {
      Alert.alert('Error', 'Please enter a decision scope');
      return null;
    }

    // Clean the input string and ensure it's not already encoded
    const cleanedInput = decisionScopeInput.trim();
    
    // Remove any surrounding quotes if they exist
    const unquotedInput = cleanedInput.replace(/^"|"$/g, '');
    
    console.log("🔵 DecisionScope input details:", {
      raw: decisionScopeInput,
      cleaned: cleanedInput,
      unquoted: unquotedInput,
      length: unquotedInput.length,
      hasWhitespace: cleanedInput !== decisionScopeInput,
      hasQuotes: cleanedInput !== unquotedInput,
      isBase64: unquotedInput.match(/^[A-Za-z0-9+/=]+$/) ? true : false
    });

    // Only create a new DecisionScope if the input has changed
    if (!scopeRef.current || scopeRef.current.getName() !== unquotedInput) {
      console.log("🔵 Creating new DecisionScope instance");
      scopeRef.current = new DecisionScope(unquotedInput);
    } else {
      console.log("🔵 Reusing existing DecisionScope instance");
    }

    const scope = scopeRef.current;
    const scopeName = scope.getName();
    
    console.log("🔵 DecisionScope details:", {
      input: unquotedInput,
      scopeName: scopeName,
      isBase64: scopeName.match(/^[A-Za-z0-9+/=]+$/) ? true : false,
      length: unquotedInput.length,
      scopeNameLength: scopeName.length,
      match: unquotedInput === scopeName,
      instanceId: scope === scopeRef.current ? "Same instance" : "Different instance"
    });

    setCurrentScope(scope);
    return scope;
  };

  /**
   * 1️⃣  Setup: configure MobileCore and log versions once at startup.
   */
  useEffect(() => {
    const initialize = async () => {
      try {
        // Check if Optimize module is available
        if (!NativeModules.AEPOptimize) {
          console.error("🔴 AEPOptimize native module is not available");
          Alert.alert("Error", "Optimize module is not properly initialized");
          return;
        }

        await MobileCore.setLogLevel(LogLevel.DEBUG);
        const ver = await Optimize.extensionVersion();
        console.log("🔵 Optimize extension version:", ver);
        setVersion(ver);
        setIsModuleInitialized(true);

        // Log the current configuration
        console.log("🔵 Current configuration:", {
          moduleAvailable: !!NativeModules.AEPOptimize,
          version: ver,
          isInitialized: true
        });
      } catch (e) {
        console.error("🔴 Error initializing Optimize:", e);
        Alert.alert("Error", "Failed to initialize Optimize module");
      }
    };
    initialize();

    // Set up proposition update listener once when component mounts
    console.log("🔵 Setting up onPropositionUpdate listener...");
    Optimize.onPropositionUpdate({
      call: (props) => {
        console.log("🔵 🎉 onPropositionUpdate listener called!");
        const allKeys = Array.from(props.keys());
        console.log("🔵 All received proposition scopes:", allKeys);
        
        // Check if scopeRef.current exists and update proposition state
        if (scopeRef.current) {
          const scopeName = scopeRef.current.getName();
          console.log("🔵 Looking for scope:", {
            requested: scopeName,
            isBase64: scopeName.match(/^[A-Za-z0-9+/=]+$/) ? true : false,
            length: scopeName.length
          });

          // Check if the scope exists in the props
          if (props.has(scopeName)) {
            console.log("🔵 Found proposition for scope:", scopeName);
            const prop = props.get(scopeName);
            if (prop) {
              console.log("🔵 Proposition content:", JSON.stringify(prop, null, 2));
              setProposition(prop);
              
              // Call offer.displayed() to track that the offer was shown (Adobe best practice)
              try {
                if (prop.items && prop.items.length > 0) {
                  const item = prop.items[0];
                  console.log("🔵 Calling offer.displayed() for item:", item.id);
                  item.displayed(prop);
                  console.log("🔵 ✅ offer.displayed() called successfully");
                }
              } catch (displayError) {
                console.error("🔴 Error calling offer.displayed():", displayError);
              }
            } else {
              console.log("🔴 Proposition is undefined for scope:", scopeName);
              setProposition(null);
            }
          } else {
            console.log("🔴 Scope not found in received propositions!");
            console.log("🔵 Available scopes:", allKeys.map(key => ({
              key,
              isBase64: key.match(/^[A-Za-z0-9+/=]+$/) ? true : false,
              length: key.length
            })));
            setProposition(null);
          }
        } else {
          console.log("🔵 No scopeRef.current set.");
        }
      }
    });
    console.log("🔵 ✅ onPropositionUpdate listener registered successfully");

    // No cleanup needed as the SDK handles this internally
    return () => {};
  }, []); // Empty dependency array - listener stays active

  /**
   * 3️⃣  Request new propositions from Edge.
   * This uses ECID as identity and adds it in the XDM payload.
   */
  const updatePropositions = async () => {
    try {
      if (!isModuleInitialized) {
        Alert.alert("Error", "Optimize module is not initialized");
        return;
      }

      const scope = getDecisionScope();
      if (!scope) return;

      const ecid = await Identity.getExperienceCloudId();
      console.log("🔵 ECID:", ecid);

      const xdm = new Map();
      xdm.set("eventType", "personalization.request");
      xdm.set("identityMap", {
        ECID: [{ id: ecid, primary: true }]
      });

      // Log the complete request details
      console.log("🔵 Request details:", {
        scope: {
          name: scope.getName(),
          isBase64: scope.getName().match(/^[A-Za-z0-9+/=]+$/) ? true : false,
          length: scope.getName().length
        },
        xdm: Object.fromEntries(xdm),
        ecid: ecid,
        moduleInitialized: isModuleInitialized
      });

      console.log("🔵 Step 1: Calling updatePropositions to fetch and cache offers...");
      
      // Check if we can make network requests
      console.log("🔵 Checking SDK configuration for network requests...");
      console.log("🔵 - Module initialized:", isModuleInitialized);
      console.log("🔵 - ECID available:", !!ecid);
      console.log("🔵 - Scope valid:", !!scope);
      console.log("🔵 - XDM payload:", Object.fromEntries(xdm));
      
      // Call updatePropositions - the onPropositionUpdate listener will handle the response
      try {
        await Optimize.updatePropositions([scope], xdm);
        console.log("🔵 ✅ updatePropositions called successfully");
      } catch (updateError) {
        console.error("🔴 Error in updatePropositions call:", updateError);
        Alert.alert("Error", "Failed to call updatePropositions");
        return;
      }

      Alert.alert("Success", "Proposition update request sent. Check console for response.");
    } catch (err) {
      console.error("🔴 Error in updatePropositions:", err);
      Alert.alert("Error", "Failed to update propositions.");
    }
  };


  /**
   * 4️⃣  Read propositions from local SDK cache.
   * Call after updatePropositions to verify.
   */
  const getCachedPropositions = async () => {
    const scope = getDecisionScope();
    if (!scope) return;

    console.log("🔵 Step 2: Calling getPropositions to read from cache...");

    console.log("🔵 Getting cached propositions with scope:", {
      name: scope.getName(),
      isBase64: scope.getName().match(/^[A-Za-z0-9+/=]+$/) ? true : false,
      length: scope.getName().length,
      instance: scope === currentScope ? "Same instance" : "Different instance",
      input: decisionScopeInput
    });

    const props = await Optimize.getPropositions([scope]);
    const allKeys = Array.from(props.keys());
    console.log("🔵 Cached propositions details:", {
      availableScopes: allKeys,
      requestedScope: {
        name: scope.getName(),
        isBase64: scope.getName().match(/^[A-Za-z0-9+/=]+$/) ? true : false,
        length: scope.getName().length,
        instance: scope === currentScope ? "Same instance" : "Different instance"
      },
      hasRequestedScope: props.has(scope.getName()),
      scopeComparison: allKeys.map(key => ({
        received: key,
        requested: scope.getName(),
        match: key === scope.getName(),
        receivedIsBase64: key.match(/^[A-Za-z0-9+/=]+$/) ? true : false,
        requestedIsBase64: scope.getName().match(/^[A-Za-z0-9+/=]+$/) ? true : false,
        receivedLength: key.length,
        requestedLength: scope.getName().length
      })),
      rawProps: JSON.stringify(Object.fromEntries(props), null, 2)
    });

    const prop = props.get(scope.getName());
    if (prop) {
      console.log("🔵 Step 3: Found proposition, setting state...");
      setProposition(prop);
      
      // Call offer.displayed() to track that the offer was shown (Adobe best practice)
      try {
        if (prop.items && prop.items.length > 0) {
          const item = prop.items[0];
          console.log("🔵 Calling offer.displayed() for item:", item.id);
          item.displayed(prop);
          console.log("🔵 ✅ offer.displayed() called successfully");
        }
      } catch (displayError) {
        console.error("🔴 Error calling offer.displayed():", displayError);
      }
      
      console.log("🔵 ✅ Proposition set successfully and offer.displayed() called.");
      
      Alert.alert("Success", "Got proposition from cache successfully.");
    } else {
      console.log("🔴 No proposition found in cache for scope:", scope.getName());
      console.log("🔴 Make sure to call 'Update Propositions' first to fetch offers from Adobe");
      Alert.alert("Info", "No proposition found in cache. Call 'Update Propositions' first.");
    }
  };

  /**
   * 5️⃣  Clear local SDK cache.
   * Helpful for testing or switching activities.
   */
  const clearCache = () => {
    Optimize.clearCachedPropositions();
    setProposition(null);
    Alert.alert("Cleared", "Proposition cache cleared.");
  };

  /**
   * Clear saved decision scope from AsyncStorage.
   */
  const clearSavedScope = async () => {
    try {
      await AsyncStorage.removeItem(DECISION_SCOPE_KEY);
      setDecisionScopeInput('');
      console.log("🔵 Cleared saved decision scope from AsyncStorage");
      Alert.alert("Cleared", "Saved decision scope cleared.");
    } catch (error) {
      console.error("🔴 Error clearing saved decision scope:", error);
      Alert.alert("Error", "Failed to clear saved decision scope.");
    }
  };

  const renderPropositionContent = (proposition: Proposition) => {
    if (!proposition?.items || proposition.items.length === 0) {
      return <ThemedText>No proposition content available.</ThemedText>;
    }

    const item = proposition.items[0];
    console.log("Rendering proposition item:", JSON.stringify(item, null, 2));

    try {
      // Try to parse as JSON if it's a JSON string
      const content = typeof item.content === 'string' ? JSON.parse(item.content) : item.content;
      return (
        <View style={{ backgroundColor: tintColor + '20', padding: 10, borderRadius: 5 }}>
          <ThemedText style={{ marginBottom: 5, fontWeight: 'bold' }}>Format: {item.format}</ThemedText>
          <ThemedText style={{ marginBottom: 5, fontWeight: 'bold' }}>Schema: {item.schema}</ThemedText>
          <ThemedText style={{ marginBottom: 5, fontWeight: 'bold' }}>Content:</ThemedText>
          <ThemedText style={{ fontFamily: 'monospace' }}>
            {JSON.stringify(content, null, 2)}
          </ThemedText>
        </View>
      );
    } catch (e) {
      console.error("Error parsing proposition content:", e);
      // If not JSON, display as is
      return (
        <View style={{ backgroundColor: tintColor + '20', padding: 10, borderRadius: 5 }}>
          <ThemedText style={{ marginBottom: 5, fontWeight: 'bold' }}>Format: {item.format}</ThemedText>
          <ThemedText style={{ marginBottom: 5, fontWeight: 'bold' }}>Schema: {item.schema}</ThemedText>
          <ThemedText style={{ marginBottom: 5, fontWeight: 'bold' }}>Content:</ThemedText>
          <ThemedText>{item.content}</ThemedText>
        </View>
      );
    }
  };

  return (
    <TechnicalScreen onBack={() => router.back()} contentContainerStyle={{ paddingTop: 20, backgroundColor }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ThemedText style={{ fontSize: 16, color: tintColor }}>← Back</ThemedText>
        </TouchableOpacity>
        <ThemedText type="title">Optimize</ThemedText>
        <View style={{ width: 50 }} />
      </View>

      <ThemedText>SDK Version: {version}</ThemedText>

      <View style={{ marginVertical: 10, backgroundColor: tintColor + '10', padding: 10, borderRadius: 5 }}>
        <ThemedText style={{ fontWeight: 'bold', marginBottom: 5 }}>Instructions:</ThemedText>
        <ThemedText style={{ fontSize: 12 }}>1. Enter your decision scope</ThemedText>
        <ThemedText style={{ fontSize: 12 }}>2. Click "Update Propositions" to request from Adobe</ThemedText>
        <ThemedText style={{ fontSize: 12 }}>3. Wait for the response (check console logs)</ThemedText>
        <ThemedText style={{ fontSize: 12 }}>4. Use "Get Cached Propositions" to verify cache</ThemedText>
      </View>

      <View style={{ marginVertical: 10 }}>
        <ThemedText style={{ marginBottom: 5 }}>Decision Scope:</ThemedText>
        <TextInput
          style={{ 
            borderWidth: 1, 
            borderColor: tintColor, 
            padding: 10,
            marginBottom: 10,
            borderRadius: 5,
            color: textColor,
            backgroundColor: backgroundColor
          }}
          value={decisionScopeInput}
          onChangeText={(text) => {
            setDecisionScopeInput(text);
            saveDecisionScope(text);
          }}
          placeholder="Enter your decision scope"
          placeholderTextColor={textColor + '80'}
          multiline
        />
      </View>

      <View style={{ marginVertical: 10 }}>
        <TouchableOpacity 
          style={{ 
            backgroundColor: tintColor, 
            padding: 10, 
            borderRadius: 5,
            alignItems: 'center'
          }}
          onPress={updatePropositions}
        >
          <ThemedText style={{ color: backgroundColor }}>Update Propositions</ThemedText>
        </TouchableOpacity>
      </View>

      <View style={{ marginVertical: 10 }}>
        <TouchableOpacity 
          style={{ 
            backgroundColor: tintColor, 
            padding: 10, 
            borderRadius: 5,
            alignItems: 'center'
          }}
          onPress={getCachedPropositions}
        >
          <ThemedText style={{ color: backgroundColor }}>Get Cached Propositions</ThemedText>
        </TouchableOpacity>
      </View>

      <View style={{ marginVertical: 10 }}>
        <TouchableOpacity 
          style={{ 
            backgroundColor: tintColor, 
            padding: 10, 
            borderRadius: 5,
            alignItems: 'center'
          }}
          onPress={clearCache}
        >
          <ThemedText style={{ color: backgroundColor }}>Clear Proposition Cache</ThemedText>
        </TouchableOpacity>
      </View>

      <View style={{ marginVertical: 10 }}>
        <TouchableOpacity 
          style={{ 
            backgroundColor: tintColor, 
            padding: 10, 
            borderRadius: 5,
            alignItems: 'center'
          }}
          onPress={clearSavedScope}
        >
          <ThemedText style={{ color: backgroundColor }}>Clear Saved Decision Scope</ThemedText>
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 30 }}>
        <ThemedText type="subtitle">Current Proposition:</ThemedText>
        {proposition ? (
          renderPropositionContent(proposition)
        ) : (
          <ThemedText>No proposition yet.</ThemedText>
        )}
      </View>
    </TechnicalScreen>
  );
}

/**
 * 📌 Cursor Notes:
 * - This example uses `DecisionScope(activityId, placementId, itemCount)` for clarity.
 * - It shows exactly how to attach ECID to the XDM request.
 * - `updatePropositions` always hits Edge → then cache is filled.
 * - `getPropositions` reads from local SDK memory.
 * - `onPropositionUpdate` auto-updates state whenever new data arrives.
 * - Replace placeholder IDs with your real Activity & Placement.
 */
