# Authentication Hardening - Item A: JWT Secret Validation

## **Change Summary**
Added startup-time validation for JWT secrets to enforce minimum 32-character length for security.

## **Files Modified**

### `backend/src/app.ts`
- Added `validateJwtSecrets()` function at startup
- Validates both `JWT_SECRET` and `JWT_REFRESH_SECRET`
- Development mode: warns but continues
- Production mode: logs fatal error and exits with code 1

## **Unified Diff**

```diff
@@ -1,6 +1,19 @@
 import express, { Application } from "express";
 import cors from "cors";
 import passport from "passport";

+// JWT Secret Validation - Startup Security Check
+function validateJwtSecrets() {
+  const jwtSecret = process.env.JWT_SECRET;
+  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
+  
+  if (!jwtSecret || jwtSecret.length < 32) {
+    const isDev = process.env.NODE_ENV !== 'production';
+    const errorMsg = `JWT_SECRET must be at least 32 characters long. Current length: ${jwtSecret?.length || 0}`;
+    if (isDev) {
+      console.warn(`[DEV WARNING] ${errorMsg} - Using weak secret in development`);
+    } else {
+      console.error(`[FATAL] ${errorMsg}`);
+      process.exit(1);
+    }
+  }
+  
+  if (!jwtRefreshSecret || jwtRefreshSecret.length < 32) {
+    const isDev = process.env.NODE_ENV !== 'production';
+    const errorMsg = `JWT_REFRESH_SECRET must be at least 32 characters long. Current length: ${jwtRefreshSecret?.length || 0}`;
+    if (isDev) {
+      console.warn(`[DEV WARNING] ${errorMsg} - Using weak secret in development`);
+    } else {
+      console.error(`[FATAL] ${errorMsg}`);
+      process.exit(1);
+    }
+  }
+}
+
+// Run validation immediately on startup
+validateJwtSecrets();
+
 import compression from "compression";
```

## **Tests**

### Unit Tests
- **File**: `backend/tests/auth/jwt-validation.test.js`
- **Run**: `npm test jwt-validation.test.js`
- **Coverage**: Tests dev warning, prod fatal error, valid secrets, missing secrets

### Runtime Tests
- **File**: `backend/scripts/test-jwt-validation-runtime.js`
- **Run**: `node scripts/test-jwt-validation-runtime.js`
- **Coverage**: Tests actual server startup behavior

## **Manual Test Commands**

```bash
# Test 1: Development mode with short secret (should warn but continue)
JWT_SECRET="short" JWT_REFRESH_SECRET="also_short" npm run dev

# Test 2: Production mode with short secret (should exit)
NODE_ENV=production JWT_SECRET="short" JWT_REFRESH_SECRET="also_short" npm start

# Test 3: Valid secrets (should work normally)
JWT_SECRET="this_is_a_32_character_minimum_secret_for_security" JWT_REFRESH_SECRET="this_is_also_32_chars_minimum_for_refresh_secret" npm start

# Test 4: Missing secrets (should exit)
unset JWT_SECRET JWT_REFRESH_SECRET && NODE_ENV=production npm start
```

## **Why This Change is Safe & Non-Breaking**

- **Pure server-side validation**: No API changes or request/response modifications
- **Development-friendly**: Warns but doesn't break existing dev workflow
- **Production security**: Enforces minimum secret length to prevent weak JWTs
- **Zero frontend impact**: No changes to client code or authentication flows
- **Immediate validation**: Catches security issues before server starts serving requests

## **Rollback Commands**

### Single Change Rollback
```bash
git revert --no-edit <commit-hash>
```

### Complete Auth Hardening Rollback (when all items are complete)
```bash
git reset --hard <commit-before-auth-hardening>
```

## **Environment Variables Required**

Add to your `.env` file:
```bash
JWT_SECRET=your_32_character_minimum_secret_here
JWT_REFRESH_SECRET=your_32_character_minimum_secret_here
```

## **Verification Checklist**

- [ ] Development server starts with short secrets (shows warning)
- [ ] Production server exits with short secrets (fatal error)
- [ ] Server starts normally with valid secrets
- [ ] Unit tests pass: `npm test jwt-validation.test.js`
- [ ] Runtime tests pass: `node scripts/test-jwt-validation-runtime.js`
- [ ] Existing authentication flows work unchanged

---

**Next**: Item B - Helmet Security Headers
