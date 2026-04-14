import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/colors';

interface BackendStatusBannerProps {
  error: string | null;
  onRetry?: () => void;
}

/**
 * Non-blocking banner that displays backend connectivity issues
 * Shows when backend health check fails but allows app usage
 */
const BackendStatusBanner: React.FC<BackendStatusBannerProps> = ({ error, onRetry }) => {
  if (!error) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.text}>⚠️ {error}</Text>
        {onRetry && (
          <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.warning || '#FFA500',
    padding: 12,
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  text: {
    color: Colors.white,
    fontWeight: '600',
    marginRight: 8,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  retryText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
});

export default BackendStatusBanner;
