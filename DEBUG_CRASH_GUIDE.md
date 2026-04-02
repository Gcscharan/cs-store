# 🔥 REACT NATIVE CRASH DEBUG GUIDE - SURGICAL APPROACH

## 🎯 OBJECTIVE
Find the **EXACT component and EXACT prop** causing the `JSApplicationIllegalArgumentException` crash.

---

## 📋 STEP-BY-STEP DEBUG PROTOCOL

### **STEP 1: Enable Debug Version**

Replace the current OrderTrackingScreen with the debug version:

```bash
# Backup original
cp apps/customer-app/src/screens/orders/OrderTrackingScreen.tsx apps/customer-app/src/screens/orders/OrderTrackingScreen.BACKUP.tsx

# Use debug version
cp apps/customer-app/src/screens/orders/OrderTrackingScreen.DEBUG.tsx apps/customer-app/src/screens/orders/OrderTrackingScreen.tsx
```

### **STEP 2: Run App and Check Console**

```bash
cd apps/customer-app
npm run android  # or npm run ios
```

**Watch the console output carefully:**
- Look for `[🔍 ORDER_TRACKING]` logs
- Look for `[🔥 ORDER_TRACKING ERROR]` logs
- Note the LAST log before crash

---

## 🔍 BINARY SEARCH DEBUG (MOST IMPORTANT)

The debug version has **3 toggle flags** at the top of the render function:

```typescript
const RENDER_MAP = true;           // Toggle to test map
const RENDER_TIMELINE = true;      // Toggle to test timeline
const RENDER_PARTNER_INFO = true;  // Toggle to test partner info
```

### **Test Sequence:**

#### **Test 1: Disable Map**
```typescript
const RENDER_MAP = false;  // ← Change this
const RENDER_TIMELINE = true;
const RENDER_PARTNER_INFO = true;
```

**Run app → Navigate to order tracking**

**Result:**
- ✅ **Crash gone?** → Problem is in MAP section (MapView/Marker/Polyline)
- ❌ **Still crashes?** → Problem is elsewhere, continue to Test 2

---

#### **Test 2: Disable Timeline**
```typescript
const RENDER_MAP = true;
const RENDER_TIMELINE = false;  // ← Change this
const RENDER_PARTNER_INFO = true;
```

**Run app → Navigate to order tracking**

**Result:**
- ✅ **Crash gone?** → Problem is in TIMELINE section (Ionicons/Text/View)
- ❌ **Still crashes?** → Problem is elsewhere, continue to Test 3

---

#### **Test 3: Disable Partner Info**
```typescript
const RENDER_MAP = true;
const RENDER_TIMELINE = true;
const RENDER_PARTNER_INFO = false;  // ← Change this
```

**Run app → Navigate to order tracking**

**Result:**
- ✅ **Crash gone?** → Problem is in PARTNER INFO section
- ❌ **Still crashes?** → Problem is in Header or SafeAreaView

---

## 🔬 DEEP DIVE: Once You Find the Section

### **If MAP is the problem:**

1. **Check console logs for:**
   ```
   [🔍 ORDER_TRACKING] 🗺️ Final coordinates: { ... }
   [🔍 ORDER_TRACKING] ✅ Rendering MapView with coordinates
   [🔍 ORDER_TRACKING] 📍 Rendering partner marker: { ... }
   ```

2. **Look for invalid values:**
   - `latitude: NaN`
   - `longitude: undefined`
   - `latitude: null`
   - `latitude: "17.385"` (string instead of number)

3. **Common culprits:**
   ```typescript
   // ❌ BAD
   <Marker coordinate={{ latitude: undefined, longitude: undefined }} />
   
   // ❌ BAD
   <Polyline coordinates={[undefined, { lat: 17, lng: 78 }]} />
   
   // ❌ BAD
   <MapView initialRegion={{ latitude: NaN, ... }} />
   ```

---

### **If TIMELINE is the problem:**

1. **Check console logs for:**
   ```
   [🔍 ORDER_TRACKING] 🕐 Rendering timeline with X steps
   ```

2. **Look for:**
   - Invalid `color` prop (undefined, null, invalid hex)
   - Invalid `icon` name (not in Ionicons)
   - Invalid style values (NaN, undefined in width/height/opacity)

3. **Common culprits:**
   ```typescript
   // ❌ BAD
   <Ionicons name={undefined} size={24} color={Colors.success} />
   
   // ❌ BAD
   <View style={{ backgroundColor: undefined }} />
   
   // ❌ BAD
   <Text style={{ opacity: NaN }}>Label</Text>
   ```

---

### **If PARTNER INFO is the problem:**

1. **Check for:**
   - Invalid phone number format
   - Undefined partner name causing charAt(0) to fail
   - Invalid style values

2. **Common culprits:**
   ```typescript
   // ❌ BAD
   partner?.name?.charAt(0)  // if name is null, charAt fails
   
   // ❌ BAD
   <TouchableOpacity onPress={() => Linking.openURL(undefined)} />
   ```

---

## 📊 CONSOLE LOG ANALYSIS

### **What to look for in logs:**

#### **Good logs (no crash):**
```
[🔍 ORDER_TRACKING] 🚀 COMPONENT RENDER START
[🔍 ORDER_TRACKING] 📋 Route params: { orderId: "...", isFocused: true }
[🔍 ORDER_TRACKING] 📡 API State: { isLoading: false, hasError: false, hasData: true }
[🔍 ORDER_TRACKING] 📦 Tracking Data: { ... }
[🔍 ORDER_TRACKING] 🔍 Sanitizing coordinate: { latitude: 17.385, longitude: 78.486 }
[🔍 ORDER_TRACKING] ✅ Coordinate validated: { latitude: 17.385, longitude: 78.486 }
[🔍 ORDER_TRACKING] 🗺️ Final coordinates: { partnerCoord: {...}, deliveryCoord: {...} }
[🔍 ORDER_TRACKING] ✅ Rendering MapView with coordinates
```

#### **Bad logs (crash imminent):**
```
[🔍 ORDER_TRACKING] 🔍 Sanitizing coordinate: { latitude: undefined, longitude: undefined }
[🔥 ORDER_TRACKING ERROR] ❌ Invalid coordinate detected: { ... }
[🔍 ORDER_TRACKING] 🗺️ Final coordinates: { partnerCoord: null, deliveryCoord: null }
[🔍 ORDER_TRACKING] ⚠️ Showing map placeholder
```

**OR:**

```
[🔍 ORDER_TRACKING] 🔍 Sanitizing coordinate: { latitude: "17.385", longitude: "78.486" }
[🔍 ORDER_TRACKING] 🔢 Parsed values: { lat: 17.385, lng: 78.486, isNaNLat: false, isNaNLng: false }
[🔍 ORDER_TRACKING] ✅ Coordinate validated: { latitude: 17.385, longitude: 78.486 }
[🔍 ORDER_TRACKING] ✅ Rendering MapView with coordinates
💥 CRASH HERE
```

**This means:** Coordinates passed validation but something else in MapView props is invalid.

---

## 🎯 SPECIFIC PROP VALIDATION

### **Check ALL MapView props:**

```typescript
<MapView
  ref={mapRef}                    // ✅ Should be useRef<MapView>(null)
  style={styles.map}              // ✅ Check for undefined/NaN in styles
  provider={PROVIDER_GOOGLE}      // ✅ Should be constant
  initialRegion={{
    latitude: 17.385,             // ❌ Check: not NaN, not undefined, not string
    longitude: 78.486,            // ❌ Check: not NaN, not undefined, not string
    latitudeDelta: 0.05,          // ❌ Check: not NaN, not undefined, not 0
    longitudeDelta: 0.05,         // ❌ Check: not NaN, not undefined, not 0
  }}
>
```

### **Check ALL Marker props:**

```typescript
<Marker
  coordinate={{
    latitude: 17.385,             // ❌ CRITICAL: Must be valid number
    longitude: 78.486,            // ❌ CRITICAL: Must be valid number
  }}
  title="Delivery Partner"        // ✅ String is OK
  description="On the way"        // ✅ String is OK
  pinColor={Colors.primary}       // ❌ Check: valid color string
>
```

### **Check ALL Polyline props:**

```typescript
<Polyline
  coordinates={[                  // ❌ CRITICAL: Array must not contain undefined
    { latitude: 17.385, longitude: 78.486 },
    { latitude: 17.395, longitude: 78.496 },
  ]}
  strokeWidth={4}                 // ❌ Check: not NaN, not undefined
  strokeColor={Colors.primary}    // ❌ Check: valid color string
/>
```

---

## 🚨 COMMON HIDDEN BUGS

### **1. String coordinates (type coercion failure):**
```typescript
// API returns strings
const data = { latitude: "17.385", longitude: "78.486" };

// ❌ BAD: Direct use
<Marker coordinate={data} />

// ✅ GOOD: Sanitize first
const sanitized = sanitizeCoordinate(data);
<Marker coordinate={sanitized} />
```

### **2. Undefined in array:**
```typescript
// ❌ BAD
<Polyline coordinates={[partnerCoord, deliveryCoord]} />
// If either is undefined, array contains undefined

// ✅ GOOD
{partnerCoord && deliveryCoord && (
  <Polyline coordinates={[partnerCoord, deliveryCoord]} />
)}
```

### **3. Invalid color:**
```typescript
// ❌ BAD
<Marker pinColor={undefined} />
<Marker pinColor={Colors.primary} />  // If Colors.primary is undefined

// ✅ GOOD
<Marker pinColor={Colors.primary || '#3399cc'} />
```

### **4. NaN from calculations:**
```typescript
// ❌ BAD
const delta = distance / 0;  // NaN
<MapView initialRegion={{ ..., latitudeDelta: delta }} />

// ✅ GOOD
const delta = distance > 0 ? distance / 100 : 0.05;
```

---

## 🔧 QUICK FIXES

### **Fix 1: Force safe values temporarily**

Replace dynamic props with hardcoded values:

```typescript
<MapView
  initialRegion={{
    latitude: 17.385,      // ← Hardcoded
    longitude: 78.486,     // ← Hardcoded
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  }}
>
```

**If crash stops:** Data issue confirmed  
**If crash continues:** Prop structure issue

---

### **Fix 2: Add extreme validation**

```typescript
const safeNumber = (val: any, fallback: number): number => {
  const num = Number(val);
  if (isNaN(num) || !isFinite(num)) return fallback;
  return num;
};

<MapView
  initialRegion={{
    latitude: safeNumber(partnerCoord?.latitude, 17.385),
    longitude: safeNumber(partnerCoord?.longitude, 78.486),
    latitudeDelta: safeNumber(0.05, 0.05),
    longitudeDelta: safeNumber(0.05, 0.05),
  }}
>
```

---

### **Fix 3: Validate styles**

```typescript
// Check all StyleSheet values
const styles = StyleSheet.create({
  map: { 
    ...StyleSheet.absoluteFillObject,
    // ❌ Check for: width: undefined, height: NaN, opacity: null
  },
  partnerMarker: {
    backgroundColor: Colors.primary || '#3399cc',  // ← Fallback
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.white || '#ffffff',        // ← Fallback
  },
});
```

---

## 📝 WHAT TO REPORT BACK

After running the debug version, provide:

1. **Which test revealed the crash?**
   - Test 1 (Map disabled)?
   - Test 2 (Timeline disabled)?
   - Test 3 (Partner info disabled)?

2. **Last 20 console logs before crash**
   ```
   [🔍 ORDER_TRACKING] ...
   [🔍 ORDER_TRACKING] ...
   💥 CRASH
   ```

3. **Exact error message**
   ```
   JSApplicationIllegalArgumentException
   ViewManagerPropertyUpdater
   [Full stack trace]
   ```

4. **Tracking data structure**
   ```json
   {
     "status": "...",
     "partnerLocation": { ... },
     "deliveryLocation": { ... }
   }
   ```

---

## ✅ SUCCESS CRITERIA

You've found the bug when:
1. ✅ You can toggle a flag and crash disappears
2. ✅ Console logs show the exact invalid value
3. ✅ You can reproduce crash consistently
4. ✅ You know which component and which prop

---

## 🎯 NEXT STEPS AFTER FINDING BUG

1. **Document the exact line:**
   ```typescript
   // Line 245: This causes crash
   <Marker coordinate={partnerCoord} />
   // partnerCoord = { latitude: NaN, longitude: 78.486 }
   ```

2. **Apply targeted fix:**
   ```typescript
   // Fixed version
   {partnerCoord && !isNaN(partnerCoord.latitude) && (
     <Marker coordinate={partnerCoord} />
   )}
   ```

3. **Test fix:**
   - Crash should be gone
   - Functionality should work
   - No console errors

4. **Restore production version:**
   ```bash
   # Remove debug logs
   # Keep the fix
   # Test thoroughly
   ```

---

## 🚀 FASTEST PATH TO SOLUTION

1. **Run debug version** (5 min)
2. **Check console logs** (2 min)
3. **Binary search with flags** (10 min)
4. **Identify exact prop** (5 min)
5. **Apply fix** (2 min)
6. **Verify** (5 min)

**Total time: ~30 minutes to find and fix**

---

## 📞 NEED HELP?

If still stuck after following this guide:

1. **Capture full console output**
2. **Note which flags cause/prevent crash**
3. **Share tracking data JSON**
4. **Share exact error stack trace**

Then we can pinpoint the exact issue immediately.

---

**Remember:** This error is ALWAYS caused by an invalid prop. The debug version will expose it. Be systematic, follow the binary search, and you'll find it! 🎯
