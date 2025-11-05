import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { ScrollableContainer } from '../../components/ScrollableContainer';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useNavigation, useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Edge } from '@adobe/react-native-aepedge';
import { Identity } from '@adobe/react-native-aepedgeidentity';
import { Messaging } from '@adobe/react-native-aepmessaging';
import { useCart } from '../../components/CartContext';
import { useProfileStorage } from '../../hooks/useProfileStorage';
import { useCartSession } from '../../hooks/useCartSession';
import { buildPageViewEvent, buildPurchaseEvent } from '../../src/utils/xdmEventBuilders';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Checkout() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [showConfetti, setShowConfetti] = React.useState(false);
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const { clearCart, cart } = useCart();
  const { profile } = useProfileStorage();
  const { cartSessionId, isLoading: isCartSessionLoading, resetCartSession } = useCartSession();
  
  const [identityMap, setIdentityMap] = useState({});
  const [purchaseInProgress, setPurchaseInProgress] = useState(false); // Prevent duplicate page views after purchase

  // Memoize modifiedCart to prevent re-render issues
  const modifiedCart = useMemo(() => 
    cart.map(item => ({ ...item, sku: item.sku || 'defaultSku', title: item.title || 'Unnamed Offer' })),
    [cart]
  );

  // Fetch Identity Map
  useEffect(() => {
    Identity.getIdentities().then((result) => {
      if (result && result.identityMap) {
        setIdentityMap(result.identityMap);
      } else {
        setIdentityMap(result);
      }
    });
  }, []);

  // Send page view when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const handleFocus = async () => {
        // Don't send page view if purchase is in progress (prevents duplicate after cart session reset)
        if (purchaseInProgress) {
          console.log('Checkout - Purchase in progress, skipping page view');
          return;
        }

        // Check prerequisites
        if (isCartSessionLoading || !cartSessionId) {
          console.log('Checkout - Cart session not ready, skipping page view');
          return;
        }

        if (!identityMap || Object.keys(identityMap).length === 0) {
          console.log('Checkout - IdentityMap not ready, skipping page view');
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
            pageTitle: 'Checkout',
            pagePath: '/checkout',
            pageType: 'checkout',
            productListItems: modifiedCart,
            cartSessionId
          });

          console.log('📤 Sending checkout page view event');
          await Edge.sendEvent(pageViewEvent);
          
          console.log('✅ Checkout page view sent successfully:', {
            itemCount: modifiedCart.length,
            totalValue: modifiedCart.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2),
            cartSessionId,
            participantName: currentProfile?.firstName || 'Guest User'
          });
        } catch (error) {
          console.error('❌ Error sending checkout page view:', error);
        }
      };

      handleFocus();
    }, [modifiedCart, identityMap, cartSessionId, isCartSessionLoading, purchaseInProgress])
  );

  useEffect(() => {
    //console.log('Profile firstName:', profile.firstName);
    //console.log('Profile email:', profile.email);
    setFirstName(profile.firstName);
    setEmail(profile.email);
  }, [profile]);

  const handlePayment = async () => {
    // Set flag to prevent duplicate page views during purchase flow
    setPurchaseInProgress(true);
    
    try {
      const totalAmount = parseFloat(cart.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2));
      
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

      // Send purchase event
      const purchaseID = `order-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      const purchaseEvent = await buildPurchaseEvent({
        identityMap,
        profile: currentProfile,
        purchaseID,
        cartSessionId: cartSessionId || 'unknown',
        productListItems: modifiedCart,
        priceTotal: totalAmount,
        currencyCode: 'USD'
      });

      console.log('📤 Sending purchase event');
      await Edge.sendEvent(purchaseEvent);
      
      console.log('✅ Purchase event sent successfully:', {
        purchaseID,
        itemCount: modifiedCart.length,
        totalAmount,
        cartSessionId,
        participantName: currentProfile?.firstName || 'Guest User'
      });

      // Refresh in-app messages after purchase (to fetch any triggered messages)
      console.log('🔄 Refreshing in-app messages...');
      await Messaging.refreshInAppMessages();
      console.log('✅ In-app messages refreshed');

      // Reset cart session after purchase
      await resetCartSession();
      console.log('🔄 Cart session reset after purchase');

      // Show confetti and navigate
      setShowConfetti(true);
      
      // Clear cart immediately (before navigation)
      clearCart();
      
      setTimeout(() => {
        setPurchaseInProgress(false); // Reset flag before navigation
        setShowConfetti(false);
        router.replace('/home');
      }, 3000);
      
    } catch (error) {
      console.error('❌ Error in payment flow:', error);
      setPurchaseInProgress(false); // Reset on error so user can retry
      // Optionally show an error alert to user
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <ThemedView style={{ flex: 1 }}>
        <ScrollableContainer>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 10, alignSelf: 'flex-start', marginBottom: 16 }}>
          <ThemedText style={{ color: colors.primary }}>Back</ThemedText>
        </TouchableOpacity>
        <ThemedText style={styles.header}>Checkout</ThemedText>
        <View style={styles.section}>
          
          <ThemedText style={styles.shippingInfoTitle}>Shipping Information</ThemedText>
          <ThemedText style={styles.shippingInfoText}>Name: {firstName}</ThemedText>
          <ThemedText style={styles.shippingInfoText}>Email: {email}</ThemedText>
          <ThemedText style={styles.shippingInfoText}>Address: 42 Treehouse Lane, Enchanted Forest</ThemedText>
          <ThemedText style={styles.shippingInfoText}>City: Mystical Woods</ThemedText>
          <ThemedText style={styles.shippingInfoText}>State: Tranquility</ThemedText>
          <ThemedText style={styles.shippingInfoText}>Zip: 00000</ThemedText>
          <ThemedText style={styles.shippingInfoText}>Contact: (555) 123-4567</ThemedText>
        </View>
        <View style={styles.section}>
          <ThemedText style={styles.paymentInfoTitle}>Payment Details</ThemedText>
          <ThemedText style={styles.paymentInfoText}>Cardholder: Rainbow Sunshine</ThemedText>
          <ThemedText style={styles.paymentInfoText}>Card Number: 1234 5678 9012 3456</ThemedText>
          <ThemedText style={styles.paymentInfoText}>Expiry Date: 12/34</ThemedText>
          <ThemedText style={styles.paymentInfoText}>CVV: 007</ThemedText>
        </View>
        <TouchableOpacity 
          style={[
            styles.button, 
            { 
              backgroundColor: purchaseInProgress ? colors.border : colors.primary,
              opacity: purchaseInProgress ? 0.6 : 1
            }
          ]} 
          onPress={handlePayment}
          disabled={purchaseInProgress}
        >
          <ThemedText style={styles.buttonText}>
            {purchaseInProgress ? 'Processing Payment...' : 'Pay Now'}
          </ThemedText>
        </TouchableOpacity>
        </ScrollableContainer>
        {showConfetti && <ConfettiCannon count={200} origin={{x: -10, y: 0}} fadeOut={true} />}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  shippingInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  shippingInfoText: {
    marginBottom: 8,
  },
  paymentInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  paymentInfoText: {
    marginBottom: 8,
  },
}); 