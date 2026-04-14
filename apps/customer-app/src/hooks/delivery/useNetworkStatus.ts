import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState<string>('unknown');

  useEffect(() => {
    // Check initial state
    NetInfo.fetch().then((state) => {
      setIsOnline(!!state.isConnected);
      setConnectionType(state.type);
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected);
      setConnectionType(state.type);
    });

    return unsubscribe;
  }, []);

  return { isOnline, connectionType };
};
