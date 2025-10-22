import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { View, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useTheme, useNavigation } from '@react-navigation/native';
import { Edge } from '@adobe/react-native-aepedge';
import { useCart } from '../../components/CartContext';
import { PRODUCT_IMAGES } from './_home/[category]';
import { Identity } from '@adobe/react-native-aepedgeidentity';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from './_layout';
import { useCartSession } from '../../hooks/useCartSession';
import { useProfileStorage } from '../../hooks/useProfileStorage';
import { buildPageViewEvent, buildCheckoutEvent, buildProductRemovalEvent } from '../../src/utils/xdmEventBuilders';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function CartTab() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const { colors } = useTheme();

  const styles = StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      marginVertical: 8,
      padding: 16,
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    cardImage: {
      width: 64,
      height: 64,
      position: 'absolute',
      left: 16,
      top: 16,
      zIndex: 2,
      borderRadius: 12,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    cardDescription: {
      fontSize: 14,
      opacity: 0.7,
    },
    list: {
      padding: 16,
    },
  });

  const { cart, incrementQuantity, decrementQuantity, removeFromCart, addToCart } = useCart();
  const { cartSessionId, isLoading: isCartSessionLoading } = useCartSession();
  const { profile, setProfile: saveProfile } = useProfileStorage();

  // Memoize modifiedCart to prevent infinite re-renders in useFocusEffect
  const modifiedCart = useMemo(() => 
    cart.map(item => ({ ...item, sku: item.sku || 'defaultSku', title: item.title || 'Unnamed Offer' })),
    [cart]
  );

  const [identityMap, setIdentityMap] = useState({});

  useEffect(() => {
    // Fetch Identity Map
    Identity.getIdentities().then((result) => {
      // Identity.getIdentities() returns { identityMap: { ECID: [...] } }
      // We need to extract the inner identityMap
      console.log('Raw identity result:', JSON.stringify(result, null, 2));
      if (result && result.identityMap) {
        setIdentityMap(result.identityMap);
      } else {
        // Fallback: use the whole result if it's already the right structure
        setIdentityMap(result);
      }
    });
  }, []);

  // Handle remove from cart with tracking
  const handleRemoveFromCart = async (item: any) => {
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

    // Send product removal event
    try {
      const removalEvent = await buildProductRemovalEvent({
        identityMap,
        profile: currentProfile,
        cartSessionId: cartSessionId || 'unknown',
        productListItems: [item] // Only the item being removed
      });

      console.log('📤 Sending product removal event');
      await Edge.sendEvent(removalEvent);
      console.log('✅ Product removal event sent:', item.name);
    } catch (error) {
      console.error('❌ Error sending product removal event:', error);
    }

    // Remove from cart (UI update)
    removeFromCart(item.name, item.category);
  };

  // Send page view when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const handleFocus = async () => {
        // Check prerequisites
        if (isCartSessionLoading || !cartSessionId) {
          console.log('Cart session not ready, skipping page view');
          return;
        }

        if (!identityMap || Object.keys(identityMap).length === 0) {
          console.log('IdentityMap not ready, skipping page view');
          return;
        }

        // Get fresh profile from AsyncStorage (don't update state to avoid re-render loop)
        let currentProfile = { firstName: '', email: '' };
        try {
          const storedProfile = await AsyncStorage.getItem('userProfile');
          if (storedProfile) {
            currentProfile = JSON.parse(storedProfile);
            console.log('📖 Read profile from storage:', currentProfile);
          }
        } catch (error) {
          console.error('Failed to read profile:', error);
        }

        // Send page view
        try {
          const pageViewEvent = await buildPageViewEvent({
            identityMap,
            profile: currentProfile,
            pageTitle: 'Shopping Cart',
            pagePath: '/cart',
            pageType: 'cart',
            productListItems: modifiedCart,
            cartSessionId
          });

          console.log('📤 Sending cart page view event');

          await Edge.sendEvent(pageViewEvent);
          
          console.log('✅ Cart page view sent successfully:', {
            itemCount: modifiedCart.length,
            totalValue: modifiedCart.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2),
            cartSessionId,
            participantName: currentProfile?.firstName || 'Guest User'
          });
        } catch (error) {
          console.error('❌ Error sending cart page view:', error);
        }
      };

      handleFocus();
    }, [modifiedCart, identityMap, cartSessionId, isCartSessionLoading])
  );

  return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Ionicons name="cart" size={48} color="#007AFF" />
      <ThemedText style={{ fontSize: 24, marginTop: 12, marginBottom: 24 }}>Cart</ThemedText>
      {cart.length === 0 ? (
        <ThemedText style={{ fontSize: 18, opacity: 0.7 }}>Your cart is empty.</ThemedText>
      ) : (
        <>
          <FlatList
            data={modifiedCart}
            keyExtractor={item => `${item.category}-${item.name}`}
            renderItem={({ item }) => (
              <TouchableOpacity style={[styles.card, { backgroundColor: colors.card, flexDirection: 'row' }]} onPress={() => console.log('Item pressed:', item.name)}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Image
                    source={item.image && item.image.startsWith('http') ? { uri: item.image } : PRODUCT_IMAGES[item.sku] }
                    style={{ width: 64, height: 64, borderRadius: 12, marginRight: 16 }}
                    onError={(error) => console.error('Error loading image for item:', item.name, error)}
                  />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.cardTitle}>{item.name}</ThemedText>
                    <ThemedText style={styles.cardDescription}>{item.category}</ThemedText>
                    <ThemedText style={{ fontSize: 16 }}>Price: ${item.price.toFixed(2)}</ThemedText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <TouchableOpacity onPress={() => decrementQuantity(item.name, item.category)} style={{ marginHorizontal: 8, padding: 4 }}>
                        <ThemedText style={{ fontSize: 20 }}>-</ThemedText>
                      </TouchableOpacity>
                      <ThemedText style={{ fontSize: 16 }}>{item.quantity}</ThemedText>
                      <TouchableOpacity onPress={() => incrementQuantity(item.name, item.category)} style={{ marginHorizontal: 8, padding: 4 }}>
                        <ThemedText style={{ fontSize: 20 }}>+</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleRemoveFromCart(item)} style={{ marginLeft: 16, padding: 4 }}>
                        <ThemedText style={{ fontSize: 16, color: 'red' }}>Remove</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
          <ThemedText style={{ fontSize: 18, fontWeight: 'bold', marginTop: 16 }}>Total: ${modifiedCart.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2)}</ThemedText>
          <TouchableOpacity 
            style={{ marginTop: 16, paddingVertical: 12, paddingHorizontal: 32, backgroundColor: colors.primary, borderRadius: 8 }} 
            onPress={async () => {
              if (!cartSessionId) {
                console.warn('Cart session not ready for checkout');
                navigation.navigate('Checkout');
                return;
              }

              if (!identityMap || Object.keys(identityMap).length === 0) {
                console.warn('IdentityMap not ready for checkout');
                navigation.navigate('Checkout');
                return;
              }

              // Get fresh profile from AsyncStorage before sending event
              let currentProfile = { firstName: '', email: '' };
              try {
                const storedProfile = await AsyncStorage.getItem('userProfile');
                if (storedProfile) {
                  currentProfile = JSON.parse(storedProfile);
                }
              } catch (error) {
                console.error('Failed to read profile for checkout:', error);
              }

              try {
                const checkoutEvent = await buildCheckoutEvent({
                  identityMap,
                  profile: currentProfile,
                  cartSessionId,
                  productListItems: modifiedCart
                });

                console.log('📤 Sending checkout event (ExperienceEvent instance)');

                await Edge.sendEvent(checkoutEvent);
                console.log('✅ Checkout event sent successfully:', {
                  itemCount: modifiedCart.length,
                  totalValue: modifiedCart.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2),
                  cartSessionId,
                  hasECID: !!(identityMap as any)?.ECID?.[0]?.id,
                  participantName: currentProfile?.firstName || 'Guest User'
                });

                navigation.navigate('Checkout');
              } catch (error) {
                console.error('❌ Error sending checkout event:', error);
                console.error('Event that failed:', JSON.stringify({identityMap, currentProfile, cartSessionId}));
                // Still navigate even if tracking fails
                navigation.navigate('Checkout');
              }
            }}
          >
            <ThemedText style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Checkout</ThemedText>
          </TouchableOpacity>
        </>
      )}
    </ThemedView>
  );
}
