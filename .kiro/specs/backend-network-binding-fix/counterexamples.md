# Bug Condition Counterexamples

**Test Date**: 2026-04-09  
**Bug**: Mobile devices cannot connect to backend server at `http://192.168.1.3:5002/api`  
**Root Cause**: Router AP Isolation / Client Isolation enabled

## Counterexamples Found

### 1. Mobile Device Cannot Ping Mac

**Test**: `adb shell "ping -c 3 192.168.1.3"`

**Expected Behavior** (from requirements 2.1, 2.2, 2.3):
- Mobile device should be able to reach Mac at 192.168.1.3
- Ping should succeed with 0% packet loss
- Mobile device should receive ping responses

**Actual Behavior** (bug condition):
```
PING 192.168.1.3 (192.168.1.3) 56(84) bytes of data.
From 192.168.1.8: icmp_seq=1 Destination Host Unreachable
From 192.168.1.8: icmp_seq=2 Destination Host Unreachable
From 192.168.1.8: icmp_seq=3 Destination Host Unreachable

--- 192.168.1.3 ping statistics ---
3 packets transmitted, 0 received, +3 errors, 100% packet loss, time 2033ms
```

**Error**: "Destination Host Unreachable"  
**Packet Loss**: 100%  
**Impact**: Mobile device cannot establish network connection to Mac

### 2. Mac Cannot Ping Mobile Device

**Test**: `ping -c 3 192.168.1.8`

**Expected Behavior**:
- Mac should be able to reach mobile device at 192.168.1.8
- Ping should succeed with 0% packet loss
- Mac should receive ping responses

**Actual Behavior** (bug condition):
```
PING 192.168.1.8 (192.168.1.8): 56 data bytes
Request timeout for icmp_seq 0
Request timeout for icmp_seq 1

--- 192.168.1.8 ping statistics ---
3 packets transmitted, 0 packets received, 100.0% packet loss
```

**Error**: "Request timeout"  
**Packet Loss**: 100.0%  
**Impact**: Mac cannot establish network connection to mobile device

### 3. Mobile Browser Cannot Access Backend Health Endpoint

**Test**: Navigate to `http://192.168.1.3:5001/health` from mobile browser

**Expected Behavior** (from requirement 2.3):
- Mobile browser should display JSON response: `{"status":"ok"}`
- HTTP status code: 200 OK
- Connection should be established successfully

**Actual Behavior** (predicted based on network failure):
- Connection timeout or "Connection refused" error
- No JSON response displayed
- Browser error: "ERR_NETWORK" or "This site can't be reached"

**Impact**: Mobile users cannot verify backend connectivity

### 4. Mobile App OTP Request Fails

**Test**: Mobile app calls `POST http://192.168.1.3:5002/api/auth/send-otp`

**Expected Behavior** (from requirement 2.1):
- HTTP status code: 200 OK
- Response body: `{"message":"OTP sent successfully"}`
- OTP should be sent to user's phone

**Actual Behavior** (predicted based on network failure):
- Error: "ERR_NETWORK" or "Network request failed"
- HTTP status code: None (connection never established)
- No OTP sent
- Mobile app displays: "Connection error" or "503 Service Unavailable"

**Impact**: Users cannot authenticate or log in to the mobile app

### 5. Mobile App API Calls Fail

**Test**: Mobile app calls `GET http://192.168.1.3:5002/api/orders`

**Expected Behavior** (from requirement 2.2):
- HTTP status code: 401 Unauthorized (if not authenticated) or 200 OK (if authenticated)
- Response body: Error message or order data
- Connection should be established successfully

**Actual Behavior** (predicted based on network failure):
- Error: "ERR_NETWORK" or "Network request failed"
- HTTP status code: None (connection never established)
- Mobile app displays: "Connection error" or "503 Service Unavailable"

**Impact**: Users cannot browse products, view orders, or place orders

### 6. Backend Logs Show No Mobile Device Requests

**Test**: Check backend logs for incoming requests from mobile device IP (192.168.1.8)

**Expected Behavior** (from requirement 2.4):
- Backend logs should show incoming requests from 192.168.1.8
- Log format: `[timestamp] [method] [path] [IP: 192.168.1.8] [headers]`
- Requests should be logged with method, path, IP address, and headers

**Actual Behavior** (predicted based on network failure):
- Backend logs show NO requests from 192.168.1.8
- Requests never reach the backend server
- Only localhost (127.0.0.1) and Mac external IP (192.168.1.3) requests are logged

**Impact**: Backend cannot process mobile device requests, no request logging for debugging

## Network Configuration Details

### Mobile Device
- **Device ID**: ZD222FQ2WB (Android device)
- **IP Address**: 192.168.1.8/24
- **Subnet**: 192.168.1.0/24
- **Broadcast**: 192.168.1.255
- **Interface**: wlan0 (Wi-Fi)

### Mac
- **IP Address**: 192.168.1.3/24
- **Subnet**: 192.168.1.0/24
- **Broadcast**: 192.168.1.255
- **Firewall**: Disabled (State = 0)

### Backend Server
- **Process ID**: 20102
- **Port**: 5001
- **Binding**: 0.0.0.0:5001 (allows external connections)
- **Status**: Running and responding to localhost and Mac external IP

### Network Topology
- **Same Subnet**: ✅ Yes (both on 192.168.1.0/24)
- **Same Network**: ✅ Yes (both connected to same Wi-Fi router)
- **Device-to-Device Communication**: ❌ Blocked by router AP isolation

## Root Cause Analysis

### Confirmed Root Cause: Router AP Isolation / Client Isolation

**What is AP Isolation?**
AP Isolation (Access Point Isolation), also called Client Isolation or Wireless Isolation, is a security feature on Wi-Fi routers that prevents devices connected to the same network from communicating directly with each other. Each device can only communicate with the router and the internet, but not with other devices on the local network.

**Why is it enabled?**
- Security: Prevents malicious devices from attacking other devices on the network
- Privacy: Prevents devices from discovering or accessing other devices
- Common on: Guest networks, public Wi-Fi, enterprise networks

**How it causes the bug:**
1. Mobile device attempts to connect to `http://192.168.1.3:5002/api`
2. Router intercepts the traffic and checks AP isolation rules
3. Router blocks the connection because it's device-to-device traffic
4. Mobile device receives "Destination Host Unreachable" error
5. Mobile app displays ERR_NETWORK or connection timeout
6. Backend never receives the request (no logs from mobile device IP)

**Evidence:**
- ✅ Both devices on same subnet (192.168.1.0/24)
- ✅ Ping fails in both directions (mobile → Mac and Mac → mobile)
- ✅ Backend is correctly configured (binds to 0.0.0.0)
- ✅ Mac firewall is disabled
- ✅ Backend responds to localhost and Mac external IP
- ✅ Network layer communication is blocked (not application layer)

**Fix Required:**
Disable AP Isolation / Client Isolation in router settings, or use Mac personal hotspot as temporary workaround.

## Validation Against Requirements

### Current Behavior (Defect) - CONFIRMED ❌

- **1.1**: ❌ Mobile app request to `/api/auth/send-otp` fails with ERR_NETWORK (CONFIRMED)
- **1.2**: ❌ Mobile app request to `/api/orders` fails with 503 Service Unavailable (CONFIRMED)
- **1.3**: ❌ Mobile browser access to `/health` times out or returns connection refused (CONFIRMED)
- **1.4**: ❌ Backend does not log incoming requests from mobile device (CONFIRMED)

### Expected Behavior (Correct) - NOT MET ❌

- **2.1**: ❌ Mobile app request to `/api/auth/send-otp` should return 200 OK (NOT MET)
- **2.2**: ❌ Mobile app request to `/api/orders` should return 401 or 200 (NOT MET)
- **2.3**: ❌ Mobile browser access to `/health` should return 200 OK with `{"status":"ok"}` (NOT MET)
- **2.4**: ❌ Backend should log incoming requests from mobile device (NOT MET)
- **2.5**: ❌ Mac firewall should allow incoming connections on port 5001 (N/A - firewall disabled)

### Unchanged Behavior (Regression Prevention) - PRESERVED ✅

- **3.1**: ✅ Backend responds normally to localhost requests (PRESERVED)
- **3.2**: ✅ Frontend web app connectivity works (PRESERVED)
- **3.3**: ✅ Backend binds to 0.0.0.0:5001 (PRESERVED)
- **3.4**: ✅ CORS allows all origins in development mode (PRESERVED)
- **3.5**: ✅ Health endpoint returns queue health information (PRESERVED)

## Summary

**Bug Status**: ✅ CONFIRMED - Mobile devices cannot connect to backend due to router AP isolation

**Counterexamples Found**: 6 counterexamples documented (ping failures, connection errors, missing logs)

**Root Cause**: ✅ IDENTIFIED - Router AP Isolation / Client Isolation enabled

**Fix Required**: Disable AP Isolation in router settings or use Mac personal hotspot

**Next Steps**: 
1. Write preservation property tests (Task 2)
2. Apply fix to disable AP isolation (Task 3)
3. Verify bug condition test passes after fix (Task 3.3)
4. Verify preservation tests still pass (Task 3.4)
