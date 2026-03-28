import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Image, StyleSheet, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Messaging } from '@adobe/react-native-aepmessaging';
import { Edge } from '@adobe/react-native-aepedge';
import { Identity } from '@adobe/react-native-aepedgeidentity';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme, useFocusEffect } from '@react-navigation/native';
import { useCart } from '@/components/CartContext';
import { useCartSession } from '@/hooks/useCartSession';
import { useProfileStorage } from '@/hooks/useProfileStorage';
import { buildPageViewEvent, buildProductListAddEvent } from '@/src/utils/xdmEventBuilders';
import { useRouter } from 'expo-router';
import {
  DECISIONING_ITEMS_CONFIG_KEY,
  DEFAULT_PREVIEW_URL,
  DEFAULT_SURFACE,
  DecisioningItem,
  DecisioningItemsConfig,
  buildDecisioningItemTrackingKey,
  normalizePropositionsResult,
  parseDecisioningItemContent,
  processDecisioningPropositions,
  trackDecisioningItemDisplay,
  trackDecisioningItemInteraction,
} from '@/src/utils/decisioningItems';

interface DecisioningItemCardProps {
  item: DecisioningItem;
  index: number;
  colors: any;
  styles: any;
  addToCart: (item: DecisioningItem) => void;
  isInCart: (name: string, category: string) => boolean;
  handleCustomCTA: (item: DecisioningItem, url: string) => void;
}

const DecisioningItemCard = ({
  item,
  index,
  colors,
  styles,
  addToCart,
  isInCart,
  handleCustomCTA,
}: DecisioningItemCardProps) => {
  const content = parseDecisioningItemContent(item);
  const itemName = content.title || 'Unnamed Offer';
  const itemCategory = content.badge || 'decisioning-items';
  const isAdded = isInCart(itemName, itemCategory);
  const hasCustomCTA = Boolean(content.ctaText && content.ctaUrl);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {content.image && content.image.startsWith('http') ? (
        <Image
          source={{ uri: content.image }}
          style={styles.cardImage}
          onError={() => console.log('DecisioningItems: Failed to load image:', content.image)}
        />
      ) : (
        <View style={[styles.cardImagePlaceholder, { backgroundColor: colors.card }]}>
          <ThemedText style={{ fontSize: 10 }}>IMG</ThemedText>
        </View>
      )}

      <View style={styles.cardContent}>
        <ThemedText style={styles.cardTitle}>
          {content.title || `Offer ${index + 1}`}
        </ThemedText>

        {content.description ? (
          <ThemedText style={styles.cardDescription} numberOfLines={8}>
            {content.description}
          </ThemedText>
        ) : null}

        {content.price ? (
          <ThemedText style={[styles.cardPrice, { color: colors.primary }]}>
            ${content.price}
          </ThemedText>
        ) : null}

        <TouchableOpacity
          onPress={() => {
            if (hasCustomCTA) {
              handleCustomCTA(item, content.ctaUrl!);
            } else {
              addToCart(item);
            }
          }}
          disabled={hasCustomCTA ? false : isAdded}
          style={[
            styles.cardButton,
            {
              backgroundColor: isAdded && !hasCustomCTA ? '#4CAF50' : colors.primary,
              opacity: hasCustomCTA ? 1 : isAdded ? 0.8 : 1,
            },
          ]}
        >
          <ThemedText style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
            {hasCustomCTA ? content.ctaText : isAdded ? 'Added to Cart' : 'Add to Cart'}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function DecisioningItemsTab() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { addToCart, isInCart } = useCart();
  const { cartSessionId, isLoading: isCartSessionLoading } = useCartSession();
  const { profile, isProfileLoading } = useProfileStorage();
  const router = useRouter();
  const [config, setConfig] = useState<DecisioningItemsConfig | null>(null);
  const [items, setItems] = useState<DecisioningItem[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [identityMap, setIdentityMap] = useState({});
  const displayedItemKeysRef = useRef(new Set<string>());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: DecisioningItem; isViewable?: boolean }> }) => {
    viewableItems.forEach(({ item, isViewable }) => {
      if (!isViewable) {
        return;
      }

      const trackingKey = buildDecisioningItemTrackingKey(item);
      if (displayedItemKeysRef.current.has(trackingKey)) {
        return;
      }

      displayedItemKeysRef.current.add(trackingKey);
      trackDecisioningItemDisplay(item).catch((trackingError) => {
        console.error('DecisioningItems: Error tracking visible item:', trackingError);
      });
    });
  });

  const styles = StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      marginVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
    cardImage: {
      width: 64,
      height: 64,
      borderRadius: 12,
      marginRight: 16,
    },
    cardImagePlaceholder: {
      width: 64,
      height: 64,
      borderRadius: 12,
      marginRight: 16,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardContent: {
      flex: 1,
      justifyContent: 'center',
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    cardDescription: {
      fontSize: 14,
      opacity: 0.7,
      marginBottom: 4,
    },
    cardPrice: {
      fontSize: 16,
      fontWeight: 'bold',
      marginTop: 4,
      marginBottom: 8,
    },
    cardButton: {
      marginTop: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignSelf: 'flex-start',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    loadingText: {
      marginTop: 16,
      textAlign: 'center',
    },
    errorContainer: {
      padding: 20,
      alignItems: 'center',
    },
    errorTitle: {
      fontSize: 18,
      marginBottom: 10,
      textAlign: 'center',
    },
    errorMessage: {
      textAlign: 'center',
      opacity: 0.8,
      marginBottom: 20,
    },
    errorHint: {
      textAlign: 'center',
      fontSize: 12,
      opacity: 0.6,
    },
    emptyContainer: {
      padding: 20,
      alignItems: 'center',
    },
    emptyTitle: {
      fontSize: 18,
      marginBottom: 10,
    },
    emptyMessage: {
      textAlign: 'center',
      opacity: 0.8,
      marginBottom: 20,
    },
    emptyHint: {
      textAlign: 'center',
      fontSize: 12,
      opacity: 0.6,
      marginBottom: 20,
    },
    refreshButton: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
      marginTop: 10,
    },
    refreshButtonText: {
      fontWeight: 'bold',
    },
    scrollContent: {
      padding: 16,
    },
  });

  const refreshIdentityMap = useCallback(async () => {
    try {
      const result = await Identity.getIdentities();
      if (result && (result as any).identityMap) {
        setIdentityMap((result as any).identityMap);
        return (result as any).identityMap;
      }
      setIdentityMap(result);
      return result;
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    refreshIdentityMap().catch((identityError) => {
      console.error('Failed to initialize identity map:', identityError);
    });
  }, [refreshIdentityMap]);

  const getCachedDecisioningItems = useCallback(async (configuration: DecisioningItemsConfig) => {
    try {
      const propositionsResult = await Messaging.getPropositionsForSurfaces([configuration.surface]);
      const propositionsArray = normalizePropositionsResult(propositionsResult);
      const extractedItems = processDecisioningPropositions(propositionsArray);
      if (extractedItems.length > 0) {
        displayedItemKeysRef.current.clear();
        setItems(extractedItems);
        setLastUpdated(new Date());
        setIsFromCache(true);
      }
      return extractedItems;
    } catch (fetchError: any) {
      if (!fetchError?.message?.includes('Unable to get Propositions')) {
        console.error('DecisioningItems: Error getting cached items:', fetchError);
      }
      return [];
    }
  }, []);

  const fetchDecisioningItemsFromServer = useCallback(async (configuration: DecisioningItemsConfig) => {
    try {
      await Messaging.updatePropositionsForSurfaces([configuration.surface]);
      const propositionsResult = await Messaging.getPropositionsForSurfaces([configuration.surface]);
      const propositionsArray = normalizePropositionsResult(propositionsResult);
      const extractedItems = processDecisioningPropositions(propositionsArray);
      displayedItemKeysRef.current.clear();
      setItems(extractedItems);
      setLastUpdated(new Date());
      setIsFromCache(false);
      setError(null);
      return extractedItems;
    } catch (fetchError: any) {
      if (fetchError?.message?.includes('Unable to get Propositions')) {
        setItems([]);
        setError(null);
        return [];
      }

      if (fetchError?.message?.includes('surface')) {
        setError('Invalid surface configuration');
      } else if (fetchError?.message?.includes('network')) {
        setError('Network error - check connection');
      } else {
        setError('Failed to fetch items from server');
      }

      throw fetchError;
    }
  }, []);

  const fetchDecisioningItems = useCallback(async (configuration: DecisioningItemsConfig) => {
    await getCachedDecisioningItems(configuration);
    await fetchDecisioningItemsFromServer(configuration);
  }, [fetchDecisioningItemsFromServer, getCachedDecisioningItems]);

  const loadConfigAndFetchItems = useCallback(async () => {
    try {
      setIsInitialLoading(true);
      setError(null);

      let savedConfig = await AsyncStorage.getItem(DECISIONING_ITEMS_CONFIG_KEY);

      if (!savedConfig) {
        const defaultConfig: DecisioningItemsConfig = {
          surface: DEFAULT_SURFACE,
          previewUrl: DEFAULT_PREVIEW_URL,
        };
        await AsyncStorage.setItem(DECISIONING_ITEMS_CONFIG_KEY, JSON.stringify(defaultConfig));
        savedConfig = JSON.stringify(defaultConfig);
      }

      const parsedConfig = JSON.parse(savedConfig) as DecisioningItemsConfig;
      setConfig(parsedConfig);

      if (!parsedConfig.surface) {
        setError('Invalid configuration: Surface/Location is required');
        return;
      }

      await fetchDecisioningItems(parsedConfig);
    } catch (loadError: any) {
      if (!loadError?.message?.includes('Unable to get Propositions')) {
        console.error('DecisioningItems: Error loading config or fetching items:', loadError);
        setError('Failed to load configuration or fetch items');
      }
    } finally {
      setIsInitialLoading(false);
    }
  }, [fetchDecisioningItems]);

  useFocusEffect(
    useCallback(() => {
      const handleFocus = async () => {
        await loadConfigAndFetchItems();

        if (isProfileLoading) {
          console.log('DecisioningItems - Profile not yet loaded from storage, skipping page view');
          return;
        }

        const currentIdentityMap = await refreshIdentityMap();
        if (!currentIdentityMap || Object.keys(currentIdentityMap).length === 0) {
          console.log('DecisioningItems - IdentityMap not ready, skipping page view');
          return;
        }

        try {
          const pageViewEvent = await buildPageViewEvent({
            identityMap: currentIdentityMap,
            profile,
            pageTitle: 'Decisioning Items',
            pagePath: '/decisioning-items',
            pageType: 'decisioning',
          });

          await Edge.sendEvent(pageViewEvent);
        } catch (pageViewError) {
          console.error('Error sending decisioning items page view:', pageViewError);
        }
      };

      handleFocus();
    }, [loadConfigAndFetchItems, refreshIdentityMap, isProfileLoading, profile])
  );

  const handleAddToCart = async (item: DecisioningItem) => {
    const content = parseDecisioningItemContent(item);
    try {
      await trackDecisioningItemInteraction(item, 'click');
    } catch (trackError) {
      console.error('[DecisioningItems] Failed to track interaction:', trackError);
    }

    addToCart({
      name: content.title || 'Unnamed Offer',
      title: content.title || 'Unnamed Offer',
      category: content.badge || 'decisioning-items',
      sku: item.id,
      price: parseFloat(content.price || '0'),
      image: content.image || '',
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

    try {
      const productListAddEvent = await buildProductListAddEvent({
        identityMap: currentIdentityMap,
        profile,
        product: {
          sku: item.id,
          name: content.title || 'Unnamed Offer',
          price: parseFloat(content.price || '0'),
          category: content.badge || 'decisioning-items',
          quantity: 1,
        },
        cartSessionId,
      });

      await Edge.sendEvent(productListAddEvent);
    } catch (trackingError) {
      console.error('Error sending decisioning item add to cart event:', trackingError);
    }
  };

  const handleCustomCTA = async (item: DecisioningItem, url: string) => {
    await trackDecisioningItemInteraction(item, 'click');

    try {
      if (url.startsWith('myapp://') || url.startsWith('com.cmtBootCamp.AEPSampleAppNewArchEnabled://')) {
        const path = url.split('://')[1];
        router.push(`/${path}` as any);
        return;
      }

      if (url.startsWith('http://') || url.startsWith('https://')) {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          console.error('Cannot open URL:', url);
        }
        return;
      }

      router.push(url as any);
    } catch (ctaError) {
      console.error('Error handling custom CTA:', ctaError);
    }
  };

  const refreshDecisioningItems = async () => {
    if (!config) {
      await loadConfigAndFetchItems();
      return;
    }

    setIsRefreshing(true);
    setError(null);
    try {
      await fetchDecisioningItemsFromServer(config);
    } catch (refreshError) {
      console.error('DecisioningItems: Error during manual refresh:', refreshError);
      setError('Failed to refresh items');
    } finally {
      setIsRefreshing(false);
    }
  };

  const renderConfigError = () => (
    <View style={styles.errorContainer}>
      <ThemedText style={styles.errorTitle}>
        Configuration Required
      </ThemedText>
      <ThemedText style={styles.errorMessage}>
        {error}
      </ThemedText>
      <ThemedText style={styles.errorHint}>
        Go to Technical View to configure surface and preview URL
      </ThemedText>
    </View>
  );

  const renderNoItems = () => (
    <View style={styles.emptyContainer}>
      <ThemedText style={styles.emptyTitle}>
        No Items Available
      </ThemedText>
      <ThemedText style={styles.emptyMessage}>
        No decisioning items found for this surface.
      </ThemedText>
      {config ? (
        <>
          <ThemedText style={styles.emptyHint}>Surface: {config.surface}</ThemedText>
          <ThemedText style={[styles.emptyHint, { marginTop: 10, fontWeight: 'bold' }]}>
            To display items:
          </ThemedText>
          <ThemedText style={[styles.emptyHint, { marginTop: 5 }]}>
            1. Create a Code-Based Experience campaign in Adobe Journey Optimizer
          </ThemedText>
          <ThemedText style={[styles.emptyHint, { marginTop: 2 }]}>
            2. Set the surface to: {config.surface}
          </ThemedText>
          <ThemedText style={[styles.emptyHint, { marginTop: 2 }]}>
            3. Publish the campaign
          </ThemedText>
        </>
      ) : null}
      <TouchableOpacity
        style={[styles.refreshButton, { backgroundColor: colors.primary }]}
        onPress={refreshDecisioningItems}
        disabled={isInitialLoading || isRefreshing}
      >
        <ThemedText style={[styles.refreshButtonText, { color: colors.background }]}>
          {isRefreshing ? 'Refreshing...' : 'Refresh Items'}
        </ThemedText>
      </TouchableOpacity>
    </View>
  );

  const renderListEmpty = () => {
    if (error) {
      return renderConfigError();
    }

    if (isInitialLoading && lastUpdated === null) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={styles.loadingText}>
            Fetching personalized items...
          </ThemedText>
        </View>
      );
    }

    return renderNoItems();
  };

  return (
    <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
      <FlatList
        data={items}
        renderItem={({ item, index }) => (
          <DecisioningItemCard
            item={item}
            index={index}
            colors={colors}
            styles={styles}
            addToCart={handleAddToCart}
            isInCart={isInCart}
            handleCustomCTA={handleCustomCTA}
          />
        )}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderListEmpty}
        contentContainerStyle={styles.scrollContent}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshDecisioningItems}
            tintColor={colors.primary}
          />
        }
      />
    </ThemedView>
  );
}
