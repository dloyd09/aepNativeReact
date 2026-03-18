import React from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ProfileTab from '../profile';

const mockGetIdentities = jest.fn();
const mockGetExperienceCloudId = jest.fn();
const mockUpdateIdentities = jest.fn();
const mockRemoveIdentity = jest.fn();
const mockSendEvent = jest.fn();
const mockBuildPageViewEvent = jest.fn();
const mockBuildLogoutEvent = jest.fn();
const mockRemoveUserAttributes = jest.fn();
const mockSetProfile = jest.fn();
let mockStoredProfile = { firstName: 'Casey', email: 'casey@example.com' };

let focusEffectCallback: undefined | (() => void);

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@react-navigation/native', () => ({
  useTheme: () => ({
    colors: {
      primary: '#000',
      border: '#ccc',
      card: '#fff',
      text: '#111',
    },
  }),
  useFocusEffect: (callback: () => void) => {
    focusEffectCallback = callback;
  },
}));

jest.mock('@adobe/react-native-aepedge', () => ({
  Edge: {
    sendEvent: (...args: unknown[]) => mockSendEvent(...args),
  },
}));

jest.mock('@adobe/react-native-aepedgeidentity', () => ({
  Identity: {
    getIdentities: (...args: unknown[]) => mockGetIdentities(...args),
    getExperienceCloudId: (...args: unknown[]) => mockGetExperienceCloudId(...args),
    updateIdentities: (...args: unknown[]) => mockUpdateIdentities(...args),
    removeIdentity: (...args: unknown[]) => mockRemoveIdentity(...args),
  },
  AuthenticatedState: {
    AUTHENTICATED: 'authenticated',
  },
  IdentityMap: class IdentityMap {
    items: Array<{ item: unknown; namespace: string }> = [];

    addItem(item: unknown, namespace: string) {
      this.items.push({ item, namespace });
    }
  },
  IdentityItem: class IdentityItem {
    id: string;
    authenticatedState?: string;
    primary?: boolean;

    constructor(id: string, authenticatedState?: string, primary?: boolean) {
      this.id = id;
      this.authenticatedState = authenticatedState;
      this.primary = primary;
    }
  },
}));

jest.mock('@adobe/react-native-aepuserprofile', () => ({
  UserProfile: {
    updateUserAttributes: jest.fn(),
    removeUserAttributes: (...args: unknown[]) => mockRemoveUserAttributes(...args),
  },
}));

jest.mock('../../../hooks/useProfileStorage', () => ({
  useProfileStorage: () => ({
    profile: mockStoredProfile,
    setProfile: (nextProfile: { firstName: string; email: string }) => {
      mockStoredProfile = nextProfile;
      return mockSetProfile(nextProfile);
    },
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => JSON.stringify({ firstName: 'Casey', email: 'casey@example.com' })),
}));

jest.mock('../../../src/utils/xdmEventBuilders', () => ({
  buildPageViewEvent: (...args: unknown[]) => mockBuildPageViewEvent(...args),
  buildLoginEvent: jest.fn(),
  buildLogoutEvent: (...args: unknown[]) => mockBuildLogoutEvent(...args),
}));

jest.mock('../../../components/ThemedText', () => ({
  ThemedText: ({ children }: { children: React.ReactNode }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>{children}</Text>;
  },
}));

jest.mock('../../../components/ScrollableContainer', () => ({
  ScrollableContainer: ({ children }: { children: React.ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const getRenderedText = (tree: renderer.ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map(node => {
      const children = node.props.children;
      return Array.isArray(children) ? children.join('') : String(children);
    })
    .join('\n');

describe('ProfileTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    focusEffectCallback = undefined;
    mockStoredProfile = { firstName: 'Casey', email: 'casey@example.com' };

    mockGetIdentities
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        identityMap: {
          ECID: [{ id: 'ecid-123' }],
          Email: [{ id: 'casey@example.com' }],
        },
      });

    mockGetExperienceCloudId
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('ecid-123');

    mockBuildPageViewEvent.mockResolvedValue({ xdmData: { eventType: 'mobileApp.navigation.pageViews' } });
    mockBuildLogoutEvent.mockResolvedValue({ xdmData: { eventType: 'mobileApp.navigation.clicks' } });
    mockSendEvent.mockResolvedValue(undefined);
    mockRemoveIdentity.mockResolvedValue(undefined);
    mockRemoveUserAttributes.mockResolvedValue(undefined);
  });

  it('refreshes ECID and identityMap on focus after restoring a stored login session', async () => {
    let tree!: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(<ProfileTab />);
      await flushPromises();
    });

    expect(getRenderedText(tree)).toContain('Welcome, Casey!');
    expect(getRenderedText(tree)).toContain('ECID: ');
    expect(getRenderedText(tree)).toContain('Identity Map: {}');

    await act(async () => {
      focusEffectCallback?.();
      await flushPromises();
    });

    const renderedText = getRenderedText(tree);
    expect(renderedText).toContain('ECID: ecid-123');
    expect(renderedText).toContain('Identity Map: {"ECID":[{"id":"ecid-123"}],"Email":[{"id":"casey@example.com"}]}');
    expect(mockBuildPageViewEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        identityMap: {
          ECID: [{ id: 'ecid-123' }],
          Email: [{ id: 'casey@example.com' }],
        },
      })
    );
  });

  it('clears stored profile and Adobe email identity when the user logs out', async () => {
    mockGetIdentities.mockReset();
    mockGetExperienceCloudId.mockReset();

    mockGetIdentities.mockResolvedValue({
      identityMap: {
        ECID: [{ id: 'ecid-123' }],
        Email: [{ id: 'casey@example.com' }],
      },
    });
    mockGetExperienceCloudId.mockResolvedValue('ecid-123');

    let tree!: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(<ProfileTab />);
      await flushPromises();
    });

    const logoutButton = tree.root.findByProps({ title: 'Log Out' });

    await act(async () => {
      logoutButton.props.onPress();
      await flushPromises();
    });

    expect(mockBuildLogoutEvent).toHaveBeenCalledWith({
      identityMap: {
        ECID: [{ id: 'ecid-123' }],
        Email: [{ id: 'casey@example.com' }],
      },
      profile: { firstName: 'Casey', email: 'casey@example.com' },
    });
    expect(mockRemoveUserAttributes).toHaveBeenCalledWith(['firstName', 'email']);
    expect(mockRemoveIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'casey@example.com' }),
      'Email'
    );
    expect(mockSetProfile).toHaveBeenCalledWith({ firstName: '', email: '' });
    expect(() => tree.root.findByProps({ title: 'Log Out' })).toThrow();
    expect(getRenderedText(tree)).toContain('Profile');
  });
});
