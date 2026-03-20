import React from 'react';
import { Button, ScrollView, ScrollViewProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
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
  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        {...scrollViewProps}
      >
        {showBackButton ? <Button onPress={onBack} title="Go to main page" /> : null}
        {children}
      </ScrollView>
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
    marginTop: 75,
    paddingBottom: 100,
    paddingHorizontal: 20,
  },
});
