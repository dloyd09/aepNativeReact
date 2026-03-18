/**
 * Automated checks for QA use cases (docs/QA-Use-Cases-Review.md).
 *
 * Verifies:
 * - Use case 2 (Purchase In-App Journey): commerce.purchases XDM shape and _adobecmteas.
 * - Use case 3 (Cart Views in CJA): mobileApp.navigation.pageViews with cart context
 *   (pageType 'cart', pagePath '/cart') so CJA can define "Cart Views" from this event.
 */

import { buildPageViewEvent, buildPurchaseEvent } from '../xdmEventBuilders';

// Mock ExperienceEvent as a constructor that returns an object with xdmData (so we can assert on return value)
jest.mock('@adobe/react-native-aepedge', () => ({
  ExperienceEvent: function (opts: { xdmData?: any }) {
    return { xdmData: opts?.xdmData ?? {} };
  },
}));

jest.mock('../identityHelpers', () => ({
  extractECID: jest.fn(() => 'mock-ecid-12345'),
  buildTenantIdentities: jest.fn(() =>
    Promise.resolve({
      ecid: 'mock-ecid-12345',
    })
  ),
}));

jest.mock('react-native', () => ({
  Dimensions: { get: () => ({ window: { width: 400, height: 800 } }) },
  Platform: { OS: 'android' as const },
}));

jest.mock('expo-device', () => ({
  osVersion: '14',
}));

const baseIdentityMap = {
  ECID: [{ id: 'mock-ecid-12345' }],
};

describe('xdmEventBuilders – QA use case automation', () => {
  describe('Use case 3: Cart Views in CJA', () => {
    it('buildPageViewEvent emits mobileApp.navigation.pageViews with cart context', async () => {
      const event = await buildPageViewEvent({
        identityMap: baseIdentityMap,
        profile: { firstName: 'Test', email: 'test@example.com' },
        pageTitle: 'Shopping Cart',
        pagePath: '/cart',
        pageType: 'cart',
        cartSessionId: 'cart-session-abc',
        productListItems: [],
      });

      const xdmData = event.xdmData;
      expect(xdmData.eventType).toBe('mobileApp.navigation.pageViews');
      expect(xdmData.web?.webPageDetails?._adobecmteas?.pageType).toBe('cart');
      expect(xdmData.web?.webPageDetails?._adobecmteas?.pagePath).toBe('/cart');
      expect(xdmData.web?.webPageDetails?._adobecmteas?.pageTitle).toBe('Shopping Cart');
      expect(xdmData.web?.webPageDetails?.pageViews?.value).toBe(1);
      expect(xdmData._adobecmteas).toBeDefined();
      expect(xdmData.identityMap).toEqual(baseIdentityMap);
      expect(xdmData._id).toBeDefined();
      expect(xdmData.timestamp).toBeDefined();
      expect(xdmData.environment).toBeDefined();
      // Cart Views: CJA/reports that use commerce.productListViews.value will populate
      expect(xdmData.commerce?.productListViews?.value).toBe(1);
    });

    it('cart page view includes productListItems and cartSessionId when provided', async () => {
      const items = [
        { sku: 'SKU1', name: 'Product 1', price: 10, quantity: 2, category: 'cat', image: null },
      ];
      const event = await buildPageViewEvent({
        identityMap: baseIdentityMap,
        pageTitle: 'Shopping Cart',
        pagePath: '/cart',
        pageType: 'cart',
        cartSessionId: 'cart-xyz',
        productListItems: items,
      });

      const xdmData = event.xdmData;
      expect(xdmData.productListItems).toBeDefined();
      expect(xdmData.productListItems).toHaveLength(1);
      expect(xdmData.productListItems[0]._adobecmteas?.lowerFunnel?.cartID).toBe('cart-xyz');
      expect(xdmData.productListItems[0].SKU).toBe('SKU1');
    });
  });

  describe('Use case 2: Purchase In-App Journey', () => {
    it('buildPurchaseEvent emits commerce.purchases with _adobecmteas and order details', async () => {
      const productListItems = [
        { sku: 'SKU-A', name: 'Item A', price: 25.5, quantity: 1, category: 'cat', image: null },
      ];
      const event = await buildPurchaseEvent({
        identityMap: baseIdentityMap,
        profile: { firstName: 'Buyer', email: 'buyer@example.com' },
        purchaseID: 'order-123-abc',
        cartSessionId: 'cart-session-123',
        productListItems,
        priceTotal: 32.58,
        currencyCode: 'USD',
        shippingAmount: 5.99,
        taxAmount: 1.09,
      });

      const xdmData = event.xdmData;
      expect(xdmData.eventType).toBe('commerce.purchases');
      expect(xdmData.commerce?.purchases?.value).toBe(1);
      expect(xdmData.commerce?.order?.purchaseID).toBe('order-123-abc');
      expect(xdmData.commerce?.order?.priceTotal).toBe(32.58);
      expect(xdmData.commerce?.order?.currencyCode).toBe('USD');
      expect(xdmData.commerce?.order?.taxAmount).toBe(1.09);
      expect(xdmData.commerce?.shipping?.shippingAmount).toBe(5.99);
      expect(xdmData._adobecmteas).toBeDefined();
      expect(xdmData._adobecmteas.authentication?.loginStatus).toBe('logged-in');
      expect(xdmData._adobecmteas.visitorDetails?.visitorType).toBe('Customer');
      expect(xdmData._adobecmteas.channelInfo?.channel).toBe('Mobile App');
      expect(xdmData.productListItems).toBeDefined();
      expect(xdmData.productListItems).toHaveLength(1);
      expect(xdmData.productListItems[0]._adobecmteas?.lowerFunnel?.cartID).toBe('cart-session-123');
      expect(xdmData.identityMap).toEqual(baseIdentityMap);
      expect(xdmData._id).toBeDefined();
      expect(xdmData.timestamp).toBeDefined();
      expect(xdmData.environment).toBeDefined();
    });

    it('buildPurchaseEvent includes web.webInteraction transactionType for engagement', async () => {
      const event = await buildPurchaseEvent({
        identityMap: baseIdentityMap,
        purchaseID: 'order-456',
        cartSessionId: 'cart-456',
        productListItems: [],
        priceTotal: 0,
        currencyCode: 'USD',
      });

      const xdmData = event.xdmData;
      expect(xdmData.web?.webInteraction?._adobecmteas?.engagement?.transactionType).toBe('purchase');
    });
  });
});
