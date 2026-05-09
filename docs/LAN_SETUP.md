# LAN Mobile Development Setup Guide

## Overview

This guide helps you connect your mobile device to the backend server for local development. By using your Mac's `.local` hostname instead of raw IP addresses, you get a stable connection that works across any WiFi network without reconfiguration.

## Why .local Hostname?

**Benefits:**
- ✅ Works across ANY WiFi network without reconfiguration
- ✅ No need to update IP when switching networks (home → office → coffee shop)
- ✅ More stable than raw IP addresses
- ✅ Easier to remember and share with team members

**Raw IP Problems:**
- ❌ Changes when switching WiFi networks
- ❌ Requires manual .env updates for each network
- ❌ Breaks when router assigns new IP via DHCP
- ❌ Different IP ranges across locations (192.168.x.x vs 10.0.x.x vs 172.16.x.x)

## Prerequisites

- Mac and mobile device on same WiFi network
- Backend server running on Mac
- Expo Go app installed on mobile device
- Node.js installed on Mac

## Step-by-Step Setup

### Step 1: Get Your Mac Hostname

Run this command in your terminal:

```bash
scutil --get LocalHostName
```

**Example output:** `Charans-MacBook`

This is your Mac's local network name. Your full `.local` hostname will be `Charans-MacBook.local`.

### Step 2: Configure Frontend

Update `apps/customer-app/.env` (or `.env.local`):

```bash
# OLD (breaks across networks):
EXPO_PUBLIC_API_URL=http://192.0.0.2:5001/api

# NEW (stable across any network):
EXPO_PUBLIC_API_URL=http://YOUR-HOSTNAME.local:5001/api
```

Replace `YOUR-HOSTNAME` with the output from Step 1.

**Example:**
```bash
EXPO_PUBLIC_API_URL=http://Charans-MacBook.local:5001/api
```

### Step 3: Configure Mac Firewall

The Mac firewall may block incoming connections from your mobile device. You have two options:

#### Option A: Disable Firewall (Easiest for Development)

1. Open **System Settings** (or **System Preferences** on older macOS)
2. Go to **Network** → **Firewall**
3. Click the toggle to turn firewall **OFF**

#### Option B: Allow Node.js Through Firewall (More Secure)

1. Open **System Settings** → **Network** → **Firewall**
2. Ensure firewall is **ON**
3. Click **Options** button
4. Click the **+** button to add an application
5. Navigate to `/usr/local/bin/node` (or wherever Node.js is installed)
6. Select **Node** and click **Add**
7. Ensure the setting is **Allow incoming connections**
8. Click **OK**

**Finding Node.js location:**
```bash
which node
```

### Step 4: Check Router Settings

If connection still fails after Steps 1-3, your router may be blocking device-to-device communication.

#### Common Router Issues

**AP Isolation (Access Point Isolation)**
- Prevents devices on the same network from communicating with each other
- Common on public WiFi, guest networks, and some home routers
- **Solution:** Disable AP Isolation in router settings

**Client Isolation**
- Similar to AP Isolation, blocks client-to-client communication
- **Solution:** Disable Client Isolation in router settings

**Guest Mode**
- If your mobile device is on a guest network, it cannot reach devices on the main network
- **Solution:** Connect both devices to the main network (not guest network)

#### How to Access Router Settings

1. Find your router's IP address:
   ```bash
   netstat -nr | grep default
   ```
   Common router IPs: `192.168.1.1`, `192.168.0.1`, `10.0.0.1`

2. Open router IP in web browser
3. Log in with admin credentials (check router label or manual)
4. Look for settings like:
   - Wireless → Advanced → AP Isolation
   - Wireless → Client Isolation
   - Guest Network settings

### Step 5: Start Backend Server

```bash
cd backend
npm run dev
```

**Look for these log messages:**
```
🚀 Server running on port 5001
📱 Mobile connection: http://Charans-MacBook.local:5001
🏥 Health check: http://Charans-MacBook.local:5001/health
```

Copy the mobile connection URL - you'll use this to verify connectivity.

### Step 6: Test Backend Connection

From your Mac terminal, verify the server is running:

```bash
curl http://localhost:5001/health
```

**Expected response:**
```json
{"status":"ok"}
```

### Step 7: Start Expo App

```bash
cd apps/customer-app
npm start
```

Scan the QR code with Expo Go on your mobile device.

### Step 8: Verify Mobile Connection

The app should connect successfully. If you see network errors, proceed to the Troubleshooting section.

## Troubleshooting

### Connection Refused / Network Error

**Symptoms:**
- Mobile app shows "Network Error"
- Cannot reach backend API
- Timeout errors

**Solutions:**

1. **Verify backend is running:**
   ```bash
   curl http://localhost:5001/health
   ```
   Should return `{"status":"ok"}`

2. **Check firewall settings** (see Step 3)
   - Try disabling firewall temporarily to test
   - If it works with firewall off, add Node.js to allow list

3. **Check router settings** (see Step 4)
   - Disable AP Isolation
   - Disable Client Isolation
   - Ensure both devices on main network (not guest)

4. **Verify both devices on same WiFi network:**
   - Mac and mobile must be on the same network
   - Check WiFi name on both devices

5. **Test with raw IP as fallback:**
   ```bash
   # Get your Mac's IP address
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
   Update `.env` temporarily:
   ```bash
   EXPO_PUBLIC_API_URL=http://192.168.1.3:5001/api
   ```
   If this works, the issue is with `.local` hostname resolution (see Android mDNS section)

### Android mDNS Issues

**Problem:** Some Android devices block `.local` hostname resolution (mDNS/Bonjour).

**Symptoms:**
- iOS devices connect fine
- Android devices cannot resolve `.local` hostname
- "Network Error" or "Could not connect" on Android

**Solution:** Use static IP address as fallback

1. Get your Mac's current IP address:
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
   Example output: `inet 192.168.1.3`

2. Update `apps/customer-app/.env`:
   ```bash
   EXPO_PUBLIC_API_URL=http://192.168.1.3:5001/api
   ```

3. Restart Expo app

**Important:** You'll need to update this IP address when switching WiFi networks.

### Wrong Port Error

**Symptoms:**
- Backend logs show "Server running on port 9000"
- Mobile app tries to connect to port 5001
- Connection refused

**Solution:**

1. Check `backend/.env` file:
   ```bash
   PORT=5001
   ```

2. Verify backend code uses PORT environment variable (not hardcoded 9000)

3. Restart backend server:
   ```bash
   cd backend
   npm run dev
   ```

4. Verify logs show correct port:
   ```
   🚀 Server running on port 5001
   ```

### Cannot Resolve .local Hostname

**Symptoms:**
- `ping Charans-MacBook.local` fails
- DNS resolution error

**Solutions:**

1. **Verify hostname is correct:**
   ```bash
   scutil --get LocalHostName
   ```

2. **Test mDNS resolution:**
   ```bash
   dns-sd -G v4 YOUR-HOSTNAME.local
   ```

3. **Restart mDNS responder on Mac:**
   ```bash
   sudo killall -HUP mDNSResponder
   ```

4. **Use IP address fallback** (see Android mDNS section above)

### Network Switch Issues

**Symptoms:**
- App worked on home WiFi
- Stopped working after switching to office/coffee shop WiFi

**With .local hostname (recommended):**
- Should work automatically across all networks
- If it doesn't, check firewall/router settings on new network

**With raw IP address:**
- IP address changes when switching networks
- Must update `.env` with new IP address:
  ```bash
  ifconfig | grep "inet " | grep -v 127.0.0.1
  ```
- Update `EXPO_PUBLIC_API_URL` with new IP
- Restart Expo app

### Health Check Fails

**Test health check from mobile device:**

1. Get your `.local` hostname URL from backend logs
2. Open mobile browser (Safari on iOS, Chrome on Android)
3. Navigate to: `http://YOUR-HOSTNAME.local:5001/health`

**Expected result:** `{"status":"ok"}`

**If it fails:**
- Firewall is blocking (see Step 3)
- Router has AP Isolation (see Step 4)
- Devices on different networks
- Backend server not running

### Expo QR Code Scan Issues

**Problem:** QR code scans but app doesn't load

**Solutions:**

1. **Use tunnel mode:**
   ```bash
   npm start -- --tunnel
   ```

2. **Use LAN mode explicitly:**
   ```bash
   npm start -- --lan
   ```

3. **Manually enter URL in Expo Go:**
   - Open Expo Go app
   - Tap "Enter URL manually"
   - Enter: `exp://YOUR-HOSTNAME.local:8081`

## Testing Your Setup

### Quick Connection Test

```bash
# From your Mac terminal
curl http://localhost:5001/health

# From your mobile device browser
# Navigate to: http://YOUR-HOSTNAME.local:5001/health
```

Both should return: `{"status":"ok"}`

### Network Stability Test

1. Connect to WiFi network A (e.g., home WiFi)
2. Start backend and Expo app
3. Verify mobile app connects successfully
4. Switch to WiFi network B (e.g., office WiFi)
5. Verify mobile app still connects (no .env update needed)

**Expected result:** App works on both networks without any configuration changes.

## Advanced Configuration

### Custom Port

If you need to use a different port:

1. Update `backend/.env`:
   ```bash
   PORT=8080
   ```

2. Update `apps/customer-app/.env`:
   ```bash
   EXPO_PUBLIC_API_URL=http://YOUR-HOSTNAME.local:8080/api
   ```

3. Restart both backend and Expo app

### Multiple Developers

Each developer should:

1. Get their own Mac hostname: `scutil --get LocalHostName`
2. Update their local `.env` file with their hostname
3. Never commit `.env` files with personal hostnames
4. Use `.env.example` or `.env.template` for team reference

### Production vs Development

**Development (LAN):**
```bash
EXPO_PUBLIC_API_URL=http://YOUR-HOSTNAME.local:5001/api
```

**Production (deployed):**
```bash
EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api
```

Use different `.env` files or environment-specific configuration.

## Common Questions

### Q: Do I need to update .env when switching WiFi networks?

**A:** No! That's the whole point of using `.local` hostname. It works across any network without reconfiguration.

### Q: Can my teammate use my .local hostname?

**A:** No. Each Mac has its own unique `.local` hostname. Your teammate needs to use their own Mac's hostname.

### Q: Does this work on Windows or Linux?

**A:** This guide is Mac-specific. Windows and Linux have different mDNS implementations:
- **Windows:** Use Bonjour Print Services or Avahi
- **Linux:** Use Avahi daemon

### Q: Is .local hostname secure?

**A:** It's as secure as your local network. Only devices on the same WiFi network can access your `.local` hostname. For production, always use HTTPS with proper domain names.

### Q: What if my Mac hostname has spaces?

**A:** Spaces in hostnames are replaced with hyphens in `.local` addresses.

Example:
- Hostname: `Charan's MacBook`
- .local address: `Charans-MacBook.local`

### Q: Can I use this for production deployment?

**A:** No! `.local` hostnames only work on local networks. For production, use:
- Proper domain names (e.g., `api.yourdomain.com`)
- HTTPS/SSL certificates
- Cloud hosting (AWS, Railway, Vercel, etc.)

## Summary

**Setup Checklist:**
- ✅ Get Mac hostname: `scutil --get LocalHostName`
- ✅ Update frontend .env with `.local` hostname
- ✅ Configure Mac firewall (disable or allow Node.js)
- ✅ Check router settings (disable AP Isolation if needed)
- ✅ Start backend server
- ✅ Start Expo app
- ✅ Test connection from mobile device

**Key Benefits:**
- Works across any WiFi network
- No manual IP updates needed
- Stable and reliable connection
- Easy to share with team members

**Need Help?**
- Check backend logs for connection URL
- Test health check endpoint
- Review troubleshooting section
- Verify firewall and router settings

Happy coding! 🚀
