import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  if (!isOffline) return null;

  return (
    <View style={s.banner}>
      <Text style={s.txt}>📵 No internet connection</Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: { backgroundColor: '#c62828', padding: 10, alignItems: 'center' },
  txt: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
