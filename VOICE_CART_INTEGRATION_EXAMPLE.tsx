/**
 * VOICE CART INTEGRATION EXAMPLE
 * 
 * This shows how to integrate the voice-to-cart engine into SearchScreen or HomeScreen
 * Copy the relevant parts into your actual screen file
 */

import React, { useState, useCallback } from 'react';
import { View, ToastAndroid, Platform, Alert } from 'react-native';
import { useDispatch } from 'react-redux';

// Import the new voice-to-cart engine
import { 
  processVoiceInput, 
  resolveItems, 
  voiceContext,
  type ResolvedItem 
} from './utils/voiceToCartEngine';

// Import the confirmation modal
import VoiceCartConfirmation from './components/VoiceCartConfirmation';

// Import your existing hooks and actions
import { useVoiceSearch } from './hooks/useVoiceSearch';
import { addToCart } from './store/cartSlice'; // Your cart action
import { useSearchProductsMutation } from './api/productsApi'; // Your search API

// ─── Helper: Toast Notification ──────────────────────────────────

const showToast = (message: string) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    // iOS fallback
    Alert.alert('', message, [{ text: 'OK' }]);
  }
};

// ─── Main Component ───────────────────────────────────────────────

const SearchScreenWithVoiceCart = () => {
  const dispatch = useDispatch();
  const [searchProducts] = useSearchProductsMutation();
  
  // Voice cart state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [resolvedItems, setResolvedItems] = useState<ResolvedItem[]>([]);
  
  // Existing search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // ─── Voice Result Handler (THE MAGIC HAPPENS HERE) ────────────
  
  const handleVoiceResult = useCallback(async (text: string) => {
    console.log('[VoiceCart] Processing:', text);
    
    // STEP 1: Check for follow-up commands first
    const followUp = voiceContext.handleFollowUp(text);
    
    if (followUp) {
      // User said "add one more" - use context
      console.log('[VoiceCart] Follow-up detected:', followUp);
      
      const resolved = await resolveItems(followUp, async (query) => {
        const response = await searchProducts({ q: query, limit: 1 }).unwrap();
        return response.products || [];
      });
      
      if (resolved.length > 0) {
        addItemsToCart(resolved);
        showToast(`Added ${resolved.length} more item${resolved.length > 1 ? 's' : ''} 🛒`);
      }
      return;
    }
    
    // STEP 2: Process new voice input
    const result = processVoiceInput(text);
    console.log('[VoiceCart] Intent:', result.intent, 'Confidence:', result.confidence);
    
    // STEP 3: Update context memory
    voiceContext.update(result.items, result.intent);
    
    // STEP 4: Handle based on intent
    if (result.intent === 'ADD_TO_CART') {
      // Resolve items to actual products
      const resolved = await resolveItems(result.items, async (query) => {
        try {
          const response = await searchProducts({ q: query, limit: 1 }).unwrap();
          return response.products || [];
        } catch (error) {
          console.error('[VoiceCart] Search error:', error);
          return [];
        }
      });
      
      console.log('[VoiceCart] Resolved:', resolved.length, 'items');
      
      if (resolved.length > 0) {
        setResolvedItems(resolved);
        
        if (result.needsConfirmation) {
          // Show confirmation UI for low confidence or large orders
          console.log('[VoiceCart] Showing confirmation');
          setShowConfirmation(true);
        } else {
          // High confidence - add directly
          console.log('[VoiceCart] Adding directly (high confidence)');
          addItemsToCart(resolved);
          
          const itemNames = resolved.map(i => `${i.quantity}x ${i.productName}`).join(', ');
          showToast(`Added ${itemNames} 🛒`);
        }
      } else {
        // No products found - fallback to search
        console.log('[VoiceCart] No products found, fallback to search');
        setSearchQuery(text);
        showToast('No exact matches found. Showing search results.');
      }
    } else if (result.intent === 'FILTER') {
      // Handle filter intent
      console.log('[VoiceCart] Filter intent');
      setSearchQuery(result.searchQuery || text);
      // TODO: Apply filters based on voice input
    } else {
      // SEARCH intent - use existing flow
      console.log('[VoiceCart] Search intent');
      setSearchQuery(result.searchQuery || text);
    }
  }, [searchProducts, dispatch]);
  
  // ─── Add Items to Cart ────────────────────────────────────────
  
  const addItemsToCart = useCallback((items: ResolvedItem[]) => {
    items.forEach(item => {
      dispatch(addToCart({
        productId: item.productId,
        name: item.productName,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
      }));
    });
    
    // Analytics
    console.log('[VoiceCart] Added to cart:', items.length, 'items');
    // logEvent('voice_cart_add', { itemCount: items.length });
  }, [dispatch]);
  
  // ─── Voice Hook ───────────────────────────────────────────────
  
  const voice = useVoiceSearch(handleVoiceResult);
  
  // ─── Confirmation Handlers ────────────────────────────────────
  
  const handleConfirm = useCallback(() => {
    addItemsToCart(resolvedItems);
    setShowConfirmation(false);
    
    const itemNames = resolvedItems.map(i => `${i.quantity}x ${i.productName}`).join(', ');
    showToast(`Added ${itemNames} 🛒`);
    
    // Analytics
    // logEvent('voice_cart_confirmed', { itemCount: resolvedItems.length });
  }, [resolvedItems, addItemsToCart]);
  
  const handleEdit = useCallback(() => {
    setShowConfirmation(false);
    
    // Navigate to search with items
    const query = resolvedItems.map(i => i.productName).join(' ');
    setSearchQuery(query);
    
    // Analytics
    // logEvent('voice_cart_edited', { itemCount: resolvedItems.length });
  }, [resolvedItems]);
  
  const handleCancel = useCallback(() => {
    setShowConfirmation(false);
    
    // Analytics
    // logEvent('voice_cart_cancelled', { itemCount: resolvedItems.length });
  }, [resolvedItems]);
  
  // ─── Render ───────────────────────────────────────────────────
  
  return (
    <View style={{ flex: 1 }}>
      {/* Your existing UI */}
      
      {/* Voice Listening Modal (existing) */}
      {/* <VoiceListeningModal ... /> */}
      
      {/* NEW: Voice Cart Confirmation Modal */}
      <VoiceCartConfirmation
        visible={showConfirmation}
        items={resolvedItems}
        onConfirm={handleConfirm}
        onEdit={handleEdit}
        onCancel={handleCancel}
      />
    </View>
  );
};

export default SearchScreenWithVoiceCart;

// ─── Usage Examples ───────────────────────────────────────────────

/*

EXAMPLE 1: Simple Add
User says: "2 milk"
Flow:
  1. processVoiceInput() → { intent: 'ADD_TO_CART', items: [{ name: 'milk', quantity: 2 }] }
  2. resolveItems() → [{ productId: '123', productName: 'Amul Milk', quantity: 2, price: 60 }]
  3. addItemsToCart() → Dispatches to Redux
  4. showToast() → "Added 2x Amul Milk 🛒"

EXAMPLE 2: Multiple Items
User says: "lays and coke"
Flow:
  1. processVoiceInput() → { intent: 'ADD_TO_CART', items: [{ name: 'lays', quantity: 1 }, { name: 'coke', quantity: 1 }] }
  2. resolveItems() → [{ productId: '456', ... }, { productId: '789', ... }]
  3. needsConfirmation = false (high confidence)
  4. addItemsToCart() → Adds both
  5. showToast() → "Added 1x Lays, 1x Coca-Cola 🛒"

EXAMPLE 3: Low Confidence
User says: "milk"
Flow:
  1. processVoiceInput() → { intent: 'SEARCH', confidence: 'medium' }
  2. setSearchQuery('milk')
  3. Shows search results (existing flow)

EXAMPLE 4: Follow-up
User says: "2 milk" → Added to cart
User says: "add one more"
Flow:
  1. voiceContext.handleFollowUp() → [{ name: 'milk', quantity: 1 }]
  2. resolveItems() → [{ productId: '123', productName: 'Amul Milk', quantity: 1, price: 60 }]
  3. addItemsToCart() → Adds 1 more milk
  4. showToast() → "Added 1 more item 🛒"

EXAMPLE 5: Large Order (Needs Confirmation)
User says: "5 lays, 3 coke, 2 bread, maggi, biscuits"
Flow:
  1. processVoiceInput() → { intent: 'ADD_TO_CART', items: [...5 items...], needsConfirmation: true }
  2. resolveItems() → [...5 resolved items...]
  3. setShowConfirmation(true)
  4. User sees modal with all items
  5. User clicks "Add to Cart"
  6. addItemsToCart() → Adds all 5 items
  7. showToast() → "Added 5x Lays, 3x Coca-Cola, ... 🛒"

*/
