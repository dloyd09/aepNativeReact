import React from 'react';
import { ScrollView, StyleSheet, KeyboardAvoidingView, Platform, ViewStyle } from 'react-native';
import { ThemedView } from './ThemedView';

interface ScrollableContainerProps {
  children: React.ReactNode;
  contentContainerStyle?: ViewStyle;
}

/**
 * ScrollableContainer - A reusable scrollable container component
 * 
 * Features:
 * - Handles keyboard avoidance automatically (iOS and Android)
 * - Prevents content from being cut off on small screens
 * - Consistent padding and behavior across all screens
 * - Works with forms, static content, and any content that may exceed screen height
 */
export function ScrollableContainer({ children, contentContainerStyle }: ScrollableContainerProps) {
  return (
    <ThemedView style={{ flex: 1 }}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.content, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24,
    paddingBottom: 40, // Extra padding at bottom for buttons and content clearance
  },
});

