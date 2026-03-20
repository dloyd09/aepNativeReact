import React from 'react';
import { StyleSheet } from 'react-native';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { persistRuntimeError } from '@/src/utils/runtimeDiagnostics';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export class StartupErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'Unknown startup error',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    persistRuntimeError({
      source: 'error-boundary',
      message: error.message || 'Unknown startup error',
      stack: `${error.stack || ''}\n${errorInfo.componentStack || ''}`.trim(),
      timestamp: new Date().toISOString(),
    }).catch(() => undefined);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ThemedView style={styles.container}>
          <ThemedText type="title" style={styles.title}>Startup Error</ThemedText>
          <ThemedText style={styles.body}>
            The app caught a runtime error during launch.
          </ThemedText>
          <ThemedText style={styles.body}>
            {this.state.message}
          </ThemedText>
        </ThemedView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    marginBottom: 8,
  },
});
