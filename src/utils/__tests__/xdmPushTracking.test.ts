import { buildPushTrackingEvent } from '../xdmEventBuilders';

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

describe('buildPushTrackingEvent', () => {
  it('includes _adobecmteas tenant block and full XDM envelope', async () => {
    const { xdmData } = await buildPushTrackingEvent({
      identityMap,
      profile,
      pushProvider: 'fcm',
      pushProviderMessageID: 'msg-123',
      interaction: 'opened',
    });
    expect(xdmData._adobecmteas).toBeDefined();
    expect(xdmData._adobecmteas.visitorDetails?.visitorType).toBe('Customer');
    expect(xdmData._adobecmteas.authentication?.loginStatus).toBe('logged-in');
    expect(xdmData._adobecmteas.channelInfo?.channel).toBe('Mobile App');
    expect(xdmData._id).toEqual(expect.any(String));
    expect(xdmData.timestamp).toEqual(expect.any(String));
    expect(xdmData.identityMap).toBeDefined();
    expect(xdmData.eventType).toBe('pushTracking.applicationOpened');
  });

  it('does NOT emit synthetic application.launches', async () => {
    const { xdmData } = await buildPushTrackingEvent({
      identityMap,
      profile,
      pushProvider: 'fcm',
      pushProviderMessageID: 'msg-123',
      interaction: 'opened',
    });
    expect(xdmData.application?.launches).toBeUndefined();
  });

  it('emits customAction.actionID when interaction is customAction', async () => {
    const { xdmData } = await buildPushTrackingEvent({
      identityMap,
      profile,
      pushProvider: 'fcm',
      pushProviderMessageID: 'msg-456',
      interaction: 'customAction',
      actionID: 'reply',
    });
    expect(xdmData.eventType).toBe('pushTracking.customAction');
    expect(xdmData.pushNotificationTracking.customAction.actionID).toBe('reply');
  });

  it('emits Prospect/not-logged-in when unauthenticated', async () => {
    const { xdmData } = await buildPushTrackingEvent({
      identityMap,
      pushProvider: 'apns',
      pushProviderMessageID: 'msg-789',
      interaction: 'opened',
    });
    expect(xdmData._adobecmteas.visitorDetails?.visitorType).toBe('Prospect');
    expect(xdmData._adobecmteas.authentication?.loginStatus).toBe('not-logged-in');
  });
});
