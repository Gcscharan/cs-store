# User Session Data Leakage Bugfix Design

## Overview

This design addresses a CRITICAL cross-user data leakage bug where User B briefly sees User A's data after login. The bug manifests as a visual flash showing the previous user's name, cart items, orders, and addresses before updating to the correct user's data. This is a severe privacy violation that must be fixed before production deployment.

The fix strategy follows the user's prescribed debug methodology: instrument the logout → login → render → API flow with timestamped console logs to identify the exact layer where stale data leaks (Redux persist, RTK Query cache, AsyncStorage, or UI race condition). Once identified, implement targeted cleanup at that layer.

## Glossary

- **Bug_Condition (C)**: The condition that triggers cross-user data leakage - when User A logs out and User B logs in, causing User B to see User A's persisted data
- **Property (P)**: The desired behavior - User B SHALL only see User B's data with no visual flash of User A's information
- **Preservation**: Existing single-user session behavior (cache performance, optimistic updates, state persistence) that must remain unchanged
- **Redux Persist**: Middleware that persists Redux state (auth, cart) to AsyncStorage and rehydrates on app launch
- **RTK Query Cache**: Automatic caching layer for API responses with tag-based invalidation
- **AsyncStorage**: React Native's persistent key-value storage used by Redux persist
- **SecureStore**: Expo's encrypted storage for sensitive data (tokens)
- **Rehydration**: Process where Redux persist loads saved state from AsyncStorage into Redux store
- **axiosBaseQuery**: Custom RTK Query base query that injects auth tokens from SecureStore into API requests
- **useAuthBootstrap**: Hook that runs on app launch to validate stored tokens and restore user session

## Bug Details

### Bug Condition

The bug manifests when User A logs out and User B logs in within the same app session. User B's home screen briefly displays User A's name, cart items, order history, and addresses before updating to User B's correct data. The visual flash duration is typically 500ms-2000ms depending on network latency.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { logoutEvent: Event, loginEvent: Event, uiRenderEvent: Event }
  OUTPUT: boolean
  
  RETURN input.logoutEvent.userId == "UserA"
         AND input.loginEvent.userId == "UserB"
         AND input.uiRenderEvent.displayedUserId == "UserA"
         AND input.uiRenderEvent.timestamp < input.loginEvent.apiResponseTimestamp
END FUNCTION
```

### Examples

- **Example 1**: User A (id: "abc123") logs out → User B (id: "xyz789") logs in → HomeScreen renders with "Welcome, User A" for 1 second → updates to "Welcome, User B"
  - **Expected**: HomeScreen should show loading state or blank state until User B's data is fetched
  - **Actual**: HomeScreen shows User A's name from Redux persist rehydration

- **Example 2**: User A has 3 items in cart → User A logs out → User B logs in → CartScreen shows User A's 3 items for 500ms → updates to User B's empty cart
  - **Expected**: CartScreen should show loading state until User B's cart is fetched
  - **Actual**: CartScreen shows User A's cart from Redux persist rehydration

- **Example 3**: User A logs out → User B logs in → OrdersScreen shows User A's order history → API call returns User B's orders → screen updates
  - **Expected**: OrdersScreen should show loading state until User B's orders are fetched
  - **Actual**: OrdersScreen shows User A's orders from RTK Query cache

- **Edge Case**: User A logs out → App is force-closed → App is reopened → User B logs in → User B sees User A's data
  - **Expected**: No data should persist across app restarts after logout
  - **Actual**: Redux persist rehydrates User A's state from AsyncStorage

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Single-user session caching must continue to work for performance optimization (RTK Query cache, Redux persist)
- Optimistic updates for cart operations must continue to provide instant feedback
- State persistence across app backgrounding/foregrounding for the same user must remain unchanged
- Token refresh logic and retry mechanisms must continue to function correctly
- Navigation flow and screen transitions must remain unchanged

**Scope:**
All inputs that do NOT involve user logout followed by different user login should be completely unaffected by this fix. This includes:
- Same user logging out and logging back in (their own cached data is acceptable)
- User remaining logged in and navigating between screens (cache should work normally)
- App backgrounding and resuming for the same user (state should persist)
- Network errors and retry logic during normal operation

## Hypothesized Root Cause

Based on the bug description and codebase analysis, the most likely issues are:

1. **Redux Persist Rehydration Race Condition**: The most probable cause
   - `PersistGate` rehydrates User A's state from AsyncStorage before User B's login completes
   - `authSlice.logout()` clears Redux state but does NOT purge AsyncStorage immediately
   - When User B logs in, the old persisted state is still in AsyncStorage
   - UI components render with rehydrated User A data before `/auth/me` returns User B's profile
   - **Evidence**: `store/index.ts` shows `auth` and `cart` are in persist whitelist

2. **RTK Query Cache Not Reset on Logout**: Secondary cause
   - `authApi.logout` mutation only invalidates tags `['Profile', 'Cart', 'Orders', 'Addresses']`
   - Tag invalidation marks cache as stale but does NOT delete cached data
   - When User B logs in, RTK Query may return cached User A data before refetch completes
   - **Evidence**: `authApi.ts` line 106 shows `invalidatesTags` but no `api.util.resetApiState()`

3. **AsyncStorage/SecureStore Not Cleared on Logout**: Tertiary cause
   - Current logout implementations (`AccountScreen.tsx`, `DeliveryMoreTab.tsx`) only remove tokens
   - They do NOT clear persisted Redux state from AsyncStorage
   - They do NOT call `persistor.purge()` to clear all persisted data
   - **Evidence**: `AccountScreen.tsx` lines 44-46 only remove `accessToken` and `refreshToken`

4. **UI Renders Before Authentication State Propagates**: Race condition
   - `LoginScreen.tsx` dispatches `setUser()` and `setStatus('ACTIVE')` with 500ms delay (line 73)
   - Navigation to main tabs may occur before `/auth/me` completes
   - HomeScreen components mount and render with stale Redux state
   - **Evidence**: `LoginScreen.tsx` line 73 shows `setTimeout(() => { dispatch(setUser(...)) }, 500)`

## Correctness Properties

Property 1: Bug Condition - No Cross-User Data Leakage

_For any_ logout-login sequence where User A logs out and User B logs in, the application SHALL ensure that User B never sees User A's data at any point during the login flow, including during loading states, navigation transitions, and initial screen renders.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

Property 2: Preservation - Single-User Session Performance

_For any_ user interaction that does NOT involve logout followed by different user login (same user session, same user re-login, app backgrounding/foregrounding), the application SHALL produce exactly the same caching behavior, performance characteristics, and state persistence as the original code, preserving all existing optimizations for single-user sessions.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct (Redux persist rehydration + RTK Query cache + incomplete logout cleanup):

**File**: `apps/customer-app/src/store/slices/authSlice.ts`

**Function**: `logout` reducer

**Specific Changes**:
1. **Add Logout Metadata**: Add a `lastLogoutTimestamp` field to track when logout occurred
   - This enables detection of stale rehydrated data
   - UI components can check if rehydrated data is from before last logout

**File**: `apps/customer-app/src/screens/profile/AccountScreen.tsx`

**Function**: `onLogout`

**Specific Changes**:
2. **Purge Redux Persist**: Call `persistor.purge()` before dispatching `logout()`
   - This immediately clears all persisted state from AsyncStorage
   - Prevents rehydration of stale data on next login

3. **Reset RTK Query Cache**: Dispatch `baseApi.util.resetApiState()` before logout
   - This completely clears all RTK Query cached data
   - Prevents returning cached responses from previous user

4. **Clear All Storage**: Remove all AsyncStorage keys related to user data
   - Clear tokens from SecureStore
   - Clear any other user-specific cached data

5. **Add Debug Logging**: Implement the user's prescribed logging strategy
   - Log logout start with userId and timestamp
   - Log AsyncStorage state after logout
   - Log Redux state after logout
   - Log login success with new userId and timestamp
   - Log UI render events with displayed userId and data source
   - Log API requests with token and userId
   - Log RTK Query cache keys

**File**: `apps/customer-app/src/screens/delivery/DeliveryMoreTab.tsx`

**Function**: `handleLogout`

**Specific Changes**: Same as AccountScreen.tsx (duplicate logout implementation)

**File**: `apps/customer-app/src/screens/admin/AdminDashboardScreen.tsx`

**Function**: `onLogout`

**Specific Changes**: Same as AccountScreen.tsx (duplicate logout implementation)

**File**: `apps/customer-app/src/screens/auth/LoginScreen.tsx`

**Function**: `handleVerify`

**Specific Changes**:
6. **Remove Artificial Delay**: Remove the 500ms `setTimeout` before dispatching auth actions
   - This delay serves no purpose and creates race conditions
   - Dispatch `setUser()` and `setStatus()` immediately after token storage

7. **Add Debug Logging**: Log login success with userId, token, and timestamp

**File**: `apps/customer-app/src/screens/home/HomeScreen.tsx`

**Component**: `HomeScreen`

**Specific Changes**:
8. **Add Debug Logging**: Log UI render with displayed userId, data source (redux/rtk/ui), and timestamp
   - This identifies the first place where wrong userId appears

**File**: `apps/customer-app/src/api/axiosBaseQuery.ts`

**Function**: `axiosBaseQuery`

**Specific Changes**:
9. **Add Debug Logging**: Log API requests with url, token, userIdFromState, and timestamp
   - This tracks whether API calls use correct or stale tokens

10. **Track RTK Query Cache**: Add logging to track cache keys and invalidation events

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code using the prescribed debug logging strategy, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis using the user's prescribed debug logging strategy. If we refute, we will need to re-hypothesize.

**Test Plan**: Instrument the codebase with timestamped console logs at critical points (logout, login, render, API calls, cache operations). Run the logout → login flow on UNFIXED code to observe the exact sequence of events and identify where stale data first appears.

**Debug Logging Implementation** (MUST FOLLOW EXACTLY):

**STEP 1: LOG LOGOUT (Verify Cleanup)**
In `AccountScreen.tsx`, `DeliveryMoreTab.tsx`, `AdminDashboardScreen.tsx`:
```javascript
console.log("🚪 LOGOUT START", {userId: currentUser?.id, time: Date.now()});
// ... perform logout actions ...
setTimeout(async () => {
  console.log("📦 AFTER LOGOUT STORAGE CHECK", {
    asyncStorageUser: await AsyncStorage.getItem("user"),
    asyncStorageToken: await AsyncStorage.getItem("token")
  });
}, 0);
console.log("🧠 REDUX STATE AFTER LOGOUT", store.getState());
```

**STEP 2: LOG LOGIN FLOW (Timing Critical)**
In `LoginScreen.tsx` `handleVerify`:
```javascript
console.log("🔐 LOGIN SUCCESS", {newUserId, token, time: Date.now()});
```

**STEP 3: TRACE FIRST WRONG RENDER (MOST IMPORTANT)**
In `HomeScreen.tsx` component body:
```javascript
console.log("🎯 UI RENDER", {
  renderedUserId: user?.id,
  dataSource: "redux/rtk/ui",
  time: Date.now()
});
```

**STEP 4: TRACK API CALLS (Token Leak Check)**
In `axiosBaseQuery.ts`:
```javascript
console.log("🌐 API REQUEST", {url, token, userIdFromState, time: Date.now()});
```

**STEP 5: TRACK RTK QUERY CACHE**
In logout handlers:
```javascript
console.log("📡 RTK CACHE KEYS", api.getState().queries);
```

**STEP 6: ADD HARD DELAY TEST (Confirm Race Condition)**
In `LoginScreen.tsx` after token storage:
```javascript
await new Promise(r => setTimeout(r, 1500));
```
If bug disappears → 100% race condition confirmed

**STEP 7: FORCE NO CACHE TEST**
In `baseApi.ts`:
```javascript
keepUnusedDataFor: 0
```
If bug disappears → cache leak confirmed

**Test Cases**:
1. **Basic Logout-Login Test**: User A logs out → User B logs in → observe console logs (will fail on unfixed code)
2. **App Restart Test**: User A logs out → force close app → reopen → User B logs in → observe if User A's data persists (will fail on unfixed code)
3. **Rapid Logout-Login Test**: User A logs out → immediately User B logs in → observe race condition (will fail on unfixed code)
4. **Network Delay Test**: User A logs out → User B logs in with slow network → observe extended data leakage window (will fail on unfixed code)

**Expected Counterexamples**:
- CASE A: Redux persist rehydration - `🧠 REDUX STATE AFTER LOGOUT` shows User A's data still present, then `🎯 UI RENDER` shows User A's userId before API completes
- CASE B: RTK Query cache reused - `📡 RTK CACHE KEYS` shows cached queries, then `🎯 UI RENDER` shows User A's data from cache
- CASE C: API uses old token - `🌐 API REQUEST` shows User A's token being used after User B logs in
- CASE D: UI renders before /auth/me completes - Timeline shows `🎯 UI RENDER` occurs before `🔐 LOGIN SUCCESS` API response

**Required Output**:
1. First place where WRONG userId appears (Redux state, RTK cache, UI render, or API request)
2. Timeline: logout timestamp → login timestamp → render timestamp → API response timestamp
3. Which layer: [Redux Persist / RTK Query / AsyncStorage / SecureStore / UI Race Condition]

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (User A logout → User B login), the fixed function produces the expected behavior (User B never sees User A's data).

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := performLogoutLogin_fixed(input)
  ASSERT result.uiRenderUserId == input.loginEvent.userId
  ASSERT result.displayedData.userId == input.loginEvent.userId
  ASSERT result.apiRequestToken == input.loginEvent.newToken
  ASSERT result.rtkCacheKeys.length == 0 OR result.rtkCacheKeys.allBelongTo(input.loginEvent.userId)
END FOR
```

**Test Cases**:
1. **Basic Logout-Login Test**: User A logs out → User B logs in → verify User B only sees User B's data
2. **App Restart Test**: User A logs out → force close app → reopen → User B logs in → verify no User A data persists
3. **Rapid Logout-Login Test**: User A logs out → immediately User B logs in → verify no race condition
4. **Network Delay Test**: User A logs out → User B logs in with slow network → verify loading state shown instead of User A's data

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (same user session, same user re-login, app backgrounding), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT performUserAction_original(input) = performUserAction_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for single-user sessions, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Same User Re-Login Preservation**: User A logs out → User A logs in → verify User A's cached data is acceptable (performance optimization)
2. **Single Session Cache Preservation**: User A navigates between screens → verify RTK Query cache works correctly
3. **App Backgrounding Preservation**: User A backgrounds app → resumes app → verify state persists correctly
4. **Optimistic Update Preservation**: User A adds item to cart → verify optimistic update still provides instant feedback

### Unit Tests

- Test `persistor.purge()` is called before logout action
- Test `baseApi.util.resetApiState()` is called before logout action
- Test AsyncStorage is cleared after logout
- Test SecureStore tokens are removed after logout
- Test Redux state is cleared after logout
- Test login flow dispatches auth actions immediately (no artificial delay)
- Test UI components show loading state when user data is null

### Property-Based Tests

- Generate random user pairs (User A, User B) and verify logout-login never leaks data
- Generate random app state configurations and verify logout always clears all user data
- Generate random network latency scenarios and verify no race conditions occur
- Generate random navigation sequences and verify cache behavior is preserved for single-user sessions

### Integration Tests

- Test full logout-login flow with real API calls and verify no data leakage
- Test app restart after logout and verify no persisted data remains
- Test rapid logout-login sequences and verify no race conditions
- Test logout-login with slow network and verify loading states are shown correctly
- Test same user re-login and verify performance is preserved
