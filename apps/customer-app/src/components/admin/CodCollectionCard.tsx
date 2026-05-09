import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

interface CodCollectionData {
  _id: string;
  orderId: string;
  mode: 'CASH' | 'UPI';
  amount: number;
  currency: string;
  collectedAt: string;
  collectedBy?: {
    _id: string;
    name: string;
    phone: string;
    email?: string | null;
  } | null;
}

interface CodCollectionCardProps {
  codCollection: CodCollectionData | null;
  isLoading?: boolean;
}

const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const CodCollectionCard: React.FC<CodCollectionCardProps> = ({
  codCollection,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>COD Collection</Text>
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!codCollection) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>COD Collection</Text>
        <View style={styles.notCollectedBox}>
          <Ionicons name="time-outline" size={20} color={Colors.textMuted} />
          <Text style={styles.notCollectedText}>Not collected yet</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>COD Collection</Text>
      <View style={styles.collectedBox}>
        {/* Collection Mode */}
        <View style={styles.row}>
          <View style={styles.iconWrapper}>
            <Ionicons
              name={codCollection.mode === 'UPI' ? 'card-outline' : 'cash-outline'}
              size={20}
              color={Colors.success}
            />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Collection Mode</Text>
            <Text style={styles.rowValue}>
              {codCollection.mode === 'UPI' ? 'UPI Payment' : 'Cash Payment'}
            </Text>
          </View>
        </View>

        {/* Amount */}
        <View style={styles.row}>
          <View style={styles.iconWrapper}>
            <Ionicons name="wallet-outline" size={20} color={Colors.success} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Amount Collected</Text>
            <Text style={styles.amountValue}>
              ₹{Number(codCollection.amount || 0).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {/* Collection Time */}
        <View style={styles.row}>
          <View style={styles.iconWrapper}>
            <Ionicons name="time-outline" size={20} color={Colors.success} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Collected At</Text>
            <Text style={styles.rowValue}>
              {formatDateTime(codCollection.collectedAt)}
            </Text>
          </View>
        </View>

        {/* Collected By */}
        {codCollection.collectedBy && (
          <View style={styles.row}>
            <View style={styles.iconWrapper}>
              <Ionicons name="person-outline" size={20} color={Colors.success} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Collected By</Text>
              <Text style={styles.rowValue}>
                {codCollection.collectedBy.name}
              </Text>
              <Text style={styles.rowSubvalue}>
                {codCollection.collectedBy.phone}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  loadingBox: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  notCollectedBox: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notCollectedText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
    marginLeft: 8,
  },
  collectedBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.success,
  },
  rowSubvalue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 2,
  },
});

export default CodCollectionCard;
