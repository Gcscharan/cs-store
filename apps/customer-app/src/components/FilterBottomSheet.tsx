import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface FilterState {
  minPrice: number;
  maxPrice: number;
  category: string | null;
  rating: number | null;
  sortBy: 'relevance' | 'price' | 'newest' | 'sales' | 'rating';
  sortOrder: 'asc' | 'desc';
}

interface FilterBottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  onClearAll: () => void;
  filters: FilterState;
  categories: { name: string; count: number }[];
  mode: 'filter' | 'sort';
}

const PRICE_RANGES = [
  { label: 'Under ₹500', min: 0, max: 500 },
  { label: '₹500 - ₹1,000', min: 500, max: 1000 },
  { label: '₹1,000 - ₹2,000', min: 1000, max: 2000 },
  { label: '₹2,000 - ₹5,000', min: 2000, max: 5000 },
  { label: 'Over ₹5,000', min: 5000, max: 50000 },
];

const RATINGS = [4, 3, 2, 1];

const SORT_OPTIONS: { label: string; value: FilterState['sortBy']; order: FilterState['sortOrder'] }[] = [
  { label: 'Relevance', value: 'relevance', order: 'desc' },
  { label: 'Price: Low to High', value: 'price', order: 'asc' },
  { label: 'Price: High to Low', value: 'price', order: 'desc' },
  { label: 'Newest Arrivals', value: 'newest', order: 'desc' },
  { label: 'Customer Rating', value: 'rating', order: 'desc' },
];

const FilterBottomSheet: React.FC<FilterBottomSheetProps> = ({
  isVisible,
  onClose,
  onApply,
  onClearAll,
  filters,
  categories,
  mode,
}) => {
  const updateFilter = useCallback((key: keyof FilterState, value: any) => {
    onApply({ ...filters, [key]: value });
  }, [filters, onApply]);

  const updateSort = useCallback((value: FilterState['sortBy'], order: FilterState['sortOrder']) => {
    onApply({ ...filters, sortBy: value, sortOrder: order });
    onClose(); // Close sort immediately on selection for better UX
  }, [filters, onApply, onClose]);

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      swipeDirection="down"
      onSwipeComplete={onClose}
      style={styles.modal}
      propagateSwipe
      backdropOpacity={0.4}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      useNativeDriverForBackdrop
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>{mode === 'sort' ? 'Sort By' : 'Filters'}</Text>
            {mode === 'filter' && (
              <TouchableOpacity onPress={onClearAll}>
                <Text style={styles.resetText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
          {mode === 'sort' ? (
            <View style={styles.section}>
              <View style={styles.listOptions}>
                {SORT_OPTIONS.map((option) => {
                  const isSelected = filters.sortBy === option.value && filters.sortOrder === option.order;
                  return (
                    <TouchableOpacity
                      key={`${option.value}-${option.order}`}
                      style={styles.listItem}
                      onPress={() => updateSort(option.value, option.order)}
                    >
                      <Text style={[styles.listItemText, isSelected && styles.listItemTextActive]}>
                        {option.label}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark" size={20} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : (
            <>
              {/* Price Range */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Price Range</Text>
                <View style={styles.optionsGrid}>
                  {PRICE_RANGES.map((range) => {
                    const isSelected = filters.minPrice === range.min && filters.maxPrice === range.max;
                    return (
                      <TouchableOpacity
                        key={range.label}
                        style={[styles.pill, isSelected && styles.pillActive]}
                        onPress={() => {
                          updateFilter('minPrice', range.min);
                          updateFilter('maxPrice', range.max);
                        }}
                      >
                        <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                          {range.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Categories */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Categories</Text>
                <View style={styles.optionsGrid}>
                  <TouchableOpacity
                    style={[styles.pill, filters.category === null && styles.pillActive]}
                    onPress={() => updateFilter('category', null)}
                  >
                    <Text style={[styles.pillText, filters.category === null && styles.pillTextActive]}>
                      All Categories
                    </Text>
                  </TouchableOpacity>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.name}
                      style={[styles.pill, filters.category === cat.name && styles.pillActive]}
                      onPress={() => updateFilter('category', cat.name)}
                    >
                      <Text style={[styles.pillText, filters.category === cat.name && styles.pillTextActive]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Ratings */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Customer Rating</Text>
                <View style={styles.optionsGrid}>
                  {RATINGS.map((rate) => (
                    <TouchableOpacity
                      key={rate}
                      style={[styles.pill, filters.rating === rate && styles.pillActive]}
                      onPress={() => updateFilter('rating', rate)}
                    >
                      <View style={styles.ratingPillContent}>
                        <Text style={[styles.pillText, filters.rating === rate && styles.pillTextActive]}>
                          {rate}+
                        </Text>
                        <Ionicons
                          name="star"
                          size={12}
                          color={filters.rating === rate ? Colors.white : Colors.warning}
                          style={{ marginLeft: 4 }}
                        />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}
          
          <View style={{ height: 40 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.applyBtn} onPress={onClose}>
            <Text style={styles.applyBtnText}>Show Results</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  resetText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  pillTextActive: {
    color: Colors.white,
  },
  ratingPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listOptions: {
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  listItemText: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  listItemTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.white,
  },
  applyBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
});

export default FilterBottomSheet;
