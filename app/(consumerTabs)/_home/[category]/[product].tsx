import productsData from '../../../productData/bootcamp_products.json';
import { PRODUCT_IMAGES } from '../[category]';

// Define a type for the product data
interface Product {
  sku: string;
  product: {
    name: string;
    categories: {
      primary: string;
      secondary: string;
    };
    price: number;
    image: string;
    description: string;
  };
}

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const options = {
  tabBarButton: () => null,
};

import React, { useState, useCallback, useEffect } from 'react';
import { ThemedView } from '../../../../components/ThemedView';
import { ThemedText } from '../../../../components/ThemedText';
import { View, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Edge } from '@adobe/react-native-aepedge';
import { Identity } from '@adobe/react-native-aepedgeidentity';
import { useTheme, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useCart } from '../../../../components/CartContext';
import { useCartSession } from '../../../../hooks/useCartSession';
import { buildProductViewEvent, buildProductListAddEvent } from '../../../../src/utils/xdmEventBuilders';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';

const PRODUCT_ICONS: { [key: string]: any } = {
  // Family
  'Family Tent (6-person)': 'home',
  'Family Sleeping Bag Set': 'bed',
  'Family Camping Cookware': 'restaurant',
  "Kids' Hiking Boots": 'walk',
  // Men
  "Men's Hiking Boots": 'walk',
  "Men's Waterproof Jacket": 'rainy',
  "Men's Trekking Pants": 'body',
  "Men's Base Layer Shirt": 'shirt',
  // Women
  "Women's Hiking Boots": 'walk',
  "Women's Insulated Jacket": 'snow',
  "Women's Hiking Backpack": 'briefcase',
  "Women's Quick-Dry Pants": 'body',
  // Travel
  'Lightweight Travel Backpack': 'briefcase',
  'Packable Rain Jacket': 'rainy',
  'Travel Hammock': 'bed',
  'Portable Water Filter': 'water',
  // Experiences
  'Guided Mountain Hike': 'trail-sign',
  'Family Camping Weekend': 'bonfire',
  'Desert Survival Course': 'sunny',
  'Kayak Adventure Tour': 'boat',
  // Water
  'Inflatable Kayak': 'boat',
  'Waterproof Dry Bag': 'water',
  'Water Purification Tablets': 'water',
  'Fishing Kit': 'fish',
  // Desert
  'Desert Tent': 'home',
  'Sun Protection Hat': 'sunny',
  'Hydration Pack': 'water',
  'Sand-Proof Blanket': 'bed',
  // Mountain
  'Mountaineering Boots': 'walk',
  'Crampons': 'snow',
  'Down Sleeping Bag': 'bed',
  'Avalanche Safety Kit': 'alert',
};

export default function ProductDetail() {
  const { category, product } = useLocalSearchParams<{ category: string; product: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { addToCart, isInCart } = useCart();
  const navigation = useNavigation();
  const { cartSessionId, isLoading: isCartSessionLoading } = useCartSession();

  const [identityMap, setIdentityMap] = useState({});

  // Find the product in the JSON data
  const productData = (productsData as Product[]).find(
    (p: Product) => slugify(p.product.name) === product
  );

  const productSku = productData?.sku;

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

  // Send product view when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const handleFocus = async () => {
        if (!productData) return;

        // Check if identityMap is ready
        if (!identityMap || Object.keys(identityMap).length === 0) {
          console.log('Product Detail - IdentityMap not ready, skipping product view');
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

        // Send product view event
        try {
          const productViewEvent = await buildProductViewEvent({
            identityMap,
            profile: currentProfile,
            product: {
              sku: productSku || '',
              name: productData.product.name,
              price: productData.product.price,
              category: category
            }
          });

          console.log('📤 Sending product view event:', productData.product.name);
          await Edge.sendEvent(productViewEvent);
          
          console.log('✅ Product view sent successfully:', {
            name: productData.product.name,
            sku: productSku,
            price: productData.product.price,
            category
          });
        } catch (error) {
          console.error('❌ Error sending product view:', error);
        }
      };

      handleFocus();
    }, [productData, category, productSku, identityMap])
  );

  //console.log({ category, product, productData });

  if (!productData) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Product not found.</ThemedText>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
          <ThemedText style={{ color: colors.primary }}>Back</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  if (!productSku) {
    //console.error('Product SKU is undefined for product:', productData?.product.name);
    return null;
  }

  const handleAddToCart = async () => {
    // Add to cart context
    addToCart({
      category: category ?? '',
      name: productData.product.name,
      title: productData.product.name,
      price: productData.product.price,
      sku: productSku,
      image: productData.product.image,
    });

    // Check prerequisites for analytics
    if (isCartSessionLoading || !cartSessionId) {
      console.log('Cart session not ready, skipping add to cart event');
      return;
    }

    if (!identityMap || Object.keys(identityMap).length === 0) {
      console.log('IdentityMap not ready, skipping add to cart event');
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

    // Send product list add event
    try {
      const productListAddEvent = await buildProductListAddEvent({
        identityMap,
        profile: currentProfile,
        product: {
          sku: productSku || '',
          name: productData.product.name,
          price: productData.product.price,
          category: category,
          quantity: 1
        },
        cartSessionId
      });

      console.log('📤 Sending add to cart event:', productData.product.name);
      await Edge.sendEvent(productListAddEvent);
      
      console.log('✅ Add to cart event sent successfully:', {
        name: productData.product.name,
        sku: productSku,
        price: productData.product.price,
        cartSessionId
      });
    } catch (error) {
      console.error('❌ Error sending add to cart event:', error);
    }
  };

  const added = isInCart(productData.product.name, category ?? '');

  return (
    <ThemedView style={{ flex: 1, paddingTop: 48, paddingHorizontal: 24 }}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 10, alignSelf: 'flex-start', marginBottom: 16 }}>
        <ThemedText style={{ color: colors.primary }}>Back</ThemedText>
      </TouchableOpacity>
      <View style={styles.image}>
        <Image
          source={PRODUCT_IMAGES[productSku]}
          style={{ width: 160, height: 160, position: 'absolute', left: 0, top: 0, zIndex: 2, borderRadius: 15 }}
          onError={(error) => console.error('Error loading image for product:', productData?.product.name, error)}
        />
      </View>
      <ThemedText style={styles.title}>{productData.product.name}</ThemedText>
      <ThemedText style={styles.description}>{productData.product.description}</ThemedText>
      <ThemedText style={styles.price}>${productData.product.price.toFixed(2)}</ThemedText>
      <TouchableOpacity
        style={[
          styles.addToCartButton,
          { 
            backgroundColor: added ? '#4CAF50' : colors.primary,
            opacity: added ? 0.8 : 1
          },
        ]}
        onPress={handleAddToCart}
        disabled={added}
      >
        <ThemedText style={[styles.addToCartText, { color: '#fff' }]}>
          {added ? 'Added to Cart' : 'Add to Cart'}
        </ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  image: {
    width: 160,
    height: 160,
    backgroundColor: '#cce3de',
    borderRadius: 16,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 12,
  },
  addToCartButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 16,
  },
  addToCartText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  added: {
  },
}); 