import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { useGetProductsQuery } from '../../store/api';

export default function HomeScreen({ navigation }: any) {
  const { data, isLoading } = useGetProductsQuery({ limit: 12 });

  return (
    <SafeAreaView style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <TextInput
          placeholder="Search for Products, Brands and More"
          placeholderTextColor="#888"
          style={styles.searchInput}
        />
      </View>

      <ScrollView>
        <Text style={styles.sectionTitle}>Top Selling</Text>

        {isLoading ? (
          <ActivityIndicator size="large" color="#E95C1E" style={{ margin: 24 }} />
        ) : (
          <View style={styles.productsGrid}>
            {data?.products?.map((product: any) => (
              <TouchableOpacity
                key={product._id}
                style={styles.productCard}
                onPress={() => navigation.navigate('ProductDetail', { id: product._id })}
              >
                <Image
                  source={{ uri: product.images?.[0] || 'https://via.placeholder.com/150' }}
                  style={styles.productImage}
                  resizeMode="cover"
                />
                <Text style={styles.productName} numberOfLines={2}>
                  {product.name}
                </Text>
                <Text style={styles.productPrice}>₹{product.price}</Text>
                {product.mrp > product.price && (
                  <Text style={styles.productMrp}>₹{product.mrp}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchBar: { padding: 12, backgroundColor: '#f5f5f5' },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', margin: 16 },
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
  productCard: {
    width: '48%',
    margin: '1%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  productImage: { width: '100%', height: 150, borderRadius: 6 },
  productName: { fontSize: 13, marginTop: 6, color: '#333' },
  productPrice: { fontSize: 15, fontWeight: '700', color: '#E95C1E', marginTop: 4 },
  productMrp: { fontSize: 12, color: '#999', textDecorationLine: 'line-through' },
});
