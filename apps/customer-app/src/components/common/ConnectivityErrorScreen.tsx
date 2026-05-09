import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '../../constants/colors';
import { logEvent } from '../../utils/analytics';

interface ConnectivityErrorScreenProps {
  error: string;
  onRetry: () => void;
}

export const ConnectivityErrorScreen: React.FC<ConnectivityErrorScreenProps> = ({ 
  error, 
  onRetry 
}) => {
  const handleRetry = () => {
    logEvent('connectivity_retry_clicked');
    onRetry();
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📡</Text>
        </View>
        
        <Text style={styles.title}>Cannot Connect to Server</Text>
        <Text style={styles.message}>{error}</Text>

        <View style={styles.troubleshootingContainer}>
          <Text style={styles.troubleshootingTitle}>Troubleshooting Steps:</Text>
          
          <View style={styles.stepContainer}>
            <Text style={styles.stepNumber}>1.</Text>
            <Text style={styles.stepText}>
              Make sure your device is connected to WiFi
            </Text>
          </View>

          <View style={styles.stepContainer}>
            <Text style={styles.stepNumber}>2.</Text>
            <Text style={styles.stepText}>
              Verify you're on the same network as the server
            </Text>
          </View>

          <View style={styles.stepContainer}>
            <Text style={styles.stepNumber}>3.</Text>
            <Text style={styles.stepText}>
              Check if the backend server is running
            </Text>
          </View>

          <View style={styles.stepContainer}>
            <Text style={styles.stepNumber}>4.</Text>
            <Text style={styles.stepText}>
              Ensure router AP Isolation is disabled
            </Text>
          </View>

          <View style={styles.stepContainer}>
            <Text style={styles.stepNumber}>5.</Text>
            <Text style={styles.stepText}>
              Try restarting the Expo development server
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={handleRetry}
          activeOpacity={0.8}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>

        <Text style={styles.helpText}>
          If the problem persists, contact your system administrator
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.error,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  troubleshootingContainer: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  troubleshootingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  stepContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginRight: 12,
    width: 20,
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
