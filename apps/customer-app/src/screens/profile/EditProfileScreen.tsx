import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useGetProfileQuery, useUpdateProfileMutation } from '../../store/api';

export default function EditProfileScreen({ navigation }: any) {
  const { data: profile, isLoading } = useGetProfileQuery();
  const [updateProfile, { isLoading: updating }] = useUpdateProfileMutation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setEmail(profile.email || '');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    try {
      await updateProfile({ name, email }).unwrap();
      Alert.alert('Success', 'Profile updated successfully');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.data?.message || 'Failed to update profile');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator style={{ margin: 40 }} size="large" color="#E95C1E" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={updating}>
          {updating ? (
            <ActivityIndicator size="small" color="#E95C1E" />
          ) : (
            <Text style={s.saveBtn}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Avatar */}
        <View style={s.avatarSection}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>
              {(name || profile?.name || 'U')[0].toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity style={s.changeAvatarBtn}>
            <Text style={s.changeAvatarTxt}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={s.field}>
          <Text style={s.label}>Full Name</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor="#aaa"
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Email</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            placeholderTextColor="#aaa"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Phone Number</Text>
          <TextInput
            style={[s.input, s.inputDisabled]}
            value={profile?.phone || ''}
            editable={false}
          />
          <Text style={s.hint}>Phone number cannot be changed</Text>
        </View>

        {/* Info Cards */}
        <View style={s.infoCard}>
          <Text style={s.infoTitle}>📱 Account Info</Text>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Member since</Text>
            <Text style={s.infoValue}>
              {profile?.createdAt
                ? new Date(profile.createdAt).toLocaleDateString()
                : 'N/A'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center',
    padding: 16, backgroundColor: '#fff', gap: 12 },
  back: { fontSize: 24, color: '#333' },
  title: { flex: 1, fontSize: 18, fontWeight: '700' },
  saveBtn: { color: '#E95C1E', fontWeight: '700', fontSize: 16 },
  avatarSection: { alignItems: 'center', marginVertical: 24 },
  avatar: { width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#E95C1E', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 40, color: '#fff', fontWeight: '700' },
  changeAvatarBtn: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 16,
    backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  changeAvatarTxt: { color: '#E95C1E', fontWeight: '600' },
  field: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0',
    borderRadius: 10, padding: 14, fontSize: 15 },
  inputDisabled: { backgroundColor: '#f5f5f5', color: '#888' },
  hint: { fontSize: 12, color: '#888', marginTop: 4 },
  infoCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 16 },
  infoTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  infoLabel: { fontSize: 14, color: '#666' },
  infoValue: { fontSize: 14, color: '#333', fontWeight: '600' },
});
