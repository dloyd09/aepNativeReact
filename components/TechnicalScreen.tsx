import React from 'react';
import { Button, KeyboardAvoidingView, Platform, ScrollView, ScrollViewProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from './ThemedView';

type TechnicalScreenProps = {
  children: React.ReactNode;
  onBack?: () => void;
  showBackButton?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollViewProps?: Omit<ScrollViewProps, 'children' | 'contentContainerStyle'>;
};

export function TechnicalScreen({
  children,
  onBack,
  showBackButton = true,
  contentContainerStyle,
  scrollViewProps,
}: TechnicalScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { marginTop: insets.top + 12 }, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          {...scrollViewProps}
        >
          {showBackButton ? <Button onPress={onBack} title="Go to main page" /> : null}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 100,
    paddingHorizontal: 20,
  },
});
