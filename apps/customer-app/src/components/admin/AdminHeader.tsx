import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
};

const AdminHeader: React.FC<Props> = ({ title, subtitle, onBack, rightAction }) => {
  return (
    <LinearGradient
      colors={['#6366f1', '#4f46e5']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.topRow}>
          <View style={styles.leftSection}>
            {onBack && (
              <TouchableOpacity 
                onPress={onBack} 
                style={styles.backBtn} 
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-back" size={24} color={Colors.white} />
              </TouchableOpacity>
            )}
            <View>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
          </View>

          {rightAction && (
            <View style={styles.rightSection}>
              {rightAction}
            </View>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#4f46e5',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 9,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 22,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    height: 48,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 23,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.7,
    marginLeft: 4,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    marginLeft: 4,
    marginTop: -1,
    letterSpacing: 0.3,
  },
  backBtn: {
    height: 40,
    width: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
});

export default AdminHeader;
