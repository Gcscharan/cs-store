import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Colors } from '../../constants/colors';

const OfflineBanner = () => {
  const { isConnected } = NetInfo.useNetInfo();

  if (isConnected) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>You are offline</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.error,
    padding: 12,
    alignItems: 'center',
  },
  text: {
    color: Colors.white,
    fontWeight: '600',
  },
});

export default OfflineBanner;
