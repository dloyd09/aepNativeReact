/**
 * Decisioning Items Consumer Tab
 * 
 * This component displays Code-Based Experiences from Adobe Journey Optimizer.
 * It uses the Adobe Messaging SDK to fetch and display personalized content based on
 * the surface configuration set in the DecisioningItemsView technical screen.
 * 
 * Key features:
 * - Fetches CBE content using configured surface via Messaging.updatePropositionsForSurfaces
 * - Displays personalized offers and experiences
 * - Handles proposition updates and tracking with built-in methods
 * - Integrates with AJO campaigns
 * 
 * Author: AI Assistant for Decisioning Items implementation
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Image, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MobileCore, LogLevel } from '@adobe/react-native-aepcore';
import { Messaging, MessagingEdgeEventType } from '@adobe/react-native-aepmessaging';
import { Edge } from '@adobe/react-native-aepedge';
import { Identity } from '@adobe/react-native-aepedgeidentity';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useCart } from '@/components/CartContext';
import { useCartSession } from '@/hooks/useCartSession';
import { buildPageViewEvent, buildProductListAddEvent } from '@/src/utils/xdmEventBuilders';

// Storage key for Decisioning Items configuration
const DECISIONING_ITEMS_CONFIG_KEY = '@decisioning_items_config';
const LEGACY_EDGE_OFFERS_CONFIG_KEY = '@edge_offers_config'; // For migration from old key

interface DecisioningItemsConfig {
  surface: string;
  previewUrl: string;
  activityId?: string;
  description?: string;
}

interface DecisioningItem {
  id: string;
  itemID?: string;
  content: any;
  format?: string;
  proposition: any;
  propositionItem: any;
  surface: string;
  trackingToken?: string;
  isEmbeddedItem?: boolean;
}

interface ParsedContent {
  title: string | null;
  subtitle: string | null;
  description: string | null;
  image: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  price: string | null;
  discount: string | null;
  badge: string | null;
  priority: string | null;
  tone: string | null;
  itemID: string | null;
  trackingToken: string | null;
  raw: any;
}

// Enhanced JSON parsing to extract common AJO campaign content
const parseItemContent = (item: DecisioningItem): ParsedContent => {
  let parsedContent = item.content;
  
  // If content is a string, try to parse it as JSON
  if (typeof item.content === 'string') {
    try {
      parsedContent = JSON.parse(item.content);
    } catch (e) {
      parsedContent = { text: item.content };
    }
  }

  // Extract common fields from various possible JSON structures
  const extractValue = (obj: any, keys: string[]) => {
    for (const key of keys) {
      if (obj && typeof obj === 'object' && obj[key]) {
        return obj[key];
      }
    }
    return null;
  };

  return {
    // For individual offers, use the expected Adobe format field names
    title: extractValue(parsedContent, ['name', 'IVRmessage', 'title', 'headline', 'header', 'label']),
    subtitle: extractValue(parsedContent, ['subtitle', 'subheader', 'subheading', 'tagline']),
    description: extractValue(parsedContent, ['description', 'body', 'text', 'content', 'message']),
    image: extractValue(parsedContent, ['image', 'imageUrl', 'img', 'picture', 'photo']),
    ctaText: extractValue(parsedContent, ['ctaText', 'buttonText', 'linkText', 'actionText', 'cta']),
    ctaUrl: extractValue(parsedContent, ['ctaUrl', 'buttonUrl', 'linkUrl', 'actionUrl', 'url', 'link']),
    price: extractValue(parsedContent, ['price', 'cost', 'amount', 'value']),
    discount: extractValue(parsedContent, ['discount', 'savings', 'offer', 'deal']),
    badge: extractValue(parsedContent, ['classification', 'badge', 'tag', 'label', 'category']),
    priority: extractValue(parsedContent, ['priority', 'importance', 'weight']),
    tone: extractValue(parsedContent, ['IVRtone', 'tone']),
    itemID: extractValue(parsedContent, ['itemID', 'id']),
    trackingToken: extractValue(parsedContent, ['data-item-token', 'trackingToken', '_trackingToken']),
    raw: parsedContent // Keep raw content for debugging
  };
};

interface DecisioningItemCardProps {
  item: DecisioningItem;
  index: number;
  colors: any;
  styles: any;
  addToCart: (item: DecisioningItem) => void;
  onLayout: (item: DecisioningItem) => void;
  isInCart: (name: string, category: string) => boolean;
}

const DecisioningItemCard = ({ item, index, colors, styles, addToCart, onLayout, isInCart }: DecisioningItemCardProps) => {
  const content = parseItemContent(item);
  const itemName = content.title || 'Unnamed Offer';
  const itemCategory = content.badge || 'decisioning-items';
  const isAdded = isInCart(itemName, itemCategory);
  
  const handleAddToCart = () => {
    addToCart(item);
  };
  
  return (
    <View
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onLayout={() => onLayout(item)}
    >
      {/* Image on the left (like offers.tsx) */}
      {content.image && content.image.startsWith('http') ? (
        <Image
          source={{ uri: content.image }}
          style={styles.cardImage}
          onError={() => console.log('🔴 DecisioningItems: Failed to load image:', content.image)}
        />
      ) : (
        <View style={[styles.cardImagePlaceholder, { backgroundColor: colors.card }]}>
          <ThemedText style={{ fontSize: 10 }}>📦</ThemedText>
        </View>
      )}

      {/* Content on the right (like offers.tsx) */}
      <View style={styles.cardContent}>
        <ThemedText style={styles.cardTitle}>
          {content.title || `Offer ${index + 1}`}
        </ThemedText>
        
        {content.description && (
          <ThemedText style={styles.cardDescription} numberOfLines={8}>
            {content.description}
          </ThemedText>
        )}
        
        {content.price && (
          <ThemedText style={[styles.cardPrice, { color: colors.primary }]}>
            ${content.price}
          </ThemedText>
        )}
        
        <TouchableOpacity 
          onPress={handleAddToCart}
          disabled={isAdded}
          style={[
            styles.cardButton, 
            { 
              backgroundColor: isAdded ? '#4CAF50' : colors.primary,
              opacity: isAdded ? 0.8 : 1
            }
          ]}
        >
          <ThemedText style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
            {isAdded ? 'Added to Cart' : 'Add to Cart'}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function DecisioningItemsTab() {
  const { colors } = useTheme();
  const { addToCart, isInCart } = useCart();
  const { cartSessionId, isLoading: isCartSessionLoading } = useCartSession();

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
    headerSection: {
      marginBottom: 12,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 4,
    },
    titleText: {
      fontWeight: 'bold',
      fontSize: 18,
      flex: 1,
      marginRight: 8,
    },
    subtitleText: {
      fontSize: 14,
      fontWeight: '600',
      opacity: 0.9,
      marginBottom: 4,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    priceText: {
      fontSize: 16,
      fontWeight: 'bold',
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: 'bold',
    },
    discountBadge: {
      backgroundColor: '#ff4444',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginTop: 4,
      alignSelf: 'flex-start',
    },
    discountText: {
      color: 'white',
      fontSize: 12,
      fontWeight: 'bold',
    },
    descriptionText: {
      marginBottom: 12,
      opacity: 0.8,
      lineHeight: 20,
      fontSize: 14,
    },
    imageContainer: {
      marginBottom: 12,
      alignItems: 'center',
    },
    image: {
      width: '100%',
      height: 140,
      borderRadius: 8,
      marginBottom: 4,
    },
    imagePlaceholder: {
      width: '100%',
      height: 80,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    imagePlaceholderText: {
      fontSize: 12,
      opacity: 0.7,
      textAlign: 'center',
    },
    footerSection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
    },
    metadataText: {
      fontSize: 11,
      opacity: 0.6,
    },
    ctaButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    ctaText: {
      fontSize: 14,
      fontWeight: 'bold',
    },
    debugInfo: {
      marginTop: 8,
      padding: 8,
      borderRadius: 4,
      borderWidth: 1,
    },
    debugText: {
      fontSize: 10,
      opacity: 0.6,
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
    headerContainer: {
      marginBottom: 20,
    },
    headerTitle: {
      marginBottom: 5,
    },
    headerSubtitle: {
      opacity: 0.7,
      fontSize: 14,
    },
    timestampRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 5,
    },
    timestampText: {
      opacity: 0.5,
      fontSize: 12,
    },
    statusBadge: {
      marginLeft: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    statusText: {
      fontSize: 10,
      fontWeight: 'bold',
    },
    configContainer: {
      padding: 12,
      borderRadius: 6,
      marginBottom: 20,
      borderWidth: 1,
    },
    configTitle: {
      fontWeight: 'bold',
      marginBottom: 5,
    },
    configText: {
      fontSize: 12,
      opacity: 0.8,
    },
    configItemsText: {
      fontSize: 12,
      opacity: 0.8,
      marginTop: 4,
    },
  });

  // Component state
  const [config, setConfig] = useState<DecisioningItemsConfig | null>(null);
  const [items, setItems] = useState<DecisioningItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
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

  // Load configuration and fetch items when tab becomes focused
  useFocusEffect(
    useCallback(() => {
      const handleFocus = async () => {
        loadConfigAndFetchItems();
        
        // Send page view with XDM schema
        if (!identityMap || Object.keys(identityMap).length === 0) {
          console.log('DecisioningItems - IdentityMap not ready, skipping page view');
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
            pageTitle: 'Decisioning Items',
            pagePath: '/decisioning-items',
            pageType: 'decisioning',
            siteSection2: 'Shopping',
            siteSection3: 'Personalized Offers'
          });

          console.log('📤 Sending decisioning items page view event');
          await Edge.sendEvent(pageViewEvent);
          
          console.log('✅ Decisioning items page view sent successfully');
        } catch (error) {
          console.error('❌ Error sending decisioning items page view:', error);
        }
      };

      handleFocus();
    }, [identityMap])
  );

  const loadConfigAndFetchItems = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load saved configuration
      let savedConfig = await AsyncStorage.getItem(DECISIONING_ITEMS_CONFIG_KEY);
      
      // If no new config found, check for legacy Edge Offers config and migrate
      if (!savedConfig) {
        const legacyConfig = await AsyncStorage.getItem(LEGACY_EDGE_OFFERS_CONFIG_KEY);
        
        if (legacyConfig) {
          // Migrate the config
          await AsyncStorage.setItem(DECISIONING_ITEMS_CONFIG_KEY, legacyConfig);
          // Optionally remove the old config
          await AsyncStorage.removeItem(LEGACY_EDGE_OFFERS_CONFIG_KEY);
          savedConfig = legacyConfig;
        }
      }
      
      if (!savedConfig) {
        setError('No Decisioning Items configuration found. Please configure in Technical View → Decisioning Items');
        setIsLoading(false);
        return;
      }

      const parsedConfig = JSON.parse(savedConfig);
      setConfig(parsedConfig);

      // Validate required fields
      if (!parsedConfig.surface) {
        setError('Invalid configuration: Surface/Location is required');
        setIsLoading(false);
        return;
      }

      // Fetch items for the configured surface
      await fetchDecisioningItems(parsedConfig);
    } catch (error) {
      console.error('🔴 DecisioningItems: Error loading config or fetching items:', error);
      setError('Failed to load configuration or fetch items');
    } finally {
      setIsLoading(false);
    }
  };

  // Get cached decisioning items (similar to offers tab pattern)
  const getCachedDecisioningItems = async (configuration: DecisioningItemsConfig) => {
    try {
      const surface = configuration.surface;
      const propositionsResult = await Messaging.getPropositionsForSurfaces([surface]);
      
      // Convert propositions result to array if needed
      let propositionsArray: any[] = [];
      if (Array.isArray(propositionsResult)) {
        propositionsArray = propositionsResult;
      } else if (propositionsResult && typeof propositionsResult === 'object') {
        propositionsArray = Object.values(propositionsResult).flat();
      }

      if (propositionsArray.length > 0) {
        // Process cached propositions into items
        const extractedItems = processPropositions(propositionsArray);
        setItems(extractedItems);
        setLastUpdated(new Date());
        setIsFromCache(true);
        return extractedItems;
      } else {
        return [];
      }
      
    } catch (error: any) {
      console.error('🔴 DecisioningItems: Error getting cached items:', error);
      return [];
    }
  };

  // Fetch decisioning items from server and cache (like updatePropositions in offers)
  const fetchDecisioningItemsFromServer = async (configuration: DecisioningItemsConfig) => {
    try {
      const surface = configuration.surface;

      // Fetch propositions from server and cache them
      await Messaging.updatePropositionsForSurfaces([surface]);
      
      // Now get the newly cached propositions (but don't mark as "from cache" since we just fetched)
      const propositionsResult = await Messaging.getPropositionsForSurfaces([surface]);
      
      let propositionsArray: any[] = [];
      if (Array.isArray(propositionsResult)) {
        propositionsArray = propositionsResult;
      } else if (propositionsResult && typeof propositionsResult === 'object') {
        propositionsArray = Object.values(propositionsResult).flat();
      }
      
      let extractedItems: DecisioningItem[] = [];
      if (propositionsArray.length > 0) {
        extractedItems = processPropositions(propositionsArray);
        setItems(extractedItems);
        setLastUpdated(new Date());
      }
      
      // Mark as freshly fetched (not from cache)
      setIsFromCache(false);
      
      return extractedItems;
      
    } catch (error: any) {
      console.error('🔴 DecisioningItems: Error fetching from server:', error);
      
      // Handle specific error types
      if (error?.message?.includes('surface')) {
        setError('Invalid surface configuration');
      } else if (error?.message?.includes('network')) {
        setError('Network error - check connection');
      } else {
        setError('Failed to fetch items from server');
      }
      
      throw error;
    }
  };

  // Main function to get decisioning items (cache first, then server if needed)
  const fetchDecisioningItems = async (configuration: DecisioningItemsConfig) => {
    try {
      // First, try to get cached items
      const cachedItems = await getCachedDecisioningItems(configuration);
      
      if (cachedItems.length > 0) {
        return;
      }

      // If no cached items, fetch from server
      await fetchDecisioningItemsFromServer(configuration);
      
    } catch (error: any) {
      console.error('🔴 DecisioningItems: Error in fetchDecisioningItems:', error);
      setItems([]);
      throw error;
    }
  };

  // Process propositions into items
  const processPropositions = (propositions: any[]): DecisioningItem[] => {
    const items: DecisioningItem[] = [];
    
    propositions.forEach((proposition, index) => {
      proposition.items.forEach((item: any, itemIndex: number) => {
        const content = item.data?.content || item.data;
        
        // If content is a string, try to parse it
        let parsedContent = content;
        if (typeof content === 'string') {
          try {
            parsedContent = JSON.parse(content);
          } catch (e) {
            parsedContent = content;
          }
        }
        
        // Check if this JSON content contains an isJsonContent array that we need to unpack
        if (item.schema === 'https://ns.adobe.com/personalization/json-content-item') {
          // Check multiple possible locations for the isJsonContent array
          let isJsonContentArray = null;
          
          // Check direct access
          if (parsedContent && Array.isArray(parsedContent.isJsonContent)) {
            isJsonContentArray = parsedContent.isJsonContent;
          }
          // Check if parsedContent itself is the array
          else if (Array.isArray(parsedContent)) {
            isJsonContentArray = parsedContent;
          }
          
          if (isJsonContentArray && isJsonContentArray.length > 0) {
            
            // CRITICAL: For embedded items (isJsonContent array), Adobe's tutorial requires:
            // 1. Track through the PARENT PropositionItem that contains the embedded array
            // 2. Pass individual tracking tokens to identify which embedded item was displayed/clicked
            // 3. Do NOT look for individual track methods on embedded items - they don't have them
            isJsonContentArray.forEach((offer: any, offerIndex: number) => {
              // Use the actual item ID from Adobe instead of creating derived ones
              const itemId = offer.id || offer.itemID || `fallback_${Date.now()}_${offerIndex}`;
              const trackingToken = offer['data-item-token'] || offer.trackingToken;
              
              items.push({
                id: itemId,
                itemID: offer.itemID,
                content: offer, // Store the individual offer as content
                format: 'application/json',
                proposition: proposition,
                propositionItem: item, // PARENT PropositionItem that contains the track() method
                surface: proposition.scope,
                trackingToken: trackingToken,
                isEmbeddedItem: true // Flag: this offer came from isJsonContent array, track via parent
              });
            });
          } else {
            // Regular JSON content without isJsonContent array
            items.push({
              id: item.id || `json_${Date.now()}_${itemIndex}`,
              content: parsedContent,
              format: 'application/json',
              proposition: proposition,
              propositionItem: item,
              surface: proposition.scope
            });
          }
        }
        // Handle HTML content
        else if (item.schema === 'https://ns.adobe.com/personalization/html-content-item') {
          items.push({
            id: item.id || `html_${Date.now()}_${itemIndex}`,
            content: parsedContent,
            format: 'text/html',
            proposition: proposition,
            propositionItem: item,
            surface: proposition.scope
          });
        }
        // Handle other content types
        else {
          items.push({
            id: item.id || `generic_${Date.now()}_${itemIndex}`,
            content: parsedContent,
            format: 'unknown',
            proposition: proposition,
            propositionItem: item,
            surface: proposition.scope
          });
        }
      });
    });
    
    return items;
  };

  // Track item display - Following Adobe's official tutorial for embedded decisions
  const trackItemDisplay = (item: DecisioningItem) => {
    try {
      // According to Adobe's tutorial for embedded decisions:
      // "Since the embedded items are located inside a single PropositionItem data, 
      // the app developer will need to extract the data-item-token when tracking"
      // https://developer.adobe.com/client-sdks/edge/adobe-journey-optimizer/code-based/tutorial/
      
      if (item.propositionItem && typeof item.propositionItem.track === 'function') {
        if (item.trackingToken && item.isEmbeddedItem) {
          // For embedded items, track with token using the parent PropositionItem
          item.propositionItem.track(null, MessagingEdgeEventType.DISPLAY, [item.trackingToken]);
        } else {
          // For regular items or when no token available
          item.propositionItem.track(null, MessagingEdgeEventType.DISPLAY);
        }
      } 
    } catch (error) {
      console.error('🔴 DecisioningItems: Error tracking display:', error);
    }
  };

  // Track item interaction - Following Adobe's official tutorial for embedded decisions
  const trackItemInteraction = (item: DecisioningItem, interaction: string) => {
    try {
      // According to Adobe's tutorial for embedded decisions:
      // Track interactions through the parent PropositionItem with tokens
      // https://developer.adobe.com/client-sdks/edge/adobe-journey-optimizer/code-based/tutorial/
      
      if (item.propositionItem && typeof item.propositionItem.track === 'function') {
        if (item.trackingToken && item.isEmbeddedItem) {
          // For embedded items, track with token using the parent PropositionItem
          item.propositionItem.track(interaction, MessagingEdgeEventType.INTERACT, [item.trackingToken]);
        } else {
          // For regular items or when no token available
          item.propositionItem.track(interaction, MessagingEdgeEventType.INTERACT);
        }
      } 
    } catch (error) {
      console.error('🔴 DecisioningItems: Error tracking interaction:', error);
    }
  };

  const handleAddToCart = async (item: DecisioningItem) => {
    // Track the interaction using Adobe's recommended "click" interaction for propositions
    trackItemInteraction(item, 'click');
    
    const content = parseItemContent(item);

    // Add to cart context first
    addToCart({
      name: content.title || 'Unnamed Offer',
      title: content.title || 'Unnamed Offer',
      category: content.badge || 'decisioning-items',
      sku: item.id,
      price: parseFloat(content.price || '0'),
      image: content.image || ''
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
      const storedProfile = await AsyncStorage.getItem('userProfile');
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
          sku: item.id,
          name: content.title || 'Unnamed Offer',
          price: parseFloat(content.price || '0'),
          category: content.badge || 'decisioning-items',
          quantity: 1
        },
        cartSessionId
      });

      console.log('📤 Sending decisioning item add to cart event:', content.title);
      await Edge.sendEvent(productListAddEvent);
      
      console.log('✅ Decisioning item add to cart event sent successfully:', {
        name: content.title,
        sku: item.id,
        price: content.price,
        cartSessionId,
        propositionId: item.proposition?.id
      });
    } catch (error) {
      console.error('❌ Error sending decisioning item add to cart event:', error);
    }
  };

  const renderItem = (item: DecisioningItem, index: number) => {
    return (
      <DecisioningItemCard
        item={item}
        index={index}
        colors={colors}
        styles={styles}
        addToCart={handleAddToCart}
        onLayout={trackItemDisplay}
        isInCart={isInCart}
      />
    );
  };

  // Refresh items from server (like offers tab)
  const refreshDecisioningItems = async () => {
    if (!config) {
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      await fetchDecisioningItemsFromServer(config);
    } catch (error) {
      console.error('🔴 DecisioningItems: Error during manual refresh:', error);
      setError('Failed to refresh items');
    } finally {
      setIsLoading(false);
    }
  };

  const renderConfigError = () => (
    <View style={styles.errorContainer}>
      <ThemedText style={styles.errorTitle}>
        ⚙️ Configuration Required
      </ThemedText>
      <ThemedText style={styles.errorMessage}>
        {error}
      </ThemedText>
      <ThemedText style={styles.errorHint}>
        Go to Technical View → Decisioning Items to configure surface and preview URL
      </ThemedText>
    </View>
  );

  const renderNoItems = () => (
    <View style={styles.emptyContainer}>
      <ThemedText style={styles.emptyTitle}>
        📭 No Items Available
      </ThemedText>
      <ThemedText style={styles.emptyMessage}>
        No personalized items found for the configured surface.
      </ThemedText>
      {config && (
        <ThemedText style={styles.emptyHint}>
          Surface: {config.surface}
        </ThemedText>
      )}
      <TouchableOpacity
        style={[styles.refreshButton, { backgroundColor: colors.primary }]}
        onPress={refreshDecisioningItems}
        disabled={isLoading}
      >
        <ThemedText style={[styles.refreshButtonText, { color: colors.background }]}>
          {isLoading ? 'Refreshing...' : 'Refresh Items'}
        </ThemedText>
      </TouchableOpacity>
    </View>
  );

  const renderListHeader = () => (
    <>
      {/* Header */}
      <View style={styles.headerContainer}>
       
      </View>

      {/* Configuration Info */}
      
    </>
  );

  const renderListEmpty = () => {
    if (error) {
      return renderConfigError();
    }

    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={styles.loadingText}>
            {items.length > 0 ? 'Refreshing personalized items...' : 'Fetching personalized items...'}
          </ThemedText>
        </View>
      );
    }

    return renderNoItems();
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <FlatList
        data={items}
        renderItem={({ item, index }) => renderItem(item, index)}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderListEmpty}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              if (config) {
                refreshDecisioningItems();
              } else {
                loadConfigAndFetchItems();
              }
            }}
            tintColor={colors.primary}
          />
        }
      />
    </ThemedView>
  );
}
