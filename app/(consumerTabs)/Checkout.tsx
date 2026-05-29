import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { useProfile } from '../../components/ProfileContext';
import { buildPageViewEvent, buildPurchaseEvent } from '../../src/utils/xdmEventBuilders';
import { refreshDecisioningSurfaceFromStoredConfig } from '../../src/utils/decisioningItems';

/** Demo flat shipping for CJA commerce.shipping.shippingAmount (no live rate API in app). */
const DEMO_SHIPPING_USD = 5.99;
/** Demo sales tax rate on subtotal for CJA commerce.order.taxAmount. */
const DEMO_TAX_RATE = 0.0825;

export default function Checkout() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [showConfetti, setShowConfetti] = React.useState(false);
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const { clearCart, cart, cartSessionId, isCartSessionLoading, resetCartSession } = useCart();
  const { profile, isProfileLoading, getProfile } = useProfile();
  
  const [identityMap, setIdentityMap] = useState({});
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const purchaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // item 11.2: clear the post-purchase navigation timer if the component unmounts
  // before the 3 s delay elapses (e.g. student navigates away mid-confetti).
  useEffect(() => {
    return () => {
      if (purchaseTimerRef.current) clearTimeout(purchaseTimerRef.current);
    };
  }, []);

  // Memoize modifiedCart to prevent re-render issues
  const modifiedCart = useMemo(() => 
    cart.map(item => ({ ...item, sku: item.sku || 'defaultSku', title: item.title || 'Unnamed Offer' })),
    [cart]
  );

  const refreshIdentityMap = useCallback(async () => {
    try {
      const result = await Identity.getIdentities();
      const map = (result && (result as any).identityMap) ? (result as any).identityMap : result;
      setIdentityMap(map ?? {});
      return map ?? {};
    } catch (err) {
      console.warn('[Checkout] Identity.getIdentities() failed:', err);
      return null;
    }
  }, []);

  // Initial fetch on mount; also re-fetched on every focus below.
  useEffect(() => { refreshIdentityMap(); }, [refreshIdentityMap]);

  // Send page view when screen comes into focus, using a fresh identity fetch each time.
  useFocusEffect(
    useCallback(() => {
      const handleFocus = async () => {
        if (purchaseInProgress) return;
        if (isProfileLoading) return;
        if (isCartSessionLoading || !cartSessionId) return;

        const liveIdentityMap = await refreshIdentityMap();
        if (!liveIdentityMap || Object.keys(liveIdentityMap).length === 0) {
          console.log('[Checkout] IdentityMap not ready, skipping page view');
          return;
        }

        try {
          const pageViewEvent = await buildPageViewEvent({
            identityMap: liveIdentityMap,
            profile: getProfile(),
            pageTitle: 'Checkout',
            pagePath: '/checkout',
            pageType: 'checkout',
          });
          console.log('📤 Sending checkout page view event');
          await Edge.sendEvent(pageViewEvent);
          console.log('✅ Checkout page view sent:', {
            itemCount: modifiedCart.length,
            cartSessionId,
            participantName: profile?.firstName || 'Prospect'
          });
        } catch (error) {
          console.error('❌ Error sending checkout page view:', error);
        }
      };

      handleFocus();
    }, [modifiedCart, refreshIdentityMap, cartSessionId, isCartSessionLoading, purchaseInProgress, isProfileLoading, profile, getProfile])
  );

  useEffect(() => {
    //console.log('Profile firstName:', profile.firstName);
    //console.log('Profile email:', profile.email);
    setFirstName(profile.firstName);
    setEmail(profile.email);
  }, [profile]);

  const handlePayment = async () => {
    setPurchaseInProgress(true);
    setPurchaseError(null);

    // --- Purchase event (must succeed before anything else) ---
    try {
      const subtotal = parseFloat(
        cart.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2)
      );
      const taxAmount = parseFloat((subtotal * DEMO_TAX_RATE).toFixed(2));
      const shippingAmount = DEMO_SHIPPING_USD;
      const totalAmount = parseFloat((subtotal + shippingAmount + taxAmount).toFixed(2));

      const purchaseID = `order-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Re-fetch identity right before sending — state may be stale.
      const liveIdentityMap = await refreshIdentityMap();
      if (!liveIdentityMap || Object.keys(liveIdentityMap).length === 0) {
        console.warn('[Checkout] Purchase blocked: identityMap empty. Check App ID configuration.');
        setPurchaseError('Adobe SDK identity not ready. Verify App ID is configured, then try again.');
        setPurchaseInProgress(false);
        return;
      }

      // Read latest profile synchronously — closure-captured `profile` can be
      // stale right after login, stamping the purchase as Prospect.
      const livePurchaseProfile = getProfile();
      const purchaseEvent = await buildPurchaseEvent({
        identityMap: liveIdentityMap,
        profile: livePurchaseProfile,
        purchaseID,
        cartSessionId: cartSessionId || 'unknown',
        productListItems: modifiedCart,
        priceTotal: totalAmount,
        currencyCode: 'USD',
        shippingAmount,
        taxAmount,
      });

      console.log('📤 Sending purchase event');
      await Edge.sendEvent(purchaseEvent);
      console.log('✅ Purchase event sent:', {
        purchaseID,
        itemCount: modifiedCart.length,
        totalAmount,
        cartSessionId,
        participantName: livePurchaseProfile?.firstName || 'Prospect'
      });
    } catch (error) {
      console.error('[Checkout] Purchase event failed:', error);
      setPurchaseError('Payment failed — see Metro console for details.');
      setPurchaseInProgress(false);
      return;
    }

    // --- Post-purchase side effects (failures here do NOT un-do the purchase) ---
    try {
      console.log('🔄 Refreshing in-app messages after purchase...');
      await Messaging.refreshInAppMessages();
      const refreshedSurface = await refreshDecisioningSurfaceFromStoredConfig();
      if (refreshedSurface) {
        console.log('Decisioning surface refreshed after purchase:', refreshedSurface);
      }
    } catch (sideEffectError) {
      console.warn('[Checkout] Post-purchase refresh failed (non-fatal):', sideEffectError);
    }

    await resetCartSession();
    clearCart();
    setShowConfetti(true);

    purchaseTimerRef.current = setTimeout(() => {
      setPurchaseInProgress(false);
      setShowConfetti(false);
      router.replace('/home');
    }, 3000);
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <ThemedView style={{ flex: 1 }}>
        <ScrollableContainer>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 16, alignSelf: 'flex-start', marginBottom: 16 }}>
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
        {purchaseError && (
          <ThemedText style={{ color: 'red', marginTop: 8, textAlign: 'center', fontSize: 13 }}>
            {purchaseError}
          </ThemedText>
        )}
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
