import React, { useState } from 'react'; 
import { 
  View, Text, StyleSheet, SafeAreaView, FlatList, 
  TouchableOpacity, ActivityIndicator, Image, 
  ScrollView, TextInput, 
} from 'react-native'; 
import { useGetCategoriesQuery, useGetProductsQuery } from '../../store/api'; 
import { useDispatch } from 'react-redux'; 
import { addItem } from '../../store/slices/cartSlice'; 
import { SmartImage } from '../../components/SmartImage'; 
 
// Match web app's CATEGORY_DISPLAY_MAP exactly 
const CATEGORY_DISPLAY_MAP: Record<string, { emoji: string; label: string; color: string }> = { 
  'Chocolates':        { emoji: '🍫', label: 'Chocolates',        color: '#7B3F00' }, 
  'Chips & Namkeen':   { emoji: '🍟', label: 'Chips & Namkeen',   color: '#E65100' }, 
  'Biscuits & Cookies':{ emoji: '🍪', label: 'Biscuits',          color: '#F57F17' }, 
  'Beverages':         { emoji: '🥤', label: 'Beverages',          color: '#1565C0' }, 
  'Dairy & Eggs':      { emoji: '🥛', label: 'Dairy & Eggs',       color: '#00838F' }, 
  'Fruits & Vegetables':{ emoji: '🥦', label: 'Fruits & Veg',      color: '#2E7D32' }, 
  'Snacks':            { emoji: '🍿', label: 'Snacks',             color: '#FF6F00' }, 
  'Personal Care':     { emoji: '🧴', label: 'Personal Care',      color: '#6A1B9A' }, 
  'Household':         { emoji: '🧹', label: 'Household',          color: '#4527A0' }, 
  'Bakery':            { emoji: '🍞', label: 'Bakery',             color: '#BF360C' }, 
  'Meat & Fish':       { emoji: '🐟', label: 'Meat & Fish',        color: '#1A237E' }, 
  'Staples':           { emoji: '🌾', label: 'Staples',            color: '#827717' }, 
  'Frozen Foods':      { emoji: '🧊', label: 'Frozen',             color: '#006064' }, 
  'Health & Wellness': { emoji: '💊', label: 'Health',             color: '#880E4F' }, 
  'Baby Products':     { emoji: '👶', label: 'Baby Products',      color: '#FF80AB' }, 
  // Add lowercase keys to match backend
  'chocolates':        { emoji: '🍫', label: 'Chocolates',        color: '#7B3F00' },
  'biscuits':          { emoji: '🍪', label: 'Biscuits',          color: '#F57F17' },
  'snacks':            { emoji: '🍿', label: 'Snacks',             color: '#FF6F00' },
  'beverages':         { emoji: '🥤', label: 'Beverages',          color: '#1565C0' },
  'dairy':             { emoji: '🥛', label: 'Dairy',             color: '#00838F' },
  'vegetables':        { emoji: '🥬', label: 'Vegetables',        color: '#2E7D32' },
  'fruits':            { emoji: '🍎', label: 'Fruits',            color: '#C62828' },
  'meat':              { emoji: '🥩', label: 'Meat',              color: '#1A237E' },
  'household':         { emoji: '🏠', label: 'Household',          color: '#5D4037' },
  'personal_care':     { emoji: '🧴', label: 'Personal Care',      color: '#6A1B9A' },
  'medicines':         { emoji: '💊', label: 'Medicines',         color: '#880E4F' },
  'electronics':       { emoji: '📱', label: 'Electronics',       color: '#37474F' },
  'clothing':          { emoji: '👕', label: 'Clothing',          color: '#AD1457' },
}; 
 
const DEFAULT_CATEGORY = { emoji: '🛒', label: 'Other', color: '#E95C1E' }; 
 
const getImageUrl = (images?: any[]): string | undefined => {
  const first = images?.[0];
  if (!first) return undefined;
  if (typeof first === 'string') return first;
  return (
    first?.url ||
    first?.thumb ||
    first?.small ||
    first?.medium ||
    first?.large ||
    first?.original ||
    null
  ) || undefined;
};

export default function CategoriesScreen({ navigation, route }: any) { 
  const dispatch = useDispatch(); 
  const [selectedCategory, setSelectedCategory] = useState<string | null>(route?.params?.preselect || null); 
  const [search, setSearch] = useState(''); 
 
  const { data: catData, isLoading: loadingCats } = useGetCategoriesQuery(); 
  const { data: productsData, isLoading: loadingProducts } = useGetProductsQuery( 
    { category: selectedCategory!, limit: 30 }, 
    { skip: !selectedCategory } 
  ); 
 
  React.useEffect(() => {
    if (route?.params?.preselect) {
      setSelectedCategory(route.params.preselect);
    }
  }, [route?.params?.preselect]);
 
  const categories = catData?.categories || []; 
  const products = (productsData?.products || []).filter((p: any) => 
    search.length < 2 || p.name.toLowerCase().includes(search.toLowerCase()) 
  ); 
 
  const getDisplay = (name: string) => 
    CATEGORY_DISPLAY_MAP[name] || DEFAULT_CATEGORY; 
 
  // PRODUCTS VIEW - when category selected 
  if (selectedCategory) { 
    return ( 
      <SafeAreaView style={s.container}> 
        {/* Header */} 
        <View style={s.header}> 
          <TouchableOpacity onPress={() => { setSelectedCategory(null); setSearch(''); }} 
            style={s.backBtn}> 
            <Text style={s.backTxt}>←</Text> 
          </TouchableOpacity> 
          <Text style={s.headerTitle}> 
            {getDisplay(selectedCategory).emoji} {getDisplay(selectedCategory).label} 
          </Text> 
        </View> 
 
        {/* Search within category */} 
        <View style={s.searchRow}> 
          <TextInput 
            style={s.searchInput} 
            placeholder={`Search in ${getDisplay(selectedCategory).label}...`} 
            placeholderTextColor="#aaa" 
            value={search} 
            onChangeText={setSearch} 
          /> 
          {search.length > 0 && ( 
            <TouchableOpacity onPress={() => setSearch('')} style={s.clearBtn}> 
              <Text style={s.clearTxt}>✕</Text> 
            </TouchableOpacity> 
          )} 
        </View> 
 
        {loadingProducts ? ( 
          <ActivityIndicator size="large" color="#E95C1E" style={{ margin: 40 }} /> 
        ) : products.length === 0 ? ( 
          <View style={s.emptyState}> 
            <Text style={s.emptyEmoji}>😕</Text> 
            <Text style={s.emptyTxt}> 
              {search.length > 0 
                ? `No results for "${search}"` 
                : `No products in ${getDisplay(selectedCategory).label}`} 
            </Text> 
          </View> 
        ) : ( 
          <FlatList 
            data={products} 
            numColumns={2} 
            keyExtractor={(p) => p._id} 
            contentContainerStyle={s.productGrid} 
            columnWrapperStyle={{ gap: 10 }} 
            showsVerticalScrollIndicator={false} 
            renderItem={({ item }) => { 
              const discount = item.mrp > item.price 
                ? Math.round(((item.mrp - item.price) / item.mrp) * 100) 
                : 0; 
              return ( 
                <TouchableOpacity 
                   style={s.productCard} 
                   onPress={() => navigation.navigate('ProductDetail', { productId: item._id })} 
                   activeOpacity={0.8} 
                 > 
                   <SmartImage 
                     uri={getImageUrl(item.images)} 
                     style={s.productImg} 
                     resizeMode="cover" 
                     fallbackEmoji={getDisplay(selectedCategory).emoji} 
                   /> 
                   {discount > 0 && ( 
                     <View style={s.discountBadge}> 
                       <Text style={s.discountTxt}>{discount}% off</Text> 
                     </View> 
                   )} 
                   <View style={s.productInfo}> 
                     <Text style={s.productName} numberOfLines={2}>{item.name}</Text> 
                     <View style={s.priceRow}> 
                       <Text style={s.price}>₹{item.price}</Text> 
                       {item.mrp > item.price && ( 
                         <Text style={s.mrp}>₹{item.mrp}</Text> 
                       )} 
                     </View> 
                     <TouchableOpacity 
                       style={s.addBtn} 
                       onPress={() => { 
                         dispatch(addItem({ 
                           id: item._id,
                           productId: item._id, 
                           name: item.name, 
                           price: item.price, 
                           quantity: 1, 
                           image: getImageUrl(item.images), 
                         }) as any); 
                       }} 
                     > 
                       <Text style={s.addBtnTxt}>+ Add</Text> 
                     </TouchableOpacity> 
                   </View> 
                 </TouchableOpacity> 
               ); 
             }} 
           /> 
         )} 
       </SafeAreaView> 
     ); 
   } 
 
   // CATEGORIES VIEW - main screen 
   return ( 
     <SafeAreaView style={s.container}> 
       <Text style={s.title}>Categories</Text> 
 
       {loadingCats ? ( 
         // Skeleton loading 
         <View style={s.skeletonGrid}> 
           {[1,2,3,4,5,6,7,8].map(i => ( 
             <View key={i} style={s.skeletonCard} /> 
           ))} 
         </View> 
       ) : categories.length === 0 ? ( 
         <View style={s.emptyState}> 
           <Text style={s.emptyEmoji}>🛒</Text> 
           <Text style={s.emptyTxt}>No categories found</Text> 
         </View> 
       ) : ( 
         <FlatList 
           data={categories} 
           numColumns={3} 
           keyExtractor={(c) => c.name} 
           contentContainerStyle={s.categoryGrid} 
           showsVerticalScrollIndicator={false} 
           columnWrapperStyle={{ gap: 10 }} 
           renderItem={({ item }) => { 
             const display = getDisplay(item.name); 
             return ( 
               <TouchableOpacity 
                 style={[s.categoryCard, { borderColor: display.color + '40' }]} 
                 onPress={() => setSelectedCategory(item.name)} 
                 activeOpacity={0.8} 
               > 
                 <View style={[s.emojiCircle, { backgroundColor: display.color + '15' }]}> 
                   <Text style={s.categoryEmoji}>{display.emoji}</Text> 
                 </View> 
                 <Text style={s.categoryName} numberOfLines={2}> 
                   {display.label} 
                 </Text> 
                 <Text style={s.categoryCount}>{item.count} items</Text> 
               </TouchableOpacity> 
             ); 
           }} 
         /> 
       )} 
     </SafeAreaView> 
   ); 
 } 
 
 const s = StyleSheet.create({ 
   container: { flex: 1, backgroundColor: '#f8f8f8' }, 
   title: { fontSize: 22, fontWeight: '800', color: '#222', 
     paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }, 
 
   // Category grid 
   categoryGrid: { padding: 12, paddingTop: 4 }, 
   categoryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, 
     padding: 14, alignItems: 'center', borderWidth: 1.5, 
     elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8 }, 
   emojiCircle: { width: 56, height: 56, borderRadius: 28, 
     justifyContent: 'center', alignItems: 'center', marginBottom: 8 }, 
   categoryEmoji: { fontSize: 28 }, 
   categoryName: { fontSize: 12, fontWeight: '700', color: '#333', 
     textAlign: 'center', lineHeight: 16 }, 
   categoryCount: { fontSize: 11, color: '#999', marginTop: 3 }, 
 
   // Skeleton 
   skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', 
     padding: 12, gap: 10 }, 
   skeletonCard: { width: '30%', height: 120, backgroundColor: '#e0e0e0', 
     borderRadius: 16 }, 
 
   // Header for product view 
   header: { flexDirection: 'row', alignItems: 'center', 
     padding: 16, backgroundColor: '#fff', gap: 12, 
     borderBottomWidth: 1, borderColor: '#f0f0f0' }, 
   backBtn: { padding: 4 }, 
   backTxt: { fontSize: 26, color: '#333' }, 
   headerTitle: { fontSize: 17, fontWeight: '700', color: '#222', flex: 1 }, 
 
   // Search 
   searchRow: { flexDirection: 'row', alignItems: 'center', 
     margin: 12, backgroundColor: '#fff', borderRadius: 12, 
     paddingHorizontal: 14, borderWidth: 1, borderColor: '#e0e0e0' }, 
   searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#333' }, 
   clearBtn: { padding: 8 }, 
   clearTxt: { color: '#999', fontSize: 16 }, 
 
   // Product grid 
   productGrid: { padding: 12 }, 
   productCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, 
     overflow: 'hidden', elevation: 2, 
     shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8 }, 
   productImg: { width: '100%', height: 140, backgroundColor: '#f5f5f5' }, 
   discountBadge: { position: 'absolute', top: 8, left: 8, 
     backgroundColor: '#2e7d32', paddingHorizontal: 8, 
     paddingVertical: 3, borderRadius: 6 }, 
   discountTxt: { color: '#fff', fontSize: 11, fontWeight: '700' }, 
   productInfo: { padding: 10 }, 
   productName: { fontSize: 13, color: '#333', lineHeight: 18, marginBottom: 6 }, 
   priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }, 
   price: { fontSize: 15, fontWeight: '800', color: '#E95C1E' }, 
   mrp: { fontSize: 12, color: '#bbb', textDecorationLine: 'line-through' }, 
   addBtn: { backgroundColor: '#fff8f5', borderWidth: 1.5, 
     borderColor: '#E95C1E', borderRadius: 8, 
     paddingVertical: 7, alignItems: 'center' }, 
   addBtnTxt: { color: '#E95C1E', fontWeight: '700', fontSize: 13 }, 
 
   // Empty state 
   emptyState: { flex: 1, justifyContent: 'center', 
     alignItems: 'center', gap: 12 }, 
   emptyEmoji: { fontSize: 56 }, 
   emptyTxt: { fontSize: 16, color: '#666', textAlign: 'center' }, 
 }); 
