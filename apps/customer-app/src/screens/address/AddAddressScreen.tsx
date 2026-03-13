import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useAddAddressMutation, useUpdateAddressMutation, useCheckPincodeQuery } from '../../store/api';

const STATES = ['Andhra Pradesh','Telangana','Karnataka','Tamil Nadu','Maharashtra',
  'Gujarat','Rajasthan','Uttar Pradesh','West Bengal','Delhi'];

export default function AddAddressScreen({ navigation, route }: any) {
  const existing = route.params?.address;
  const isEdit = !!existing;

  const [form, setForm] = useState({
    name: '', phone: '', line1: '', line2: '', city: '',
    state: 'Andhra Pradesh', pincode: '', type: 'HOME',
    ...existing,
  });
  const [pincodeInput, setPincodeInput] = useState(existing?.pincode || '');
  const [addAddress, { isLoading: adding }] = useAddAddressMutation();
  const [updateAddress, { isLoading: updating }] = useUpdateAddressMutation();
  const { data: pincodeData } = useCheckPincodeQuery(pincodeInput, {
    skip: pincodeInput.length !== 6,
  });

  useEffect(() => {
    if (pincodeData?.serviceable && pincodeData?.info) {
      setForm(f => ({
        ...f,
        pincode: pincodeInput,
        city: pincodeData.info.district || f.city,
        state: pincodeData.info.state || f.state,
      }));
    }
  }, [pincodeData]);

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    if (!form.name.trim()) return 'Name is required';
    if (form.phone.length !== 10) return 'Enter valid 10-digit phone';
    if (!form.line1.trim()) return 'Address line 1 is required';
    if (!form.city.trim()) return 'City is required';
    if (form.pincode.length !== 6) return 'Enter valid 6-digit pincode';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { Alert.alert('Validation Error', err); return; }
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        line1: form.line1,
        line2: form.line2,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        type: form.type,
        label: form.type,
        addressLine: `${form.line1}${form.line2 ? ', ' + form.line2 : ''}`,
      };
      if (isEdit) {
        await updateAddress({ id: existing._id, data: payload }).unwrap();
      } else {
        await addAddress(payload).unwrap();
      }
      route.params?.onSave?.(form);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.data?.message || 'Failed to save address');
    }
  };

  const Field = ({ label, field, ...props }: any) => (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} value={form[field]} onChangeText={set(field)} {...props} />
    </View>
  );

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>{isEdit ? 'Edit Address' : 'Add New Address'}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Address type */}
        <View style={s.typeRow}>
          {['HOME', 'WORK', 'OTHER'].map(t => (
            <TouchableOpacity
              key={t}
              style={[s.typeBtn, form.type === t && s.typeBtnActive]}
              onPress={() => setForm(f => ({ ...f, type: t }))}
            >
              <Text style={[s.typeTxt, form.type === t && s.typeTxtActive]}>
                {t === 'HOME' ? '🏠' : t === 'WORK' ? '🏢' : '📍'} {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Field label="Full Name *" field="name" placeholder="Enter full name" />
        <Field label="Phone Number *" field="phone" placeholder="10-digit mobile"
          keyboardType="phone-pad" maxLength={10} />

        {/* Pincode with auto-fill */}
        <View style={s.field}>
          <Text style={s.label}>Pincode *</Text>
          <View style={s.pincodeRow}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={pincodeInput}
              onChangeText={(v) => { setPincodeInput(v); set('pincode')(v); }}
              placeholder="6-digit pincode"
              keyboardType="numeric"
              maxLength={6}
            />
            {pincodeData?.serviceable && (
              <Text style={s.serviceableTxt}>✓ Serviceable</Text>
            )}
            {pincodeData?.serviceable === false && (
              <Text style={s.notServiceableTxt}>✗ Not serviceable</Text>
            )}
          </View>
        </View>

        <Field label="Address Line 1 *" field="line1"
          placeholder="House/Flat no., Building name" />
        <Field label="Address Line 2" field="line2"
          placeholder="Area, Colony, Street (optional)" />
        <Field label="City *" field="city" placeholder="City" />

        {/* State dropdown - simplified */}
        <View style={s.field}>
          <Text style={s.label}>State *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {STATES.map(st => (
              <TouchableOpacity
                key={st}
                style={[s.pill, form.state === st && s.pillActive]}
                onPress={() => setForm(f => ({ ...f, state: st }))}
              >
                <Text style={[s.pillTxt, form.state === st && s.pillTxtActive]}>{st}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity
          style={[s.saveBtn, (adding || updating) && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={adding || updating}
        >
          {adding || updating
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.saveBtnTxt}>
                {isEdit ? 'Update Address' : 'Save Address'}
              </Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: '#fff', gap: 12 },
  back: { fontSize: 24, color: '#333' },
  title: { fontSize: 18, fontWeight: '700' },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1,
    borderColor: '#ddd', alignItems: 'center', backgroundColor: '#fff' },
  typeBtnActive: { borderColor: '#E95C1E', backgroundColor: '#fff8f5' },
  typeTxt: { color: '#666', fontWeight: '600' },
  typeTxtActive: { color: '#E95C1E' },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0',
    borderRadius: 10, padding: 13, fontSize: 15 },
  pincodeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  serviceableTxt: { color: '#2e7d32', fontWeight: '600', fontSize: 13 },
  notServiceableTxt: { color: '#c62828', fontWeight: '600', fontSize: 13 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#f0f0f0', marginRight: 8 },
  pillActive: { backgroundColor: '#E95C1E' },
  pillTxt: { fontSize: 13, color: '#555' },
  pillTxtActive: { color: '#fff', fontWeight: '600' },
  saveBtn: { backgroundColor: '#E95C1E', padding: 17,
    borderRadius: 14, alignItems: 'center', marginTop: 12, marginBottom: 32 },
  saveBtnDisabled: { backgroundColor: '#ccc' },
  saveBtnTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
