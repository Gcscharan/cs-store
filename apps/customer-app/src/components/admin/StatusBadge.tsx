import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

type Props = {
  status: string;
};

const StatusBadge: React.FC<Props> = ({ status }) => {
  const normalized = String(status || '').toUpperCase();

  const { bg, text } = useMemo(() => {
    switch (normalized) {
      case 'CREATED':
        return { bg: '#ffedd5', text: Colors.primary };
      case 'CONFIRMED':
        return { bg: '#dbeafe', text: Colors.secondaryDark };
      case 'PACKED':
        return { bg: '#ede9fe', text: '#7c3aed' };
      case 'IN_TRANSIT':
        return { bg: '#fef9c3', text: '#ca8a04' };
      case 'DELIVERED':
        return { bg: '#dcfce7', text: '#16a34a' };
      case 'CANCELLED':
        return { bg: '#fee2e2', text: Colors.error };
      case 'PENDING':
        return { bg: '#ffedd5', text: Colors.primary };
      case 'ACTIVE':
        return { bg: '#dcfce7', text: '#16a34a' };
      case 'SUSPENDED':
        return { bg: '#fee2e2', text: Colors.error };
      default:
        return { bg: Colors.surfaceDark, text: Colors.textSecondary };
    }
  }, [normalized]);

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}> 
      <Text style={[styles.text, { color: text }]}>{normalized}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});

export default StatusBadge;
