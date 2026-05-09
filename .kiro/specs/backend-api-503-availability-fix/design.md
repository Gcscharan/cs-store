# Design Document: Backend API 503 Availability Fix

## Root Cause Analysis

### Investigation Summary

**Backend Status:**
- ✅ Server running on port 9000 (PID: 8489)
- ✅ Listening on 0.0.0.0 (accepts all network interfaces)
- ✅ Responds to localhost requests (200 OK)
- ✅ Responds to 192.168.1.4 requests (200 OK)
- ✅ Fast response time (151ms average)
- ✅ CORS configured correctly

**Mobile App Status:**
- ❌ Experiencing 503 ERR_NETWORK timeouts
- ❌ All retry attempts fail (3 retries with exponential backoff)
- ❌ 15-second axios timeout not being reached (requests fail faster)

### Root Cause

The issue is **network connectivity between the mobile device and the laptop**, NOT a backend code issue. Possible causes:

1. **macOS Firewall** - Blocking incoming connections from the mobile device's IP
2. **WiFi AP Isolation** - Router configured to prevent device-to-device communication
3. **Different Subnets** - Mobile device and laptop on different network segments
4. **Network Instability** - Packet loss or high latency causing connection failures

## Solution Design

### Option 1: Fix macOS Firewall (RECOMMENDED)

**Approach:** Configure macOS Firewall to allow incoming connections to Node.js

**Steps:**
1. Open System Settings → Network → Firewall
2. Check if Firewall is enabled
3. If enabled, add Node.js to allowed applications
4. Or temporarily disable Firewall for testing

**Pros:**
- Fixes the root cause
- No code changes required
- Permanent solution

**Cons:**
- Requires manual system configuration
- May need to repeat after macOS updates

### Option 2: Use .local mDNS Address

**Approach:** Change mobile app to use `http://GCSCharans-MacBook-Air.local:9000/api` instead of IP address

**Steps:**
1. Update `EXPO_PUBLIC_API_URL` in `.env` to use `.local` address
2. Restart Expo dev server with `npx expo start -c`

**Pros:**
- Works across network changes
- Bypasses some firewall restrictions
- More stable than IP addresses

**Cons:**
- Requires mDNS/Bonjour support on mobile device
- May not work on all Android devices
- Still subject to firewall rules

### Option 3: Verify Network Configuration

**Approach:** Ensure mobile device and laptop are on the same network

**Steps:**
1. Check mobile device WiFi settings - verify connected to same network as laptop
2. Check router settings for AP isolation - disable if enabled
3. Verify both devices are on same subnet (192.168.1.x)
4. Test connectivity with ping from mobile device to 192.168.1.4

**Pros:**
- Fixes underlying network issue
- No code changes required
- Ensures proper network setup

**Cons:**
- Requires router access
- May not be possible in some network environments

### Option 4: Add Backend Health Check Endpoint

**Approach:** Add a simple health check endpoint that mobile app can use to verify connectivity

**Steps:**
1. Verify `/health` endpoint exists and is accessible
2. Add connectivity test in mobile app startup
3. Show user-friendly error if backend unreachable

**Pros:**
- Better user experience
- Helps diagnose connectivity issues
- Provides actionable feedback

**Cons:**
- Doesn't fix the root cause
- Adds complexity to mobile app

## Recommended Solution

**Primary:** Option 1 (Fix macOS Firewall) + Option 3 (Verify Network)
**Secondary:** Option 2 (Use .local address) as fallback
**Enhancement:** Option 4 (Health check) for better UX

### Implementation Plan

1. **Immediate Fix (5 minutes):**
   - Check macOS Firewall settings
   - Temporarily disable Firewall to test
   - If it works, add Node.js to allowed applications

2. **Network Verification (5 minutes):**
   - Verify mobile device and laptop on same WiFi network
   - Check router for AP isolation settings
   - Test ping from mobile device to laptop IP

3. **Alternative Approach (10 minutes):**
   - Update mobile app to use `.local` address
   - Test connectivity with mDNS address
   - Document which approach works

4. **Enhancement (15 minutes):**
   - Add connectivity health check in mobile app
   - Show user-friendly error messages
   - Add troubleshooting guide in app

## Testing Strategy

### Manual Testing

1. **Firewall Test:**
   - Disable macOS Firewall
   - Launch mobile app
   - Verify API requests succeed
   - Re-enable Firewall with Node.js allowed
   - Verify API requests still succeed

2. **Network Test:**
   - Verify both devices on same network
   - Ping laptop IP from mobile device
   - Test API request from mobile app
   - Verify 200 OK responses

3. **mDNS Test:**
   - Update mobile app to use `.local` address
   - Restart Expo dev server
   - Test API requests
   - Verify connectivity

### Automated Testing

1. **Backend Health Check:**
   ```bash
   curl -s http://192.168.1.4:9000/api/health
   ```
   Expected: 200 OK

2. **CORS Test:**
   ```bash
   curl -s -H "Origin: http://localhost:8081" http://192.168.1.4:9000/api/health -v
   ```
   Expected: Access-Control-Allow-Origin header present

3. **Endpoint Test:**
   ```bash
   curl -s -X POST http://192.168.1.4:9000/api/auth/send-otp \
     -H "Content-Type: application/json" \
     -d '{"phone":"9391795162"}'
   ```
   Expected: 200 OK with OTP response

## Success Criteria

1. Mobile app successfully connects to backend API
2. All API endpoints return appropriate status codes (not 503)
3. No retry attempts needed for successful requests
4. Response times under 1 second for typical requests
5. Stable connectivity across app restarts

## Rollback Plan

If the fix causes issues:
1. Revert any code changes to mobile app
2. Re-enable macOS Firewall with previous settings
3. Restore original network configuration
4. Document the issue for further investigation
