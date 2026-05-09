# Router AP Isolation Fix Guide

**Date**: 2026-04-09  
**Root Cause**: Router AP Isolation / Client Isolation Enabled  
**Fix**: Disable AP Isolation in Router Settings

## Overview

This guide provides step-by-step instructions for disabling AP Isolation (also called Client Isolation, Wireless Isolation, or Station Isolation) on your router. This will allow devices on your Wi-Fi network to communicate with each other, enabling your mobile device to connect to the backend server running on your Mac.

## Prerequisites

- Router admin credentials (username and password)
- Access to router admin interface (typically via web browser)
- Router IP address (usually 192.168.1.1 or 192.168.0.1)

## Step 1: Access Router Admin Interface

### Find Your Router's IP Address

Your router's IP address is typically the gateway address. You can find it using:

**On Mac**:
```bash
netstat -nr | grep default
```

**Common Router IP Addresses**:
- 192.168.1.1
- 192.168.0.1
- 192.168.2.1
- 10.0.0.1

### Access Router Admin Panel

1. Open a web browser (Safari, Chrome, Firefox)
2. Enter your router's IP address in the address bar: `http://192.168.1.1`
3. Press Enter
4. You'll see a login page for your router

### Login to Router

- **Username**: Usually `admin`, `administrator`, or blank
- **Password**: Check the label on your router, or use the password you set during initial setup
- If you've never changed it, try common defaults:
  - admin/admin
  - admin/password
  - admin/[blank]
  - [blank]/admin

## Step 2: Locate AP Isolation Setting

The location of the AP Isolation setting varies by router manufacturer and model. Here are common locations:

### Common Router Brands

#### TP-Link Routers
1. Navigate to: **Wireless** → **Wireless Settings** → **Advanced**
2. Look for: "Enable AP Isolation" or "Enable Wireless Isolation"
3. Uncheck the box
4. Click **Save**

#### Netgear Routers
1. Navigate to: **Advanced** → **Wireless Settings** → **Advanced Setup**
2. Look for: "Enable Wireless Isolation" or "Enable AP Isolation"
3. Uncheck the box
4. Click **Apply**

#### Linksys Routers
1. Navigate to: **Wireless** → **Advanced Wireless Settings**
2. Look for: "AP Isolation" or "Client Isolation"
3. Select **Disabled**
4. Click **Save Settings**

#### ASUS Routers
1. Navigate to: **Wireless** → **Professional**
2. Look for: "Set AP Isolated" or "Wireless Isolation"
3. Select **No** or **Disabled**
4. Click **Apply**

#### D-Link Routers
1. Navigate to: **Setup** → **Wireless Settings** → **Advanced**
2. Look for: "Enable Wireless Isolation" or "AP Isolation"
3. Uncheck the box
4. Click **Save Settings**

#### Google Nest WiFi / Google WiFi
1. Open the Google Home app on your phone
2. Tap on your Wi-Fi network
3. Tap **Settings** → **Advanced Networking**
4. Look for: "Device Isolation" or "AP Isolation"
5. Toggle it **Off**

#### Apple AirPort Routers
1. Open **AirPort Utility** on Mac
2. Select your router
3. Click **Edit**
4. Go to **Wireless** tab
5. Look for: "Enable Wireless Client Isolation"
6. Uncheck the box
7. Click **Update**

### Generic Search Terms

If your router brand isn't listed above, look for these settings:
- **AP Isolation**
- **Client Isolation**
- **Wireless Isolation**
- **Station Isolation**
- **Guest Mode** (if enabled, disable it)
- **Intra-BSS Communication** (should be enabled)
- **Allow Wireless Clients to Communicate**

### Common Menu Paths

Try navigating through these menu structures:
- Wireless → Advanced → AP Isolation
- Wireless → Security → AP Isolation
- Advanced → Wireless → Isolation
- Settings → Wireless → Advanced Settings
- Network → Wireless → Advanced

## Step 3: Disable AP Isolation

Once you've located the AP Isolation setting:

1. **Uncheck** the box for "Enable AP Isolation" or "Enable Wireless Isolation"
   - OR **Select** "Disabled" from the dropdown
   - OR **Toggle** the switch to "Off"
2. Click **Save**, **Apply**, or **Update** (button name varies by router)
3. Wait for the router to apply the changes (may take 10-30 seconds)

## Step 4: Reboot Router (If Required)

Some routers require a reboot for changes to take effect:

1. Look for a **Reboot** or **Restart** button in the admin interface
   - OR unplug the router power cable, wait 10 seconds, plug it back in
2. Wait for the router to fully restart (1-3 minutes)
3. Wait for the Wi-Fi network to become available again
4. Reconnect your Mac and mobile device to the Wi-Fi network

## Step 5: Verify Fix

After disabling AP Isolation, verify that devices can now communicate:

### Test 1: Ping from Mobile Device to Mac

```bash
adb shell "ping -c 3 192.168.1.3"
```

**Expected Result**:
```
PING 192.168.1.3 (192.168.1.3) 56(84) bytes of data.
64 bytes from 192.168.1.3: icmp_seq=1 ttl=64 time=5.23 ms
64 bytes from 192.168.1.3: icmp_seq=2 ttl=64 time=4.87 ms
64 bytes from 192.168.1.3: icmp_seq=3 ttl=64 time=5.01 ms

--- 192.168.1.3 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2003ms
rtt min/avg/max/mdev = 4.870/5.037/5.230/0.148 ms
```

✅ **Success**: If you see responses with 0% packet loss, AP isolation is disabled!

❌ **Failure**: If you still see "Destination Host Unreachable", AP isolation may still be enabled or there's another network issue.

### Test 2: Ping from Mac to Mobile Device

```bash
ping -c 3 192.168.1.8
```

**Expected Result**:
```
PING 192.168.1.8 (192.168.1.8): 56 data bytes
64 bytes from 192.168.1.8: icmp_seq=0 ttl=64 time=6.123 ms
64 bytes from 192.168.1.8: icmp_seq=1 ttl=64 time=5.987 ms
64 bytes from 192.168.1.8: icmp_seq=2 ttl=64 time=6.045 ms

--- 192.168.1.8 ping statistics ---
3 packets transmitted, 3 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 5.987/6.052/6.123/0.056 ms
```

✅ **Success**: If you see responses with 0% packet loss, bidirectional communication is working!

### Test 3: Access Backend Health Endpoint from Mobile Browser

1. Open a web browser on your mobile device
2. Navigate to: `http://192.168.1.3:5001/health`
3. You should see a JSON response:

```json
{
  "status": "ok",
  "uptime": 1234.56,
  "timestamp": "2026-04-09T10:00:00.000Z",
  "queues": { "healthy": true, ... },
  "workers": { "healthy": true, ... }
}
```

✅ **Success**: If you see the JSON response, the backend is now accessible from your mobile device!

### Test 4: Test Mobile App API Calls

1. Open your mobile app
2. Attempt to log in with OTP
3. The OTP request should succeed and you should receive an OTP

✅ **Success**: If the OTP is sent successfully, the fix is complete!

## Troubleshooting

### Issue: Cannot Find AP Isolation Setting

**Solution**:
1. Check your router's user manual (search online: "[Router Model] user manual PDF")
2. Search for "AP Isolation" or "Client Isolation" in the manual
3. Contact your router manufacturer's support for guidance
4. Try searching online: "[Router Model] disable AP isolation"

### Issue: Don't Have Router Admin Credentials

**Solution**:
1. Check the label on the back/bottom of your router for default credentials
2. If you changed the password and forgot it, you may need to reset the router to factory defaults
3. **Warning**: Factory reset will erase all custom settings (Wi-Fi name, password, port forwarding, etc.)
4. To factory reset: Hold the reset button on the router for 10-30 seconds

### Issue: AP Isolation is Already Disabled

**Solution**:
1. There may be another network issue (firewall on router, VLAN separation, etc.)
2. Try the Mac Personal Hotspot workaround (see alternative guide)
3. Check if your router has multiple Wi-Fi networks (2.4GHz vs 5GHz) - ensure both devices are on the same network
4. Check if your mobile device is on a "Guest Network" - guest networks always have isolation enabled

### Issue: Ping Works But HTTP Requests Still Fail

**Solution**:
1. Verify backend server is running: `ps aux | grep node | grep backend`
2. Verify backend is listening on port 5001: `lsof -i :5001`
3. Check if there's a firewall on the router blocking port 5001
4. Try accessing a different port to test (e.g., port 8080)

## Security Considerations

### What is AP Isolation?

AP Isolation is a security feature that prevents devices on the same Wi-Fi network from communicating directly with each other. Each device can only communicate with the router and the internet, but not with other devices on the local network.

### Why Disable It?

For local development and testing, you need devices to communicate with each other. Disabling AP isolation allows your mobile device to connect to the backend server running on your Mac.

### Security Impact

**Risks of Disabling AP Isolation**:
- Devices on your Wi-Fi network can communicate with each other
- If a malicious device joins your network, it could potentially access other devices
- Shared folders, printers, and services become accessible to all devices on the network

**Mitigation**:
- Use a strong Wi-Fi password (WPA2 or WPA3 encryption)
- Don't share your Wi-Fi password with untrusted devices
- Enable MAC address filtering on your router (optional)
- Use a separate "Guest Network" for untrusted devices (keep AP isolation enabled on guest network)
- For production deployments, use proper network security (VPN, firewall rules, etc.)

### When to Keep AP Isolation Enabled

- Public Wi-Fi networks (coffee shops, airports, hotels)
- Guest networks for visitors
- Networks with untrusted devices
- Enterprise/corporate networks with strict security policies

## Alternative: Mac Personal Hotspot (Temporary Workaround)

If you cannot access your router settings or prefer not to disable AP isolation, you can use Mac's personal hotspot as a temporary workaround:

### Steps:

1. On Mac: **System Preferences** → **Sharing** → **Internet Sharing**
2. Share your connection from: **Wi-Fi** or **Ethernet**
3. To computers using: **Wi-Fi**
4. Click **Wi-Fi Options** to set network name and password
5. Enable **Internet Sharing** (check the box)
6. On your mobile device: Connect to the Mac's hotspot
7. Test connectivity: `adb shell "ping -c 3 <mac_hotspot_ip>"`

**Pros**:
- No router configuration required
- Quick temporary solution
- Bypasses router isolation completely

**Cons**:
- Temporary solution only
- Mac must be running and hotspot enabled
- May have performance limitations
- Not suitable for long-term development

## Summary

After completing this guide, you should have:

1. ✅ Accessed your router admin interface
2. ✅ Located the AP Isolation setting
3. ✅ Disabled AP Isolation
4. ✅ Rebooted router (if required)
5. ✅ Verified devices can ping each other
6. ✅ Verified mobile device can access backend health endpoint
7. ✅ Verified mobile app can make API calls successfully

**Next Steps**: Return to the bugfix workflow and proceed with verification testing (Task 3.3 and 3.4).

