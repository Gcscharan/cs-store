/**
 * CategoryGrid — Premium, scalable category grid component
 *
 * GRID SPEC (v4 — Final Production Polish):
 * ┌─────────────────────────────────────────────────────────┐
 * │  Columns:   3                                           │
 * │  Item:      responsive via Dimensions                   │
 * │  Gap:       justifyContent: 'space-between'             │
 * │  Card BG:   #FFF7F2 (warm tint)                         │
 * │  Image:     100% fill, resizeMode="contain", overflow   │
 * │  Radius:    20 (container) / 0 (image — fills card)     │
 * │  Touch:     Pressable → scale(0.95) + opacity(0.85)     │
 * │  Label:     12px / 600 / textSecondary                  │
 * │  ₹ tiles:   text-only design (no coin images)           │
 * └─────────────────────────────────────────────────────────┘
 */

import React, { memo, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
  ListRenderItemInfo,
} from 'react-native';
import { Colors } from '../constants/colors';

// ─── Responsive Grid Computation (Premium 3-Column) ────────
const SCREEN_WIDTH = Dimensions.get('window').width;
const NUM_COLUMNS = 3;
const HORIZONTAL_PADDING = 16;
const GAP = 16;
const TOTAL_GAP = GAP * (NUM_COLUMNS - 1);
const ITEM_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - TOTAL_GAP) / NUM_COLUMNS;

// ─── Types ─────────────────────────────────────────────────
export interface CategoryItem {
  name: string;
  image?: { uri: string } | number;
  /** If true, renders a text-only tile instead of an image */
  isTextTile?: boolean;
  /** Display text for text-only tiles (e.g. "₹1") */
  tileText?: string;
  /** Subtitle for text tiles (e.g. "Items") */
  tileSubtext?: string;
  /** Background color for text tiles */
  tileBg?: string;
  /** Text color for text tiles */
  tileColor?: string;
  count?: number;
}

interface CategoryGridProps {
  categories: CategoryItem[];
  onSelect: (categoryName: string) => void;
  ListHeaderComponent?: React.ReactElement | null;
}

// ─── Text Tile (for ₹ categories) ──────────────────────────
const TextTileContent = memo(({ item }: { item: CategoryItem }) => (
  <View style={[styles.textTile, item.tileBg ? { backgroundColor: item.tileBg } : null]}>
    <Text style={[styles.tileMainText, item.tileColor ? { color: item.tileColor } : null]}>
      {item.tileText || item.name}
    </Text>
    {item.tileSubtext && (
      <Text style={[styles.tileSubText, item.tileColor ? { color: item.tileColor, opacity: 0.7 } : null]}>
        {item.tileSubtext}
      </Text>
    )}
  </View>
));

// ─── Single Category Card (Premium) ────────────────────────
const CategoryCard = memo(({ item, onSelect }: { item: CategoryItem; onSelect: (name: string) => void }) => {
  const handlePress = useCallback(() => {
    onSelect(item.name);
  }, [onSelect, item.name]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
      android_ripple={{
        color: 'rgba(255, 106, 0, 0.08)',
        borderless: false,
        radius: ITEM_WIDTH / 2,
      }}
    >
      <View style={[
        styles.imageContainer,
        item.isTextTile && { backgroundColor: item.tileBg || '#F0F9FF', borderColor: Colors.border },
      ]}>
        {item.isTextTile ? (
          <TextTileContent item={item} />
        ) : (
          <Image
            source={item.image!}
            style={styles.image}
            resizeMode="contain"
          />
        )}
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {item.name}
      </Text>
    </Pressable>
  );
});

// ─── Grid Container ────────────────────────────────────────
const CategoryGrid: React.FC<CategoryGridProps> = memo(({ categories, onSelect, ListHeaderComponent }) => {
  const keyExtractor = useCallback((item: CategoryItem) => item.name, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<CategoryItem>) => (
      <CategoryCard item={item} onSelect={onSelect} />
    ),
    [onSelect],
  );

  const columnWrapperStyle = useMemo(
    () => ({ justifyContent: 'space-between' as const }),
    [],
  );

  const displayedCategories = categories.slice(0, 9);

  return (
    <FlatList
      data={displayedCategories}
      numColumns={NUM_COLUMNS}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      contentContainerStyle={styles.grid}
      columnWrapperStyle={columnWrapperStyle}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
      initialNumToRender={9}
      maxToRenderPerBatch={9}
      windowSize={3}
      removeClippedSubviews={Platform.OS === 'android'}
      ListHeaderComponent={ListHeaderComponent}
    />
  );
});

export default CategoryGrid;
export { ITEM_WIDTH, NUM_COLUMNS, GAP, HORIZONTAL_PADDING };

// ─── Styles ────────────────────────────────────────────────
const styles = StyleSheet.create({
  grid: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 12,
    paddingBottom: 28,
  },
  card: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    marginBottom: 16,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  imageContainer: {
    width: ITEM_WIDTH,
    height: ITEM_WIDTH,
    backgroundColor: '#FFF7F2',
    borderRadius: 20,
    borderWidth: 0.8,
    borderColor: '#F0EAE5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 10,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  // ─── Text tile styles (₹ categories) ──────
  textTile: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileMainText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  tileSubText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.primary,
    opacity: 0.55,
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  label: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#2A2A2A',
    textAlign: 'center',
    lineHeight: 17,
    width: ITEM_WIDTH,
    paddingHorizontal: 2,
    letterSpacing: 0.2,
  },
});
