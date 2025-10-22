import React, { useCallback, useEffect, useState } from 'react';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { View, TouchableOpacity, StyleSheet, Button, Image, FlatList } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, useFocusEffect } from '@react-navigation/native';
import { MobileCore } from '@adobe/react-native-aepcore';
import { Optimize, DecisionScope, Proposition } from '@adobe/react-native-aepoptimize';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Identity, IdentityMap, AuthenticatedState } from '@adobe/react-native-aepedgeidentity';
import { Edge } from '@adobe/react-native-aepedge';
import { useCart } from '../../components/CartContext';
import { useCartSession } from '../../hooks/useCartSession';
import { buildPageViewEvent, buildProductListAddEvent } from '../../src/utils/xdmEventBuilders';

const PROFILE_KEY = 'userProfile';
const DECISION_SCOPE_KEY = 'optimize_decision_scope';

export function useProfileStorage() {
  const [profile, setProfile] = useState({ firstName: '', email: '' });
  const [decisionScope, setDecisionScope] = useState('');
  const [isLoading, setIsLoading] = useState(true);

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
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  const saveProfile = async (newProfile: { firstName: string; email: string }) => {
    try {
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile));
      setProfile(newProfile);
    } catch (error) {
      console.error('Failed to save profile to storage:', error);
    }
  };

  const saveDecisionScope = async (scope: string) => {
    try {
      await AsyncStorage.setItem(DECISION_SCOPE_KEY, scope);
      setDecisionScope(scope);
    } catch (error) {
      console.error('Failed to save decision scope to storage:', error);
    }
  };

  return { profile, setProfile, decisionScope, setDecisionScope };
}

// Define a type for offers
interface Offer {
  title: string;
  text: string;
  image: string;
  price: number;
  name: string; // Add name property
  category: string; // Make category required
  sku: string; // Make sku required to match CartItem
}

const OfferCard = ({ offer, styles, colors, addToCart, isInCart }: { offer: Offer, styles: any, colors: any, addToCart: (offer: Offer) => void, isInCart: (name: string, category: string) => boolean }) => {
  const itemName = offer.title || 'Unnamed Offer';
  const itemCategory = offer.category || 'defaultCategory';
  const isAdded = isInCart(itemName, itemCategory);

  const handleAddToCart = () => {
    addToCart(offer);
  };

  return (
    <View style={[styles.card, { alignItems: 'center', backgroundColor: colors.card, padding: 16, width: '100%' }]}>
      <Image
        source={{ uri: offer.image }}
        style={{ width: 64, height: 64, borderRadius: 12, marginBottom: 16, marginRight: 16 }}
        onError={(error) => console.error('Error loading image for offer:', offer.title, error)}
      />
      <View style={{ flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', width: '80%' }}>
        <ThemedText style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 4, textAlign: 'left' }}>{offer.title}</ThemedText>
        <ThemedText style={{ color: colors.text, fontSize: 14, textAlign: 'left' }}>{offer.text}</ThemedText>
        <ThemedText style={{ color: colors.text, fontSize: 16, fontWeight: 'bold', marginTop: 4, textAlign: 'left' }}>${offer.price.toFixed(2)}</ThemedText>
        <TouchableOpacity 
          onPress={handleAddToCart} 
          disabled={isAdded}
          style={{ 
            marginTop: 8, 
            paddingVertical: 8, 
            paddingHorizontal: 16, 
            backgroundColor: isAdded ? '#4CAF50' : colors.primary, 
            borderRadius: 8,
            opacity: isAdded ? 0.8 : 1
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
  const { profile, setProfile, decisionScope, setDecisionScope } = useProfileStorage();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addToCart, isInCart } = useCart();
  const { cartSessionId, isLoading: isCartSessionLoading } = useCartSession();
  const [identityMap, setIdentityMap] = useState({});

  // Initialize identityMap on component mount
  useEffect(() => {
    Identity.getIdentities().then((result) => {
      if (result && result.identityMap) {
        setIdentityMap(result.identityMap);
      } else {
        setIdentityMap(result);
      }
    });
  }, []);

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
    cardImage: {
      width: 64,
      height: 64,
      borderRadius: 12,
      position: 'absolute',
      left: 16,
      top: 16,
      zIndex: 2,
      overflow: 'hidden',
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 4,
      color: colors.text,
    },
    cardDescription: {
      fontSize: 14,
      opacity: 0.7,
    },
    list: {
      padding: 16,
    },
  });

  useEffect(() => {
    // XDM page view tracking will be handled by useFocusEffect below
    // (Keeping this useEffect for the subscription setup)

    // Subscribe to proposition updates
    Optimize.onPropositionUpdate({
      call(propositions) {
        if (propositions) {
          const updatedOffers = propositions.get(decisionScope)?.items.map(item => {
            const characteristics = item.data.characteristics || {};
            let parsedContent;
            try {
              parsedContent = JSON.parse(item.data.content);
            } catch (e) {
              console.error('Error parsing content:', e);
              parsedContent = {};
            }
            return {
              title: parsedContent.name || parsedContent.title || 'No Title',
              text: parsedContent.text || 'No Text',
              image: parsedContent.image || '',
              price: parsedContent.price || 0,
              name: parsedContent.name || 'Unnamed Offer',
              category: parsedContent.category || 'defaultCategory',
              sku: parsedContent.sku || 'defaultSku',
            };
          }) || [];
          setOffers(updatedOffers);
        }
      },
    });

    // Cleanup function
    return () => {
      // Any cleanup if needed
    };
  }, []);

  // Load profile and decision scope when tab comes into focus
  useFocusEffect(
    useCallback(() => {
      const loadProfileAndScope = async () => {
        try {
          const storedProfile = await AsyncStorage.getItem(PROFILE_KEY);
          if (storedProfile) {
            setProfile(JSON.parse(storedProfile));
          }
          const storedScope = await AsyncStorage.getItem(DECISION_SCOPE_KEY);
          if (storedScope) {
            setDecisionScope(storedScope);
            console.log('✅ Decision scope loaded from AsyncStorage:', storedScope);
          } else {
            console.log('⚠️ No decision scope found in AsyncStorage - please configure in Technical View → Optimize');
          }
        } catch (error) {
          console.error('Failed to load data from storage:', error);
        }
      };

      loadProfileAndScope();
    }, [])
  );

  // Send XDM page view when tab comes into focus
  useFocusEffect(
    useCallback(() => {
      const handleFocus = async () => {
        // Check if identityMap is ready
        if (!identityMap || Object.keys(identityMap).length === 0) {
          console.log('Offers - IdentityMap not ready, skipping page view');
          return;
        }

        // Get fresh profile from AsyncStorage
        let currentProfile = { firstName: '', email: '' };
        try {
          const storedProfile = await AsyncStorage.getItem(PROFILE_KEY);
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
            pageTitle: 'Offers',
            pagePath: '/offers',
            pageType: 'offers'
          });

          console.log('📤 Sending offers page view event');
          await Edge.sendEvent(pageViewEvent);
          
          console.log('✅ Offers page view sent successfully');
        } catch (error) {
          console.error('❌ Error sending offers page view:', error);
        }
      };

      handleFocus();
    }, [identityMap])
  );

  // Call getPropositions when decisionScope is set
  useEffect(() => {
    if (decisionScope) {
      getPropositions();
    }
  }, [decisionScope]);

  const getPropositions = async () => {
    if (!decisionScope) {
      console.log('⚠️ Cannot fetch propositions - no decision scope configured');
      console.log('→ Please configure decision scope in Technical View → Optimize');
      return;
    }
    
    const userScope = new DecisionScope(decisionScope);

    let ecid;
    try {
      ecid = await Identity.getExperienceCloudId();
      if (!ecid) {
        console.error('ECID not found');
        return;
      }
    } catch (error) {
      console.error('Error fetching ECID:', error);
      return;
    }

    const xdmData = { "xdm": { "identityMap": { "ECID": { "id": ecid, "primary": true } } } };

    try {
      const propositions: Map<string, Proposition> =
        await Optimize.getPropositions([userScope]);
      
      if (propositions && propositions.size > 0) {
        const scopeName = userScope.getName();
        const proposition = propositions.get(scopeName);
        
        if (proposition && proposition.items && proposition.items.length > 0) {
          const mappedOffers = proposition.items.map(item => {
            const characteristics = item.data.characteristics || {};
            let parsedContent;
            try {
              parsedContent = JSON.parse(item.data.content);
            } catch (e) {
              console.error('Error parsing content:', e);
              parsedContent = {};
            }
            return {
              title: parsedContent.name || parsedContent.title || 'No Title',
              text: parsedContent.text || 'No Text',
              image: parsedContent.image || '',
              price: parsedContent.price || 0,
              name: parsedContent.name || 'Unnamed Offer',
              category: parsedContent.category || 'defaultCategory',
              sku: parsedContent.sku || 'defaultSku',
            };
          });
          setOffers(mappedOffers);
          console.log('✅ Loaded', mappedOffers.length, 'offer(s)');
        } else {
          setOffers([]);
        }
      } else {
        setOffers([]);
      }
    } catch (error) {
      console.error('Error fetching propositions:', error);
      setOffers([]);
    }
  };

  const updateAndLogIdentity = async () => {
    try {
      const identityMap = new IdentityMap();
      if (profile.email) {
        identityMap.addItem({ id: profile.email, authenticatedState: AuthenticatedState.AUTHENTICATED, primary: true }, 'Email');
      }
      await Identity.updateIdentities(identityMap);
    } catch (error) {
      console.error('Error updating identity map:', error);
    }
  };

  // Wrapper function for add to cart with XDM tracking
  const handleAddToCartWithTracking = async (offer: Offer) => {
    // Add to cart context first
    addToCart({
      name: offer.title || 'Unnamed Offer',
      title: offer.title,
      category: offer.category || 'defaultCategory',
      sku: offer.sku || 'defaultSku',
      price: offer.price,
      image: offer.image
    });

    // Check prerequisites for XDM tracking
    if (isCartSessionLoading || !cartSessionId) {
      console.log('Cart session not ready, skipping add to cart XDM event');
      return;
    }

    if (!identityMap || Object.keys(identityMap).length === 0) {
      console.log('IdentityMap not ready, skipping add to cart XDM event');
      return;
    }

    // Get fresh profile from AsyncStorage
    let currentProfile = { firstName: '', email: '' };
    try {
      const storedProfile = await AsyncStorage.getItem(PROFILE_KEY);
      if (storedProfile) {
        currentProfile = JSON.parse(storedProfile);
      }
    } catch (error) {
      console.error('Failed to read profile:', error);
    }

    // Send XDM productListAdd event
    try {
      const productListAddEvent = await buildProductListAddEvent({
        identityMap,
        profile: currentProfile,
        product: {
          sku: offer.sku || 'defaultSku',
          name: offer.title || 'Unnamed Offer',
          price: offer.price,
          category: offer.category || 'offers',
          quantity: 1
        },
        cartSessionId
      });

      console.log('📤 Sending offer add to cart event:', offer.title);
      await Edge.sendEvent(productListAddEvent);
      
      console.log('✅ Offer add to cart event sent successfully:', {
        name: offer.title,
        sku: offer.sku,
        price: offer.price,
        cartSessionId
      });
    } catch (error) {
      console.error('❌ Error sending offer add to cart event:', error);
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
            title="Refresh Offers" 
            onPress={getPropositions}
            color={colors.primary}
          />
        </View>
      ) : (
        <FlatList
          data={offers}
          renderItem={({ item }) => <OfferCard offer={item} styles={styles} colors={colors} addToCart={handleAddToCartWithTracking} isInCart={isInCart} />}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.list}
        />
      )}
    </ThemedView>
  );
}
