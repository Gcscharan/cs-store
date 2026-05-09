# Search Bar Standardization Bugfix Design

## Overview

The application currently has multiple inconsistent search bar implementations across HomeScreen, ProductDetailScreen, CategoriesScreen, and SearchScreen. This creates an inconsistent user experience where search bars look different and behave differently depending on which screen the user is on. The HomeScreen has the correct implementation with microphone functionality, proper styling, and correct behavior that should serve as the single source of truth.

This bugfix will extract the HomeScreen search bar into a reusable component (`HomeSearchBar.tsx`) and replace all inconsistent implementations with this standardized component. The fix is minimal and safe: extract the exact HomeScreen implementation as-is, define a minimal interface, and integrate it into other screens without changing any UI or adding features.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when users navigate between screens and encounter different search bar implementations with inconsistent styling, behavior, and functionality
- **Property (P)**: The desired behavior - all screens should display identical search bars with consistent styling, microphone functionality, and navigation behavior based on the HomeScreen implementation
- **Preservation**: All existing functionality must remain unchanged - HomeScreen search bar works exactly as before, voice search works, navigation works, no crashes occur
- **HomeSearchBar**: The new reusable component to be extracted from HomeScreen containing the search bar UI, microphone button, and navigation logic
- **useVoiceSearch**: The hook in `apps/customer-app/src/hooks/useVoiceSearch.ts` that provides voice search functionality with state management and speech recognition
- **VoiceListeningModal**: The modal component that displays voice search UI feedback during voice input

## Bug Details

### Bug Condition

The bug manifests when a user navigates between different screens (HomeScreen, ProductDetailScreen, CategoriesScreen, SearchScreen). Each screen has its own search bar implementation with different visual styling, different behavior, and different functionality. This creates an inconsistent user experience and duplicated code that must be maintained separately.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { currentScreen: string, previousScreen: string }
  OUTPUT: boolean
  
  RETURN input.currentScreen IN ['HomeScreen', 'ProductDetailScreen', 'CategoriesScreen', 'SearchScreen']
         AND input.previousScreen IN ['HomeScreen', 'ProductDetailScreen', 'CategoriesScreen', 'SearchScreen']
         AND input.currentScreen != input.previousScreen
         AND searchBarImplementation(input.currentScreen) != searchBarImplementation(input.previousScreen)
END FUNCTION
```

### Examples

- **HomeScreen → ProductDetailScreen**: User sees a full-featured search bar with microphone on HomeScreen, then sees a simplified header search bar without microphone on ProductDetailScreen
- **HomeScreen → CategoriesScreen**: User sees the HomeScreen search bar with proper styling and microphone, then sees a different search input with different styling on CategoriesScreen
- **HomeScreen → SearchScreen**: User sees the HomeScreen search bar, then sees a completely different search input implementation on SearchScreen
- **Edge case - Developer maintenance**: When a developer needs to update search bar styling or functionality, they must update 4 separate implementations instead of 1 centralized component

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- HomeScreen search bar must continue to work exactly as before with all existing functionality
- Voice search functionality must continue to work with microphone button triggering voice input
- Navigation to SearchScreen must continue to work when search bar is tapped
- All other screen functionality (product display, cart operations, navigation) must remain unchanged

**Scope:**
All inputs and interactions that do NOT involve the search bar UI should be completely unaffected by this fix. This includes:
- Product browsing and selection
- Cart operations
- Navigation between screens (except search bar navigation which should be standardized)
- Voice search modal display and behavior
- All other UI components and their interactions

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Multiple Separate Implementations**: Each screen has its own inline search bar implementation instead of using a shared component
   - HomeScreen: Lines 113-135 with full microphone functionality and proper styling
   - ProductDetailScreen: Lines 1009-1024 with simplified header search bar (no microphone)
   - CategoriesScreen: Lines 1046-1062 with basic search input (no microphone)
   - SearchScreen: Lines 1046-1073 with different search input implementation (has microphone but different styling)

2. **No Reusable Component**: There is no `HomeSearchBar.tsx` or similar component in `apps/customer-app/src/components/` directory

3. **Duplicated Styles**: Each screen defines its own search bar styles instead of sharing a common style definition

4. **Inconsistent Props**: Each implementation has different props and behavior patterns, making it difficult to standardize

## Correctness Properties

Property 1: Bug Condition - Standardized Search Bar Across Screens

_For any_ screen navigation where the user moves between HomeScreen, ProductDetailScreen, CategoriesScreen, or SearchScreen, the fixed implementation SHALL display identical search bars with consistent visual appearance, microphone functionality, and navigation behavior based on the HomeScreen implementation.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Existing Functionality Unchanged

_For any_ user interaction with the search bar or other screen functionality, the fixed implementation SHALL produce exactly the same behavior as the original code, preserving all existing functionality including voice search, navigation, and screen-specific behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `apps/customer-app/src/components/HomeSearchBar.tsx` (NEW)

**Action**: Create new reusable component

**Specific Changes**:
1. **Extract HomeScreen Search Bar**: Copy the exact search bar implementation from HomeScreen (lines 113-135) including:
   - Search bar container with proper styling
   - Search icon and placeholder text
   - Microphone button with voice search integration
   - TouchableOpacity for navigation to SearchScreen
   - All associated styles from HomeScreen StyleSheet

2. **Define Minimal Interface**: Create props interface with only essential parameters:
   ```typescript
   interface HomeSearchBarProps {
     onPress?: () => void;           // Navigation handler (default: navigate to Search)
     onMicPress?: () => void;        // Microphone handler (default: start voice search)
     placeholder?: string;           // Placeholder text (default: "Search for products…")
     voiceState?: VoiceSearchState;  // Voice search state for mic icon styling
     navigation: any;                // Navigation object for default behavior
   }
   ```

3. **Preserve Voice Search Integration**: Include `useVoiceSearch` hook integration and `VoiceListeningModal` exactly as in HomeScreen

4. **Extract Styles**: Copy all search bar related styles from HomeScreen:
   - `searchBarRow`
   - `searchBar`
   - `micBtn`
   - `searchPlaceholder`

5. **Add Default Behavior**: Implement default navigation to SearchScreen if no custom `onPress` provided

**File**: `apps/customer-app/src/screens/home/HomeScreen.tsx`

**Action**: Replace inline search bar with `HomeSearchBar` component

**Specific Changes**:
1. **Import Component**: Add `import { HomeSearchBar } from '../../components/HomeSearchBar';`
2. **Replace Lines 113-135**: Replace entire search bar implementation with:
   ```tsx
   <HomeSearchBar
     navigation={navigation}
     voiceState={voice.state}
     onMicPress={handleMicPress}
   />
   ```
3. **Remove Styles**: Delete `searchBarRow`, `searchBar`, `micBtn`, `searchPlaceholder` from StyleSheet (lines in `s` object)
4. **Keep Voice Logic**: Preserve all voice search state and handlers (`handleMicPress`, `handleVoiceResult`, `handleVoiceCancel`, `voice` hook, `voiceModalVisible` state)

**File**: `apps/customer-app/src/screens/products/ProductDetailScreen.tsx`

**Action**: Replace header search bar with `HomeSearchBar` component

**Specific Changes**:
1. **Import Component**: Add `import { HomeSearchBar } from '../../components/HomeSearchBar';`
2. **Replace Lines 1009-1024**: Replace `headerSearchBar` View with:
   ```tsx
   <HomeSearchBar
     navigation={navigation}
     placeholder="Search or ask a question"
   />
   ```
3. **Remove Styles**: Delete `headerSearchBar` and `headerSearchPlaceholder` from StyleSheet
4. **Adjust Header Layout**: Update header flexDirection to accommodate new search bar component

**File**: `apps/customer-app/src/screens/products/CategoriesScreen.tsx`

**Action**: Replace search input with `HomeSearchBar` component

**Specific Changes**:
1. **Import Component**: Add `import { HomeSearchBar } from '../../components/HomeSearchBar';`
2. **Replace Lines 1046-1062**: Replace `searchBarWrapper` and `searchRow` with:
   ```tsx
   <HomeSearchBar
     navigation={navigation}
     placeholder={`Search in ${categoryInfo.name}...`}
     onPress={() => {
       // Keep existing search behavior for category-specific search
       // This will be handled by passing the category context
     }}
   />
   ```
3. **Remove Styles**: Delete `searchBarWrapper`, `searchRow`, `searchInput`, `clearBtn` from StyleSheet
4. **Preserve Search Logic**: Keep existing search state and filtering logic, only replace UI component

**File**: `apps/customer-app/src/screens/search/SearchScreen.tsx`

**Action**: Replace search input with `HomeSearchBar` component

**Specific Changes**:
1. **Import Component**: Add `import { HomeSearchBar } from '../../components/HomeSearchBar';`
2. **Replace Lines 1046-1073**: Replace `searchBar` View with:
   ```tsx
   <HomeSearchBar
     navigation={navigation}
     placeholder="Search for products..."
     voiceState={voice.state}
     onMicPress={handleMicPress}
     onPress={() => {
       // SearchScreen needs editable input, so we'll keep the TextInput
       // but wrap it in HomeSearchBar styling
     }}
   />
   ```
3. **Note**: SearchScreen is special - it needs an editable TextInput, not just a button. We'll need to add an optional `editable` prop to `HomeSearchBar` to support this use case
4. **Remove Styles**: Delete `searchBar`, `searchIcon`, `searchInput`, `clearBtn` from StyleSheet

### Additional Considerations

1. **SearchScreen Special Case**: SearchScreen needs an editable input field, not just a navigation button. We'll add an optional `editable` prop to `HomeSearchBar`:
   ```typescript
   interface HomeSearchBarProps {
     // ... existing props
     editable?: boolean;          // If true, render TextInput instead of TouchableOpacity
     value?: string;              // Current search value (for editable mode)
     onChangeText?: (text: string) => void;  // Text change handler (for editable mode)
   }
   ```

2. **Category-Specific Search**: CategoriesScreen has category-specific search logic. We'll preserve this by allowing custom `onPress` handler that can implement category filtering

3. **Voice Modal Management**: Voice modal state and handlers will remain in parent screens, only the search bar UI will be extracted

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that navigate between screens and capture screenshots of search bars. Compare visual appearance, measure dimensions, and verify functionality differences. Run these tests on the UNFIXED code to observe inconsistencies and understand the root cause.

**Test Cases**:
1. **HomeScreen → ProductDetailScreen Navigation**: Navigate from HomeScreen to ProductDetailScreen and verify search bars look different (will fail on unfixed code - different styling, no microphone)
2. **HomeScreen → CategoriesScreen Navigation**: Navigate from HomeScreen to CategoriesScreen and verify search bars look different (will fail on unfixed code - different styling, no microphone)
3. **HomeScreen → SearchScreen Navigation**: Navigate from HomeScreen to SearchScreen and verify search bars look different (will fail on unfixed code - different styling)
4. **Microphone Availability Test**: Check microphone button presence across all screens (will fail on unfixed code - only HomeScreen and SearchScreen have microphone)

**Expected Counterexamples**:
- Search bars have different heights, padding, border radius, and colors across screens
- Microphone button is missing on ProductDetailScreen and CategoriesScreen
- Search placeholder text is different across screens
- Possible causes: multiple separate implementations, no shared component, duplicated styles

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL navigation WHERE isBugCondition(navigation) DO
  result := renderSearchBar_fixed(navigation.currentScreen)
  ASSERT expectedBehavior(result)
  ASSERT result.styling == homeScreenSearchBarStyling
  ASSERT result.hasMicrophone == true
  ASSERT result.navigatesToSearchScreen == true
END FOR
```

**Test Cases**:
1. **Visual Consistency Test**: Navigate between all screens and verify search bars are visually identical
2. **Microphone Functionality Test**: Verify microphone button is present and functional on all screens
3. **Navigation Test**: Verify tapping search bar navigates to SearchScreen from all screens
4. **Voice Search Test**: Verify voice search works from all screens with microphone button

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL interaction WHERE NOT isBugCondition(interaction) DO
  ASSERT originalBehavior(interaction) = fixedBehavior(interaction)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-search-bar interactions

**Test Plan**: Observe behavior on UNFIXED code first for all non-search-bar interactions, then write property-based tests capturing that behavior.

**Test Cases**:
1. **HomeScreen Functionality Preservation**: Observe that HomeScreen search bar works correctly on unfixed code (voice search, navigation, styling), then write test to verify this continues after fix
2. **Product Browsing Preservation**: Observe that product browsing, selection, and cart operations work correctly on unfixed code, then write test to verify this continues after fix
3. **Navigation Preservation**: Observe that all navigation flows work correctly on unfixed code, then write test to verify this continues after fix
4. **Voice Modal Preservation**: Observe that voice listening modal displays correctly on unfixed code, then write test to verify this continues after fix

### Unit Tests

- Test `HomeSearchBar` component renders correctly with default props
- Test `HomeSearchBar` component renders correctly with custom props
- Test microphone button triggers voice search when pressed
- Test search bar navigates to SearchScreen when pressed
- Test editable mode renders TextInput correctly (for SearchScreen)
- Test voice state updates microphone icon styling correctly

### Property-Based Tests

- Generate random navigation sequences between screens and verify search bars are always identical
- Generate random voice search inputs and verify voice functionality works across all screens
- Generate random screen states and verify all non-search-bar functionality continues to work

### Integration Tests

- Test full navigation flow: HomeScreen → ProductDetailScreen → CategoriesScreen → SearchScreen with search bar interactions at each step
- Test voice search flow: Start voice search from each screen, verify modal displays, verify navigation to SearchScreen with query
- Test search functionality: Search from each screen, verify results display correctly, verify navigation works
