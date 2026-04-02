import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import {
  useGetDeliveryProfileQuery,
  useUpdateDeliveryProfileMutation,
  useGetSelfieUrlQuery,
  useUpdateSelfieMutation,
} from '../../api/deliveryApi';

const PHONE_REGEX = /^[6-9]\d{9}$/;

const DeliveryProfileScreen: React.FC = () => {
  const { data: profile, isLoading: isLoadingProfile, refetch } = useGetDeliveryProfileQuery();
  const { data: selfieData } = useGetSelfieUrlQuery();
  const [updateProfile, { isLoading: isUpdating }] = useUpdateDeliveryProfileMutation();
  const [updateSelfie, { isLoading: isUpdatingSelfie }] = useUpdateSelfieMutation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setEmail(profile.email || '');
      setPhone(profile.phone || '');
      setVehicleType(profile.vehicleType || '');
    }
  }, [profile]);

  const validateForm = (): boolean => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return false;
    }
    if (!email.trim()) {
      Alert.alert('Error', 'Email cannot be empty');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Invalid email format');
      return false;
    }
    if (!phone.trim()) {
      Alert.alert('Error', 'Phone cannot be empty');
      return false;
    }
    if (!PHONE_REGEX.test(phone)) {
      Alert.alert('Error', 'Invalid phone number (must start with 6-9 and be 10 digits)');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      await updateProfile({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        vehicleType: vehicleType.trim() || undefined,
      }).unwrap();
      Alert.alert('Success', 'Profile updated successfully');
      setHasChanges(false);
      refetch();
    } catch (error: any) {
      Alert.alert('Error', error?.data?.error || 'Failed to update profile');
    }
  };

  const handleMarkChange = () => {
    setHasChanges(true);
  };

  if (isLoadingProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const selfieUrl = selfieData?.selfieUrl;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Selfie Section */}
      <View style={styles.selfieSection}>
        <View style={styles.selfieContainer}>
          {selfieUrl ? (
            <Image source={{ uri: selfieUrl }} style={styles.selfieImage} />
          ) : (
            <View style={styles.selfiePlaceholder}>
              <Ionicons name="person" size={48} color={Colors.textMuted} />
            </View>
          )}
        </View>
        <Text style={styles.selfieLabel}>Profile Photo</Text>
      </View>

      {/* Display Only Fields */}
      <View style={styles.displaySection}>
        <View style={styles.displayRow}>
          <Text style={styles.displayLabel}>DE ID</Text>
          <Text style={styles.displayValue}>{profile?.deId || profile?._id || '-'}</Text>
        </View>
        <View style={styles.displayRow}>
          <Text style={styles.displayLabel}>Rating</Text>
          <Text style={styles.displayValue}>⭐ {profile?.rating || '4.8'}</Text>
        </View>
        <View style={styles.displayRow}>
          <Text style={styles.displayLabel}>Status</Text>
          <View style={[
            styles.statusBadge,
            profile?.isActive ? styles.statusActive : styles.statusInactive
          ]}>
            <Text style={[
              styles.statusText,
              profile?.isActive ? styles.statusTextActive : styles.statusTextInactive
            ]}>
              {profile?.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      </View>

      {/* Editable Fields */}
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Edit Profile</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(text) => { setName(text); handleMarkChange(); }}
            placeholder="Enter your name"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={(text) => { setEmail(text); handleMarkChange(); }}
            placeholder="Enter your email"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={(text) => { setPhone(text); handleMarkChange(); }}
            placeholder="Enter phone number"
            placeholderTextColor={Colors.textMuted}
            keyboardType="phone-pad"
            maxLength={10}
          />
          <Text style={styles.inputHint}>Must start with 6-9 and be 10 digits</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Vehicle Type</Text>
          <TextInput
            style={styles.input}
            value={vehicleType}
            onChangeText={(text) => { setVehicleType(text); handleMarkChange(); }}
            placeholder="e.g., Bike, Scooter"
            placeholderTextColor={Colors.textMuted}
          />
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={!hasChanges || isUpdating}
      >
        {isUpdating ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.saveButtonText}>Save Changes</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  selfieSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  selfieContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: Colors.background,
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  selfieImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  selfiePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  selfieLabel: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  displaySection: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  displayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  displayLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  displayValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#dcfce7',
  },
  statusInactive: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextActive: {
    color: Colors.success,
  },
  statusTextInactive: {
    color: Colors.error,
  },
  formSection: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputHint: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: Colors.border,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default DeliveryProfileScreen;
