# Implementation Tasks

## Task 1: Fix Backend Hostname Display Bug
**Status:** ✅ COMPLETED
**Description:** Fix the double `.local.local` bug in backend server startup logs

### Subtasks:
- [x] 1.1 Update `getLocalHostname()` function to strip existing `.local` suffix before adding it
- [x] 1.2 Verify backend logs show correct hostname format

**Implementation:**
- Modified `backend/src/index.ts` to remove `.local` suffix if already present in hostname
- This prevents `GCSCharans-MacBook-Air.local.local` and shows correct `GCSCharans-MacBook-Air.local`

---

## Task 2: Diagnose Network Connectivity Issue
**Status:** ✅ COMPLETED
**Description:** Identify why mobile device cannot reach backend server at 192.168.1.4:9000

### Subtasks:
- [x] 2.1 Verify mobile device and laptop are on same WiFi network
  - Both devices on 192.168.1.x network
  - Confirmed same WiFi network
  
- [x] 2.2 Test network connectivity from mobile device
  - Tested from phone browser: `http://192.168.1.4:9000/health`
  - Result: "This site can't be reached" - connection refused
  
- [x] 2.3 Check router AP Isolation settings
  - Router IP: 192.168.1.1
  - **ROOT CAUSE IDENTIFIED: AP Isolation is enabled on router**
  - This blocks device-to-device communication on WiFi
  
- [x] 2.4 Test backend accessibility from laptop
  - Backend responds successfully on localhost
  - Backend responds successfully on 192.168.1.4 from laptop
  - Issue is specifically mobile-to-laptop communication

**Outcome:**
- ✅ Root cause identified: **Router AP Isolation is blocking mobile device from reaching laptop**
- ✅ Backend is working correctly
- ✅ Network configuration is correct
- ✅ Solution: Disable AP Isolation in router settings

---

## Task 3: Implement Network Connectivity Fix
**Status:** ⏳ WAITING FOR USER ACTION
**Description:** Apply appropriate fix based on root cause identified in Task 2

**ROOT CAUSE:** Router AP Isolation is enabled, blocking device-to-device communication.

**SOLUTION:** User must disable AP Isolation in router settings (cannot be done programmatically).

### Required User Action:

**Step 1: Access Router Admin Panel**
- Open browser: `http://192.168.1.1`
- Login with router credentials (admin/admin or check router label)

**Step 2: Disable AP Isolation**
- Navigate to: Wireless Settings → Advanced → AP Isolation
- Set to: **OFF** / **Disabled** / **Unchecked**
- Save and apply changes
- Router may restart (wait 1-2 minutes)

**Step 3: Verify Fix**
- Open phone browser
- Test: `http://192.168.1.4:9000/health`
- Should show JSON response (not "site can't be reached")

**Step 4: Restart Expo**
```bash
cd apps/customer-app
npx expo start -c
# Press 'a' to rebuild on Android
```

### Documentation Created:
- [x] Created `FIX_NETWORK_ISSUE.md` with detailed step-by-step guide
- [x] Created `diagnose-network.sh` diagnostic script
- [x] Documented all alternative solutions (USB tethering, mobile hotspot)

### Alternative Options (if router access not possible):
- Option A: Use mobile hotspot (connect laptop to phone's hotspot)
- Option B: USB tethering (connect phone via USB, enable tethering)
- Option C: Use different WiFi network without AP isolation

**Expected Outcome:**
- Mobile app successfully connects to backend API
- All API requests return appropriate status codes (not 503)
- No network timeouts

---

## Task 4: Add Backend Request Logging for Debugging
**Status:** ⏳ NOT STARTED
**Description:** Add detailed logging to help diagnose future connectivity issues

### Subtasks:
- [x] 4.1 Add middleware to log all incoming requests with source IP
- [x] 4.2 Log request method, path, and timestamp
- [x] 4.3 Log response status and duration
- [x] 4.4 Add special logging for mobile app requests (User-Agent detection)

**Implementation Notes:**
- Add Express middleware in `backend/src/createApp.ts`
- Use existing logger utility
- Include source IP to identify mobile vs localhost requests

---

## Task 5: Enhance Mobile App Error Handling
**Status:** ⏳ NOT STARTED
**Description:** Improve user experience when backend is unreachable

### Subtasks:
- [ ] 5.1 Add connectivity health check on app startup
  - Test `/health` endpoint before loading main screens
  - Show user-friendly error if unreachable
  
- [ ] 5.2 Add retry logic with exponential backoff (already exists, verify it works)
  - Confirm current retry logic in `axiosBaseQuery.ts`
  - Ensure 3 retries with 1s, 2s, 4s delays
  
- [ ] 5.3 Show actionable error messages to users
  - "Cannot connect to server. Please check your WiFi connection."
  - "Server unreachable. Make sure you're on the same network."
  - Add troubleshooting tips in error dialog
  
- [ ] 5.4 Add network status indicator in app
  - Show green dot when connected
  - Show red dot when disconnected
  - Update in real-time

**Expected Outcome:**
- Users understand why app isn't working
- Clear guidance on how to fix connectivity issues
- Better debugging information for developers

---

## Task 6: Document Network Setup Requirements
**Status:** ⏳ NOT STARTED
**Description:** Create documentation for developers setting up local development

### Subtasks:
- [ ] 6.1 Create `NETWORK_SETUP.md` in backend directory
- [ ] 6.2 Document required network configuration
  - Same WiFi network requirement
  - AP Isolation must be disabled
  - Firewall configuration (if needed)
  
- [ ] 6.3 Add troubleshooting guide
  - How to check if devices are on same network
  - How to test connectivity with ping
  - How to disable AP Isolation
  - Alternative connection methods (USB tethering, .local address)
  
- [ ] 6.4 Add mobile app setup instructions
  - How to configure `EXPO_PUBLIC_API_URL`
  - How to find laptop IP address
  - How to restart Expo dev server

**Expected Outcome:**
- Clear documentation for future developers
- Reduced setup time for new team members
- Self-service troubleshooting guide

---

## Task 7: Verify Fix and Test End-to-End
**Status:** ⏳ NOT STARTED (depends on Task 3)
**Description:** Comprehensive testing to ensure issue is resolved

### Subtasks:
- [ ] 7.1 Test authentication flow
  - Send OTP request from mobile app
  - Verify 200 OK response
  - Verify OTP received
  
- [ ] 7.2 Test data fetching endpoints
  - GET /orders - verify returns order data
  - GET /products - verify returns product listings
  - GET /cart - verify returns cart data
  - GET /notifications/unread/count - verify returns count
  - GET /user/addresses - verify returns addresses
  
- [ ] 7.3 Test under different network conditions
  - Restart WiFi router
  - Reconnect mobile device
  - Verify connectivity persists
  
- [ ] 7.4 Test with multiple mobile devices (if available)
  - Verify fix works for different phones
  - Test both Android and iOS if possible
  
- [ ] 7.5 Measure and document response times
  - Verify all requests complete under 1 second
  - Document average response time
  - Ensure no timeouts

**Success Criteria:**
- ✅ All API endpoints return appropriate status codes
- ✅ No 503 ERR_NETWORK errors
- ✅ Response times under 1 second
- ✅ Stable connectivity across app restarts
- ✅ No retry attempts needed for successful requests

---

## Priority Order

1. **IMMEDIATE:** Task 2 (Diagnose) - Must identify root cause first
2. **HIGH:** Task 3 (Fix) - Apply appropriate solution based on diagnosis
3. **HIGH:** Task 7 (Verify) - Ensure fix works end-to-end
4. **MEDIUM:** Task 4 (Logging) - Helps prevent future issues
5. **MEDIUM:** Task 5 (Error Handling) - Improves user experience
6. **LOW:** Task 6 (Documentation) - Helps future developers

## Notes

- Task 1 is already completed (hostname bug fix)
- Task 2 must be completed before Task 3 can begin
- Task 3 has multiple options - choose based on Task 2 findings
- Task 7 should be done after Task 3 to verify the fix works
- Tasks 4, 5, 6 can be done in parallel after main issue is resolved
