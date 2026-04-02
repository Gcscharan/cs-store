import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

interface EmergencyContact {
  icon: string;
  label: string;
  number: string;
  color: string;
  bgColor: string;
}

const EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    icon: 'call',
    label: 'Helpline',
    number: '9391795162',
    color: Colors.warning,
    bgColor: '#fef3c7',
  },
  {
    icon: 'shield-checkmark',
    label: 'Police',
    number: '100',
    color: Colors.error,
    bgColor: '#fee2e2',
  },
  {
    icon: 'medkit',
    label: 'Ambulance',
    number: '108',
    color: Colors.error,
    bgColor: '#fee2e2',
  },
];

const DeliveryEmergencyScreen: React.FC = () => {
  const handleCall = (contact: EmergencyContact) => {
    const url = `tel:${contact.number}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Error', 'Phone calls are not supported on this device');
        }
      })
      .catch(() => {
        Alert.alert('Error', 'Failed to make call');
      });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="alert-circle" size={48} color={Colors.error} />
        <Text style={styles.title}>Emergency Contacts</Text>
        <Text style={styles.subtitle}>
          Tap to call emergency services
        </Text>
      </View>

      {/* Emergency Buttons */}
      <View style={styles.contactsContainer}>
        {EMERGENCY_CONTACTS.map((contact, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.contactButton, { backgroundColor: contact.bgColor, marginBottom: 16 }]}
            onPress={() => handleCall(contact)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: contact.color, marginRight: 16 }]}>
              <Ionicons name={contact.icon as any} size={32} color={Colors.white} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={[styles.contactLabel, { color: contact.color }]}>
                {contact.label}
              </Text>
              <Text style={styles.contactNumber}>{contact.number}</Text>
            </View>
            <Ionicons name="call" size={24} color={contact.color} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Warning Note */}
      <View style={styles.warningCard}>
        <Ionicons name="information-circle" size={20} color={Colors.warning} style={{ marginRight: 12 }} />
        <Text style={styles.warningText}>
          Use these contacts only in case of emergencies. False calls to emergency services may result in legal action.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  contactsContainer: {
    padding: 16,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  contactNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
  },
});

export default DeliveryEmergencyScreen;
