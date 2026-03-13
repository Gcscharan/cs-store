import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity } from 'react-native';

const CATEGORIES = [
  { id: '1', name: 'Fruits & Vegetables', emoji: '🥦' },
  { id: '2', name: 'Dairy & Eggs', emoji: '🥛' },
  { id: '3', name: 'Snacks', emoji: '🍿' },
  { id: '4', name: 'Beverages', emoji: '🥤' },
  { id: '5', name: 'Personal Care', emoji: '🧴' },
  { id: '6', name: 'Household', emoji: '🧹' },
  { id: '7', name: 'Bakery', emoji: '🍞' },
  { id: '8', name: 'Meat & Fish', emoji: '🐟' },
];

export default function CategoriesScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Categories</Text>
      <FlatList
        data={CATEGORIES}
        numColumns={2}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.name}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', margin: 16 },
  card: {
    flex: 1,
    margin: 8,
    padding: 20,
    backgroundColor: '#fff8f5',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffe0d0',
  },
  emoji: { fontSize: 32, marginBottom: 8 },
  name: { fontSize: 13, textAlign: 'center', color: '#333', fontWeight: '500' },
});
