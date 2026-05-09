# 503 Error Debug Instructions

## 🎯 EXACT DECISION TREE (FOLLOW THIS)

### STEP 1 — DO YOU SEE THIS?
```
🔥 REQUEST HIT /admin/products
```

**❌ NO → STOP HERE**

**Root cause:** NOT a backend issue
- Wrong IP
- App using cached base URL
- Device not on same network

**Fix:**
```bash
cd apps/customer-app
npx expo start --clear
```

**✅ YES → CONTINUE TO STEP 2**

---

### STEP 2 — DO YOU SEE THIS?
```
Before multer
After multer
```

**❌ ONLY "Before multer" (NO "After multer")**

**💥 YOU FOUND IT → MULTER CRASH**

**WHY THIS HAPPENS (VERY COMMON):**

1. **Field name mismatch:**
   ```typescript
   fd.append("images", ...)  // Frontend
   upload.array("images")     // Backend expects this exact name
   ```
   If mismatch → crash

2. **File object invalid:**
   React Native needs:
   ```typescript
   {
     uri: string,
     name: string,
     type: string  // ← Missing this = crash
   }
   ```

3. **File size too large**

4. **Missing multipart header** (rare with fetch, common with axios misconfig)

**✅ YES (both logs appear) → CONTINUE TO STEP 2.5**

---

### STEP 2.5 — CHECK FILES RECEIVED (CRITICAL)

Look for:
```
After multer
🔥 Files received: 0
```

**❌ Files received: 0 (or undefined)**

**💥 FIELD MISMATCH OR FORMDATA ISSUE**

**Multer didn't crash BUT it didn't receive files**

**COMMON CAUSES:**

1. **Field name mismatch:**
   ```typescript
   fd.append("images[]", ...)  // Frontend (wrong)
   upload.array("images")       // Backend expects "images"
   ```

2. **FormData not being sent:**
   Check Content-Type log:
   ```
   🔥 Content-Type: application/json  // ❌ WRONG
   ```
   Should be:
   ```
   🔥 Content-Type: multipart/form-data  // ✅ CORRECT
   ```

3. **Headers manually overridden** (axios config issue)

**Result:**
- No crash
- But controller may break later when accessing `req.files`

**✅ Files received: > 0 → CONTINUE TO STEP 3**

---

### STEP 3 — DO YOU SEE THIS?
```
After multer
🔥 Files received: X
```

**BUT THEN CRASH?**

**💥 CONTROLLER ISSUE**

Problem is in `createProduct` controller.

**COMMON FAILURES:**
- Accessing undefined field
- DB insert error
- Validation failure not handled
- `req.files` undefined but assumed present

**Your logs will show:**
```
💥 SERVER ERROR: <actual stack>
```

**👉 THAT line = truth**

---

### STEP 4 — AUTH CHECK (SUBTLE ONE)

Look for:
```
🔥 Auth header: undefined
```

**IF TRUE:**
Middleware might be throwing instead of returning 401

**💣 This can produce 503 instead of 401**

---

### STEP 5 — ERROR HANDLER CHECK (EDGE CASE)

**IF YOU SEE NO ERROR LOGS AT ALL:**

No `💥 SERVER ERROR` output despite crash?

**💥 CRASH OUTSIDE MIDDLEWARE CHAIN**

**Possible causes:**
- Process crash (segfault, out of memory)
- Crash happening before Express catches it
- Unhandled promise rejection

**Check:**
- Backend terminal for process crash
- System logs
- Memory usage

---

## ⚡ EXECUTION STRATEGY (EXACT ORDER)

### 1. RUN WITHOUT IMAGES (FASTEST SIGNAL)

Comment out images in frontend. Submit.

**Result:**
- ✅ **WORKS** → multer issue
- ❌ **FAILS** → not multer (go to auth/controller)

### 2. RUN WITH IMAGES + WATCH ONLY 3 LINES

Ignore everything else. Just detect:

1. `🔥 REQUEST HIT`
2. `Before multer` / `After multer`
3. `💥 SERVER ERROR`

**👉 Detect where flow stops. That's it.**

### 3. DO NOT READ EVERYTHING

Just trace execution boundaries.

---

## 🧠 MINDSET SHIFT

Not: "I'm debugging errors"

**Upgrade to:** "I'm tracing execution boundaries"

---

## 🏁 FINAL BET

**Scenario:**
```
After multer
🔥 Files received: 0
→ Controller crashes accessing req.files
```

---

## � WHEN YOU RUN IT

**Don't explain. Just send:**

1. Backend logs (raw)
2. Frontend logs (raw)

---

## 📋 Changes Made (Reference)

### Backend Debugging Added:

1. **Route Entry Logging** (`backend/src/routes/admin.ts`):
   - Entry checkpoint: "🔥 REQUEST HIT /admin/products"
   - Auth header check
   - Content-type check
   - Before/after multer checkpoints
   - Files received count
   - Body fields

2. **Error Handler Enhanced** (`backend/src/middleware/errorHandler.ts`):
   - Full error with stack trace
   - Request details (method, URL, headers)

3. **Frontend Logging** (`apps/customer-app/src/screens/admin/AdminCreateProductScreen.tsx`):
   - FormData preparation checkpoint
   - Image appending details
   - API call success/failure

---

## 🚀 How to Run

### Step 1: Restart Backend
```bash
cd backend
npm run dev
```

### Step 2: Clear App Cache & Restart
```bash
cd apps/customer-app
npx expo start --clear
# Press 'a' for Android
```

### Step 3: Try Creating a Product

Fill in the form and submit. Watch BOTH consoles.

---

## 🔧 Common Fixes

### Fix 1: Wrong IP Address
```bash
# Check your machine's IP
ifconfig | grep "inet "

# Update .env
cd apps/customer-app
# Edit .env file with correct IP
EXPO_PUBLIC_API_URL=http://YOUR_IP:5002/api

# Clear cache and restart
npx expo start --clear
```

### Fix 2: Backend Not Running
```bash
cd backend
npm run dev
```

### Fix 3: Auth Token Expired
- Log out and log back in from the app
- Or clear app data and re-authenticate

### Fix 4: Multer Issue (if confirmed)
Check:
- Field name matches: `fd.append("images", ...)` and `upload.array("images")`
- File object has all required fields: `uri`, `name`, `type`
- File size is within limits
