import productsData from '../../productData/bootcamp_products.json';
import { Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useState, useEffect } from 'react';
import { ThemedView } from '../../../components/ThemedView';
import { ThemedText } from '../../../components/ThemedText';
import { View, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Edge } from '@adobe/react-native-aepedge';
import { Identity } from '@adobe/react-native-aepedgeidentity';
import { buildPageViewEvent } from '../../../src/utils/xdmEventBuilders';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Predefine the image paths
const PRODUCT_IMAGES: { [key: string]: any } = {
  'meotsuamt': require('../../../assets/images/productImages/meotsuamt.png'),
  'meotsuann': require('../../../assets/images/productImages/meotsuann.png'),
  'eqswsuaqr': require('../../../assets/images/productImages/eqswsuaqr.png'),
  'woswsubas': require('../../../assets/images/productImages/woswsubas.png'),
  '30941863': require('../../../assets/images/productImages/30941863.png'),
  'eqsusubed': require('../../../assets/images/productImages/eqsusubed.png'),
  'eqbisublp': require('../../../assets/images/productImages/eqbisublp.png'),
  'eqrusubpe': require('../../../assets/images/productImages/eqrusubpe.png'),
  'meotwibrt': require('../../../assets/images/productImages/meotwibrt.png'),
  'mehisubus': require('../../../assets/images/productImages/mehisubus.png'),
  'eqswsucal': require('../../../assets/images/productImages/eqswsucal.png'),
  'wohisucat': require('../../../assets/images/productImages/wohisucat.png'),
  'eqsusuchd': require('../../../assets/images/productImages/eqsusuchd.png'),
  'meotwicls': require('../../../assets/images/productImages/meotwicls.png'),
  'eqbisucos': require('../../../assets/images/productImages/eqbisucos.png'),
  'eqbisucol': require('../../../assets/images/productImages/eqbisucol.png'),
  'mehisucos': require('../../../assets/images/productImages/mehisucos.png'),
  'wohisudes': require('../../../assets/images/productImages/wohisudes.png'),
  'wootsudet': require('../../../assets/images/productImages/wootsudet.png'),
  'meotwidot': require('../../../assets/images/productImages/meotwidot.png'),
  'meskwielt': require('../../../assets/images/productImages/meskwielt.png'),
  'eqsusuely': require('../../../assets/images/productImages/eqsusuely.png'),
  'meotsuett': require('../../../assets/images/productImages/meotsuett.png'),
  'eqsusuevd': require('../../../assets/images/productImages/eqsusuevd.png'),
  'mehiwiext': require('../../../assets/images/productImages/mehiwiext.png'),
  '116138647': require('../../../assets/images/productImages/116138647.png'),
  'eqrusufle': require('../../../assets/images/productImages/eqrusufle.png'),
  'wohisufls': require('../../../assets/images/productImages/wohisufls.png'),
  'eqwrsnbd': require('../../../assets/images/productImages/eqwrsnbd.png'),
  'eqrusugor': require('../../../assets/images/productImages/eqrusugor.png'),
  '331050524': require('../../../assets/images/productImages/331050524.png'),
  '170227049': require('../../../assets/images/productImages/170227049.png'),
  'mehisulat': require('../../../assets/images/productImages/mehisulat.png'),
  'eqswsumak': require('../../../assets/images/productImages/eqswsumak.png'),
  'eqbisumas': require('../../../assets/images/productImages/eqbisumas.png'),
  'meskwimis': require('../../../assets/images/productImages/meskwimis.png'),
  'eqbisumxs': require('../../../assets/images/productImages/eqbisumxs.png'),
  'mesusupis': require('../../../assets/images/productImages/mesusupis.png'),
  'meotwipot': require('../../../assets/images/productImages/meotwipot.png'),
  'eqswsuprs': require('../../../assets/images/productImages/eqswsuprs.png'),
  'eqswsupus': require('../../../assets/images/productImages/eqswsupus.png'),
  '90019930': require('../../../assets/images/productImages/90019930.png'),
  'wohisurit': require('../../../assets/images/productImages/wohisurit.png'),
  'eqsusurud': require('../../../assets/images/productImages/eqsusurud.png'),
  'eqswsuses': require('../../../assets/images/productImages/eqswsuses.png'),
  'eqbisuset': require('../../../assets/images/productImages/eqbisuset.png'),
  'woskwislt': require('../../../assets/images/productImages/woskwislt.png'),
  'meotwislt': require('../../../assets/images/productImages/meotwislt.png'),
  'mehisusls': require('../../../assets/images/productImages/mehisusls.png'),
  'woswsusoc': require('../../../assets/images/productImages/woswsusoc.png'),
  'wootwisot': require('../../../assets/images/productImages/wootwisot.png'),
  '84391210': require('../../../assets/images/productImages/84391210.png'),
  'mehisusts': require('../../../assets/images/productImages/mehisusts.png'),
  'meotwisus': require('../../../assets/images/productImages/meotwisus.png'),
  'mehisutrs': require('../../../assets/images/productImages/mehisutrs.png'),
  'meotsutrs': require('../../../assets/images/productImages/meotsutrs.png'),
  'meotwizuf': require('../../../assets/images/productImages/meotwizuf.png'),
};

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const options = {
  tabBarButton: () => null,
};

export default function CategoryProductList() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const navigation = useNavigation();

  const [identityMap, setIdentityMap] = useState({});

  // Filter products by category
  const products = productsData.filter(product => product.product.categories.primary.toLowerCase() === category?.toLowerCase());

  // Initialize identityMap on component mount
  useEffect(() => {
    console.log('Category - Fetching identities...');
    Identity.getIdentities().then((result) => {
      console.log('Category - Identity result:', JSON.stringify(result, null, 2));
      if (result && result.identityMap) {
        console.log('Category - Setting identityMap from result.identityMap');
        setIdentityMap(result.identityMap);
      } else {
        console.log('Category - Setting identityMap from result directly');
        setIdentityMap(result);
      }
    }).catch((error) => {
      console.error('Category - Error fetching identities:', error);
    });
  }, []);

  // Send page view when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const handleFocus = async () => {
        // Check if identityMap is ready
        if (!identityMap || Object.keys(identityMap).length === 0) {
          console.log('Category - IdentityMap not ready, skipping page view');
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

        const pageName = category ? category.charAt(0).toUpperCase() + category.slice(1) + ' Products' : 'Products';
        const categoryCapitalized = category ? category.charAt(0).toUpperCase() + category.slice(1) : undefined;

        // Send page view
        try {
          const pageViewEvent = await buildPageViewEvent({
            identityMap,
            profile: currentProfile,
            pageTitle: pageName,
            pagePath: `/home/${category}`,
            pageType: 'category',
            siteSection: 'Products',
            siteSection2: categoryCapitalized
          });

          console.log(`📤 Sending ${category} category page view event`);
          await Edge.sendEvent(pageViewEvent);
          
          console.log(`✅ Category page view sent: ${category} (${products.length} products)`);
        } catch (error) {
          console.error('❌ Error sending category page view:', error);
        }
      };

      handleFocus();
    }, [category, identityMap, products.length])
  );

  const handleProductPress = (productName: string) => {
    const path = `/(consumerTabs)/_home/${category}/${slugify(productName)}`;
    router.push(path as any);
  };

  const renderProduct = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity style={[styles.card, { backgroundColor: colors.card }]} onPress={() => handleProductPress(item.product.name)}>
        <Image
          source={PRODUCT_IMAGES[item.sku]}
          style={{ width: 62, height: 62, position: 'absolute', left: 17, top: 17, zIndex: 2, borderRadius: 15 }}
          onError={(error) => console.error('Error loading image for SKU:', item.sku, error)}
        />
        <View style={[styles.cardImage, { backgroundColor: '#e3eaf3' }]} />
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.cardTitle}>{item.product.name}</ThemedText>
          <ThemedText style={styles.cardDescription}>{item.product.categories.secondary}</ThemedText>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 10 }}>
        <ThemedText style={{ color: colors.primary }}>Back</ThemedText>
      </TouchableOpacity>
      <ThemedText style={styles.header}>{category ? `${category.charAt(0).toUpperCase() + category.slice(1)} Products` : 'Products'}</ThemedText>
      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={item => item.sku}
        contentContainerStyle={styles.list}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 32,
    marginBottom: 16,
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
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
    borderRadius: 12,
    marginRight: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
  },
});

export { PRODUCT_IMAGES }; 