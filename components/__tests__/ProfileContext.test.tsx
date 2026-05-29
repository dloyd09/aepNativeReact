import React from 'react';
import { Text, Button } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { ProfileProvider, useProfile } from '../ProfileContext';

// Module-level storage shared by the AsyncStorage mock — tests can pre-seed or inspect.
let mockStore: Record<string, string | null> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStore[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStore[key] = value;
  }),
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

function ConsumerA() {
  const { profile, saveProfile } = useProfile();
  return (
    <>
      <Text testID="a-name">A:{profile.firstName}</Text>
      <Button
        testID="a-save"
        title="set-bob"
        onPress={() => {
          void saveProfile({ firstName: 'Bob', email: 'bob@example.com' });
        }}
      />
    </>
  );
}

function ConsumerB() {
  const { profile } = useProfile();
  return <Text testID="b-name">B:{profile.firstName}</Text>;
}

const getText = (tree: renderer.ReactTestRenderer, testID: string) => {
  const node = tree.root.findByProps({ testID });
  const children = node.props.children;
  return Array.isArray(children) ? children.join('') : String(children);
};

describe('ProfileContext — shared state propagation', () => {
  beforeEach(() => {
    mockStore = {};
    jest.clearAllMocks();
  });

  it('saveProfile from one consumer propagates to a sibling consumer without remount', async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <ProfileProvider>
          <ConsumerA />
          <ConsumerB />
        </ProfileProvider>
      );
      await flushPromises();
    });

    // Both consumers start with the same (empty) profile from a clean store.
    expect(getText(tree, 'a-name')).toBe('A:');
    expect(getText(tree, 'b-name')).toBe('B:');

    // Save from ConsumerA.
    await act(async () => {
      tree.root.findByProps({ testID: 'a-save' }).props.onPress();
      await flushPromises();
    });

    // Sibling ConsumerB sees the new value — this is the structural guarantee
    // that the old per-instance useProfileStorage hook could not provide.
    expect(getText(tree, 'a-name')).toBe('A:Bob');
    expect(getText(tree, 'b-name')).toBe('B:Bob');
  });

  it('hydrates initial profile from AsyncStorage at provider mount', async () => {
    mockStore['userProfile'] = JSON.stringify({ firstName: 'Casey', email: 'casey@example.com' });

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <ProfileProvider>
          <ConsumerA />
          <ConsumerB />
        </ProfileProvider>
      );
      await flushPromises();
    });

    expect(getText(tree, 'a-name')).toBe('A:Casey');
    expect(getText(tree, 'b-name')).toBe('B:Casey');
  });

});
