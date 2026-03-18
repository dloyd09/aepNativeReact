/**
 * Ensures CJA SDR commerce-related XDM paths are populated (not null/undefined/NaN/empty string).
 * Aligns with AEP Bootcamp CJA metrics (commerce + page views); skips web-only paths we don't send.
 */

import {
  buildPageViewEvent,
  buildCheckoutEvent,
  buildProductListOpenEvent,
  buildProductRemovalEvent,
  buildPurchaseEvent,
  buildProductInteractionEvent,
  buildProductViewEvent,
  buildProductListAddEvent,
} from '../xdmEventBuilders';

jest.mock('@adobe/react-native-aepedge', () => ({
  ExperienceEvent: function (opts: { xdmData?: any }) {
    return { xdmData: opts?.xdmData ?? {} };
  },
}));

jest.mock('../identityHelpers', () => ({
  extractECID: jest.fn(() => 'mock-ecid-12345'),
  buildTenantIdentities: jest.fn(() =>
    Promise.resolve({ ecid: 'mock-ecid-12345' })
  ),
}));

jest.mock('react-native', () => ({
  Dimensions: { get: () => ({ window: { width: 400, height: 800 } }) },
  Platform: { OS: 'android' as const },
}));

jest.mock('expo-device', () => ({ osVersion: '14' }));

const identityMap = { ECID: [{ id: 'mock-ecid-12345' }] };
const profile = { firstName: 'Test', email: 'test@example.com' };

function getByPath(obj: any, path: string): unknown {
  return path.split('.').reduce((o: any, k) => {
    if (o == null) return undefined;
    return /^\d+$/.test(k) ? o[Number(k)] : o[k];
  }, obj);
}

/** Value must exist and not be "blank" for reporting. */
function expectPathNonBlank(xdm: any, path: string): void {
  const v = getByPath(xdm, path);
  expect({ path, value: v }).not.toEqual({ path, value: undefined });
  expect({ path, value: v }).not.toEqual({ path, value: null });
  if (typeof v === 'number') {
    expect(Number.isNaN(v)).toBe(false);
  }
  if (typeof v === 'string') {
    expect(v.length).toBeGreaterThan(0);
  }
}

function expectCoreEventFields(xdm: any): void {
  expectPathNonBlank(xdm, '_id');
  expectPathNonBlank(xdm, 'eventType');
  expectPathNonBlank(xdm, 'timestamp');
  expect(xdm.identityMap).toBeDefined();
  expect(Object.keys(xdm.identityMap).length).toBeGreaterThan(0);
  expectPathNonBlank(xdm, 'environment.type');
}

describe('XDM paths non-blank (CJA commerce SDR)', () => {
  it('buildPageViewEvent (cart): pageViews + productListViews', async () => {
    const { xdmData } = await buildPageViewEvent({
      identityMap,
      profile,
      pageTitle: 'Shopping Cart',
      pagePath: '/cart',
      pageType: 'cart',
      cartSessionId: 'cart-1',
      productListItems: [
        { sku: 'S1', name: 'P1', price: 10, quantity: 1, category: 'c', image: null },
      ],
    });
    expectCoreEventFields(xdmData);
    expectPathNonBlank(xdmData, 'web.webPageDetails.pageViews.value');
    expectPathNonBlank(xdmData, 'commerce.productListViews.value');
    expectPathNonBlank(xdmData, 'productListItems.0.priceTotal');
    expectPathNonBlank(xdmData, 'productListItems.0.SKU');
  });

  it('buildCheckoutEvent: checkouts + line priceTotal', async () => {
    const { xdmData } = await buildCheckoutEvent({
      identityMap,
      profile,
      cartSessionId: 'cart-1',
      productListItems: [
        { sku: 'S1', name: 'P1', price: 20, quantity: 2, category: 'c', image: null },
      ],
    });
    expectCoreEventFields(xdmData);
    expectPathNonBlank(xdmData, 'commerce.checkouts.value');
    expectPathNonBlank(xdmData, 'web.webPageDetails.pageViews.value');
    expectPathNonBlank(xdmData, 'productListItems.0.priceTotal');
  });

  it('buildProductRemovalEvent: productListRemovals', async () => {
    const { xdmData } = await buildProductRemovalEvent({
      identityMap,
      profile,
      cartSessionId: 'cart-1',
      productListItems: [
        { sku: 'S1', name: 'P1', price: 15, quantity: 1, category: 'c', image: null },
      ],
    });
    expectCoreEventFields(xdmData);
    expectPathNonBlank(xdmData, 'commerce.productListRemovals.value');
    expectPathNonBlank(xdmData, 'productListItems.0.priceTotal');
  });

  it('buildPurchaseEvent: purchases, order, shipping, tax, line items', async () => {
    const { xdmData } = await buildPurchaseEvent({
      identityMap,
      profile,
      purchaseID: 'order-abc-1',
      cartSessionId: 'cart-1',
      productListItems: [
        { sku: 'S1', name: 'P1', price: 10, quantity: 1, category: 'c', image: null },
      ],
      priceTotal: 16.81,
      currencyCode: 'USD',
      shippingAmount: 5.99,
      taxAmount: 0.82,
    });
    expectCoreEventFields(xdmData);
    expectPathNonBlank(xdmData, 'commerce.purchases.value');
    expectPathNonBlank(xdmData, 'commerce.order.purchaseID');
    expectPathNonBlank(xdmData, 'commerce.order.priceTotal');
    expectPathNonBlank(xdmData, 'commerce.order.currencyCode');
    expectPathNonBlank(xdmData, 'commerce.order.taxAmount');
    expectPathNonBlank(xdmData, 'commerce.shipping.shippingAmount');
    expectPathNonBlank(xdmData, 'productListItems.0.priceTotal');
    expectPathNonBlank(xdmData, 'web.webInteraction._adobecmteas.engagement.transactionType');
  });

  it('buildProductListAddEvent: productListAdds + line priceTotal', async () => {
    const { xdmData } = await buildProductListAddEvent({
      identityMap,
      profile,
      cartSessionId: 'cart-1',
      product: { sku: 'S1', name: 'P1', price: 12.5, category: 'c', quantity: 2 },
    });
    expectCoreEventFields(xdmData);
    expectPathNonBlank(xdmData, 'commerce.productListAdds.value');
    expectPathNonBlank(xdmData, 'productListItems.0.priceTotal');
    expectPathNonBlank(xdmData, 'productListItems.0.SKU');
  });

  it('buildProductViewEvent: productViews + line priceTotal', async () => {
    const { xdmData } = await buildProductViewEvent({
      identityMap,
      profile,
      product: { sku: 'S1', name: 'P1', price: 99, category: 'c' },
    });
    expectCoreEventFields(xdmData);
    expectPathNonBlank(xdmData, 'commerce.productViews.value');
    expectPathNonBlank(xdmData, 'productListItems.0.priceTotal');
  });

  it('buildProductListOpenEvent: productListOpens', async () => {
    const { xdmData } = await buildProductListOpenEvent({
      identityMap,
      profile,
      cartSessionId: 'cart-new',
    });
    expectCoreEventFields(xdmData);
    expectPathNonBlank(xdmData, 'commerce.productListOpens.value');
  });

  it('buildProductInteractionEvent (quantity update): productListUpdates', async () => {
    const { xdmData } = await buildProductInteractionEvent({
      identityMap,
      profile,
      transactionType: 'update_cart_quantity_increase',
      cartSessionId: 'cart-1',
      productListItems: [
        { sku: 'S1', name: 'P1', price: 10, quantity: 2, category: 'c', image: null },
      ],
    });
    expectCoreEventFields(xdmData);
    expectPathNonBlank(xdmData, 'commerce.productListUpdates.value');
    expectPathNonBlank(xdmData, 'web.webInteraction._adobecmteas.engagement.transactionType');
  });

  it('buildProductInteractionEvent (remove): productListRemovals', async () => {
    const { xdmData } = await buildProductInteractionEvent({
      identityMap,
      profile,
      transactionType: 'remove_from_cart',
      cartSessionId: 'cart-1',
      productListItems: [
        { sku: 'S1', name: 'P1', price: 10, quantity: 1, category: 'c', image: null },
      ],
    });
    expectCoreEventFields(xdmData);
    expectPathNonBlank(xdmData, 'commerce.productListRemovals.value');
  });
});
