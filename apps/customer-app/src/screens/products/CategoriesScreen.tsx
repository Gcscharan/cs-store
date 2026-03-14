import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useGetProductsQuery } from '../../store/api';

const FALLBACK_CATEGORIES = [
  { name: 'Fruits & Vegetables', emoji: '🥦' },
  { name: 'Dairy & Eggs', emoji: '🥛' },
  { name: 'Snacks', emoji: '🍿' },
  { name: 'Beverages', emoji: '🥤' },
  { name: 'Personal Care', emoji: '🧴' },
  { name: 'Household', emoji: '🧹' },
  { name: 'Bakery', emoji: '🍞' },
  { name: 'Meat & Fish', emoji: '🐟' },
];

const CATEGORY_EMOJIS: Record<string, string> = {
  'fruits': '🥦', 'vegetables': '🥕', 'dairy': '🥛', 'eggs': '🥚',
  'snacks': '🍿', 'beverages': '🥤', 'personal': '🧴', 'care': '🧴',
  'household': '🧹', 'bakery': '🍞', 'meat': '🐟', 'fish': '🐠',
};

export default function CategoriesScreen({ navigation }: any) {
  // Fetch products to extract unique categories
  const { data: productsData, isLoading } = useGetProductsQuery({ limit: 100 });

  // Extract unique categories from products
  const categories = React.useMemo(() => {
    if (!productsData?.products) return FALLBACK_CATEGORIES;
    const cats = new Set<string>();
    productsData.products.forEach((p: any) => {
      if (p.category) cats.add(p.category);
    });
    if (cats.size === 0) return FALLBACK_CATEGORIES;
    return Array.from(cats).map(name => ({
      name,
      emoji: CATEGORY_EMOJIS[name.toLowerCase().split(' ')[0]] || '🛒',
    }));
  }, [productsData]);

  if (isLoading) {
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator size="large" color="#E95C1E" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <Text style={s.title}>Categories</Text>
      <FlatList
        data={categories}
        numColumns={2}
        keyExtractor={i => i.name}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => navigation.navigate('Search', { category: item.name })}
          >
            <Text style={s.emoji}>{item.emoji}</Text>
            <Text style={s.name}>{item.name}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={s.empty}>No categories found</Text>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '800', margin: 16 },
  card: {
    flex: 1,
    margin: 8,
    padding: 20,
    backgroundColor: '#fff8f5',
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffe0d0',
  },
  emoji: { fontSize: 36, marginBottom: 10 },
  name: { fontSize: 13, textAlign: 'center', color: '#333', fontWeight: '600', lineHeight: 18 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 16 },
});
