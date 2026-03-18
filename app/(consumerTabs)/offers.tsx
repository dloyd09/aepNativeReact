import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { View, TouchableOpacity, StyleSheet, Button, Image, FlatList } from 'react-native';
import { useTheme, useFocusEffect } from '@react-navigation/native';
import { Optimize, DecisionScope } from '@adobe/react-native-aepoptimize';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Identity } from '@adobe/react-native-aepedgeidentity';
import { Edge } from '@adobe/react-native-aepedge';
import { useCart } from '../../components/CartContext';
import { useCartSession } from '../../hooks/useCartSession';
import { buildPageViewEvent, buildProductListAddEvent } from '../../src/utils/xdmEventBuilders';
import {
  ConsumerOffer,
  buildOfferTrackingKey,
  buildOptimizeRequestXdm,
  createOptimizePropositionUpdateHandler,
  getOffersForScope,
  isValidOfferImage,
  trackOfferDisplay,
  trackOfferTap,
} from '../../src/utils/offersOptimize';

const PROFILE_KEY = 'userProfile';
const DECISION_SCOPE_KEY = 'optimize_decision_scope';

export function useProfileStorage() {
  const [profile, setProfile] = useState({ firstName: '', email: '' });
  const [decisionScope, setDecisionScope] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const storedProfile = await AsyncStorage.getItem(PROFILE_KEY);
        if (storedProfile) {
          setProfile(JSON.parse(storedProfile));
        }
        const storedScope = await AsyncStorage.getItem(DECISION_SCOPE_KEY);
        if (storedScope) {
          setDecisionScope(storedScope);
        }
      } catch (error) {
        console.error('Failed to load data from storage:', error);
      }
    };

    loadProfile();
  }, []);

  return { profile, setProfile, decisionScope, setDecisionScope };
}

const OfferCard = ({
  offer,
  styles,
  colors,
  addToCart,
  isInCart,
}: {
  offer: ConsumerOffer;
  styles: any;
  colors: any;
  addToCart: (offer: ConsumerOffer) => void;
  isInCart: (name: string, category: string) => boolean;
}) => {
  const itemName = offer.title || 'Unnamed Offer';
  const itemCategory = offer.category || 'defaultCategory';
  const isAdded = isInCart(itemName, itemCategory);

  return (
    <View style={[styles.card, { alignItems: 'center', backgroundColor: colors.card, padding: 16, width: '100%' }]}>
      {isValidOfferImage(offer.image) ? (
        <Image
          source={{ uri: offer.image }}
          style={{ width: 64, height: 64, borderRadius: 12, marginBottom: 16, marginRight: 16 }}
          onError={(error) => console.error('Error loading image for offer:', offer.title, error)}
        />
      ) : (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 12,
            marginBottom: 16,
            marginRight: 16,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <ThemedText style={{ fontSize: 10 }}>IMG</ThemedText>
        </View>
      )}
      <View style={{ flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', width: '80%' }}>
        <ThemedText style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 4, textAlign: 'left' }}>{offer.title}</ThemedText>
        <ThemedText style={{ color: colors.text, fontSize: 14, textAlign: 'left' }}>{offer.text}</ThemedText>
        <ThemedText style={{ color: colors.text, fontSize: 16, fontWeight: 'bold', marginTop: 4, textAlign: 'left' }}>${offer.price.toFixed(2)}</ThemedText>
        <TouchableOpacity
          onPress={() => addToCart(offer)}
          disabled={isAdded}
          style={{
            marginTop: 8,
            paddingVertical: 8,
            paddingHorizontal: 16,
            backgroundColor: isAdded ? '#4CAF50' : colors.primary,
            borderRadius: 8,
            opacity: isAdded ? 0.8 : 1,
          }}
        >
          <ThemedText style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
            {isAdded ? 'Added to Cart' : 'Add to Cart'}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function OffersTab() {
  const { colors } = useTheme();
  const { setProfile, decisionScope, setDecisionScope } = useProfileStorage();
  const [offers, setOffers] = useState<ConsumerOffer[]>([]);
  const { addToCart, isInCart } = useCart();
  const { cartSessionId, isLoading: isCartSessionLoading } = useCartSession();
  const [identityMap, setIdentityMap] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const decisionScopeRef = useRef(decisionScope);
  const displayedOfferKeysRef = useRef(new Set<string>());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: ConsumerOffer; isViewable?: boolean }> }) => {
    viewableItems.forEach(({ item, isViewable }) => {
      if (!isViewable) {
        return;
      }

      const trackingKey = buildOfferTrackingKey(item);
      if (displayedOfferKeysRef.current.has(trackingKey)) {
        return;
      }

      displayedOfferKeysRef.current.add(trackingKey);
      trackOfferDisplay(item);
    });
  });

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
      backgroundColor: colors.card,
    },
    list: {
      padding: 16,
      width: '100%',
    },
  });

  const refreshIdentityMap = useCallback(async () => {
    const result = await Identity.getIdentities();
    if (result && (result as any).identityMap) {
      setIdentityMap((result as any).identityMap);
      return (result as any).identityMap;
    }

    setIdentityMap(result);
    return result;
  }, []);

  useEffect(() => {
    refreshIdentityMap().catch((error) => {
      console.error('Failed to initialize identity map:', error);
    });
  }, [refreshIdentityMap]);

  useEffect(() => {
    decisionScopeRef.current = decisionScope;
  }, [decisionScope]);

  const applyOffersForScope = useCallback((propositions?: Map<string, any>, scopeName?: string) => {
    const resolvedScope = scopeName || decisionScopeRef.current;
    const nextOffers = getOffersForScope(propositions, resolvedScope);
    displayedOfferKeysRef.current.clear();
    setOffers(nextOffers);
  }, []);

  const fetchOffersForScope = useCallback(async (scopeName: string, forceRefresh = true) => {
    if (!scopeName) {
      console.log('Cannot fetch propositions - no decision scope configured');
      setOffers([]);
      return;
    }

    const userScope = new DecisionScope(scopeName);

    try {
      setIsRefreshing(true);
      if (forceRefresh) {
        const ecid = await Identity.getExperienceCloudId();
        if (!ecid) {
          console.error('ECID not found');
          return;
        }

        await Optimize.updatePropositions([userScope], buildOptimizeRequestXdm(ecid));
      }

      const propositions = await Optimize.getPropositions([userScope]);
      applyOffersForScope(propositions, userScope.getName());
    } catch (error) {
      console.error('Error fetching propositions:', error);
      setOffers([]);
    } finally {
      setIsRefreshing(false);
    }
  }, [applyOffersForScope]);

  useEffect(() => {
    const updateHandler = createOptimizePropositionUpdateHandler(decisionScopeRef, (nextOffers) => {
      displayedOfferKeysRef.current.clear();
      setOffers(nextOffers);
    });

    Optimize.onPropositionUpdate({
      call(propositions) {
        updateHandler(propositions);
      },
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      const loadProfileAndScope = async () => {
        try {
          await refreshIdentityMap();

          const storedProfile = await AsyncStorage.getItem(PROFILE_KEY);
          if (storedProfile) {
            setProfile(JSON.parse(storedProfile));
          }

          const storedScope = await AsyncStorage.getItem(DECISION_SCOPE_KEY);
          if (storedScope) {
            decisionScopeRef.current = storedScope;
            setDecisionScope(storedScope);
            console.log('Decision scope loaded from AsyncStorage:', storedScope);
            await fetchOffersForScope(storedScope, true);
          } else {
            console.log('No decision scope found in AsyncStorage - please configure in Technical View -> Optimize');
            setOffers([]);
          }
        } catch (error) {
          console.error('Failed to load data from storage:', error);
        }
      };

      loadProfileAndScope();
    }, [fetchOffersForScope, refreshIdentityMap, setDecisionScope, setProfile])
  );

  useFocusEffect(
    useCallback(() => {
      const handleFocus = async () => {
        const currentIdentityMap = await refreshIdentityMap();

        if (!currentIdentityMap || Object.keys(currentIdentityMap).length === 0) {
          console.log('Offers - IdentityMap not ready, skipping page view');
          return;
        }

        let currentProfile = { firstName: '', email: '' };
        try {
          const storedProfile = await AsyncStorage.getItem(PROFILE_KEY);
          if (storedProfile) {
            currentProfile = JSON.parse(storedProfile);
          }
        } catch (error) {
          console.error('Failed to read profile:', error);
        }

        try {
          const pageViewEvent = await buildPageViewEvent({
            identityMap: currentIdentityMap,
            profile: currentProfile,
            pageTitle: 'Offers',
            pagePath: '/offers',
            pageType: 'offers',
          });

          console.log('Sending offers page view event');
          await Edge.sendEvent(pageViewEvent);
          console.log('Offers page view sent successfully');
        } catch (error) {
          console.error('Error sending offers page view:', error);
        }
      };

      handleFocus();
    }, [refreshIdentityMap])
  );

  const handleAddToCartWithTracking = async (offer: ConsumerOffer) => {
    trackOfferTap(offer);

    addToCart({
      name: offer.title || 'Unnamed Offer',
      title: offer.title,
      category: offer.category || 'defaultCategory',
      sku: offer.sku || 'defaultSku',
      price: offer.price,
      image: offer.image,
    });

    if (isCartSessionLoading || !cartSessionId) {
      console.log('Cart session not ready, skipping add to cart XDM event');
      return;
    }

    const currentIdentityMap = await refreshIdentityMap();
    if (!currentIdentityMap || Object.keys(currentIdentityMap).length === 0) {
      console.log('IdentityMap not ready, skipping add to cart XDM event');
      return;
    }

    let currentProfile = { firstName: '', email: '' };
    try {
      const storedProfile = await AsyncStorage.getItem(PROFILE_KEY);
      if (storedProfile) {
        currentProfile = JSON.parse(storedProfile);
      }
    } catch (error) {
      console.error('Failed to read profile:', error);
    }

    try {
      const productListAddEvent = await buildProductListAddEvent({
        identityMap: currentIdentityMap,
        profile: currentProfile,
        product: {
          sku: offer.sku || 'defaultSku',
          name: offer.title || 'Unnamed Offer',
          price: offer.price,
          category: offer.category || 'offers',
          quantity: 1,
        },
        cartSessionId,
      });

      console.log('Sending offer add to cart event:', offer.title);
      await Edge.sendEvent(productListAddEvent);
      console.log('Offer add to cart event sent successfully:', {
        name: offer.title,
        sku: offer.sku,
        price: offer.price,
        cartSessionId,
      });
    } catch (error) {
      console.error('Error sending offer add to cart event:', error);
    }
  };

  return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      {offers.length === 0 ? (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <ThemedText style={{ fontSize: 16, color: colors.text, marginBottom: 10 }}>
            No offers available
          </ThemedText>
          <Button
            title={isRefreshing ? 'Refreshing...' : 'Refresh Offers'}
            onPress={() => fetchOffersForScope(decisionScopeRef.current, true)}
            color={colors.primary}
            disabled={isRefreshing}
          />
        </View>
      ) : (
        <FlatList
          data={offers}
          renderItem={({ item }) => (
            <OfferCard
              offer={item}
              styles={styles}
              colors={colors}
              addToCart={handleAddToCartWithTracking}
              isInCart={isInCart}
            />
          )}
          keyExtractor={(item) => buildOfferTrackingKey(item)}
          contentContainerStyle={styles.list}
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={viewabilityConfig.current}
        />
      )}
    </ThemedView>
  );
}
