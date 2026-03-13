import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

export default function CategoriesScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Categories</Text>
      <Text style={styles.placeholder}>Coming soon...</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  placeholder: { color: '#888', textAlign: 'center', marginTop: 40 },
});
