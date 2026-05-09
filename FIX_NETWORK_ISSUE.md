# 🔧 PERMANENT FIX: Network Connectivity Issue

## Problem
Your router has **AP Isolation** enabled, which blocks device-to-device communication on WiFi. This prevents your mobile phone from reaching the backend server on your laptop.

## ✅ PERMANENT SOLUTION (5 minutes)

### Step 1: Access Your Router Admin Panel

Your router IP is: **`192.168.1.1`**

1. Open browser on your laptop
2. Go to: `http://192.168.1.1`
3. Login with router credentials:
   - Try: `admin` / `admin`
   - Or: `admin` / `password`
   - Or check the sticker on your router

### Step 2: Disable AP Isolation

**Look for these settings** (location varies by router brand):

#### Common Router Brands:

**TP-Link:**
- Wireless → Wireless Settings → Advanced → **AP Isolation** → Disable

**Netgear:**
- Advanced → Wireless Settings → **AP Isolation** → Uncheck

**D-Link:**
- Setup → Wireless Settings → Advanced → **AP Isolation** → Disable

**Asus:**
- Wireless → Professional → **AP Isolation** → No

**Linksys:**
- Wireless → Advanced Wireless Settings → **AP Isolation** → Disable

**Tenda:**
- Wireless Settings → Advanced → **AP Isolation** → Off

#### What to Look For:
- "AP Isolation"
- "Client Isolation"
- "Wireless Isolation"
- "Station Isolation"
- "SSID Isolation"

**Set it to:** OFF / Disabled / Unchecked / No

### Step 3: Save and Apply

1. Click **Save** or **Apply Changes**
2. Router may restart (wait 1-2 minutes)
3. Reconnect your devices to WiFi if needed

### Step 4: Verify Fix

**Test from your phone's browser:**
```
http://192.0.0.2:9000/health
```

**Expected result:** Should show a JSON response (not "site can't be reached")

### Step 5: Restart Your App

Once the test above works:

```bash
cd apps/customer-app
npx expo start -c
# Press 'a' to rebuild on Android
```

---

## 🎯 Alternative Solutions (If You Can't Access Router)

### Option A: Use Mobile Hotspot

1. **Enable hotspot on your phone**
2. **Connect laptop to phone's hotspot**
3. **Find laptop's new IP:**
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
4. **Update .env with new IP:**
   ```
   EXPO_PUBLIC_API_URL=http://[NEW_IP]:9000/api
   ```
5. **Restart Expo:** `npx expo start -c`

### Option B: USB Tethering

1. **Connect phone to laptop via USB**
2. **Enable USB tethering on phone:**
   - Settings → Network → Hotspot & Tethering → USB Tethering
3. **Find tethering IP:**
   ```bash
   ifconfig | grep -A 1 "bridge" | grep "inet "
   ```
4. **Update .env with tethering IP**
5. **Restart Expo**

### Option C: Use Different WiFi Network

Connect both devices to a different WiFi network that doesn't have AP Isolation (like a mobile hotspot or different router).

---

## 📋 Quick Checklist

- [ ] Access router at `http://192.168.1.1`
- [ ] Find AP Isolation setting
- [ ] Disable AP Isolation
- [ ] Save and restart router
- [ ] Test `http://192.168.1.3:9000/health` from phone browser
- [ ] Restart Expo: `npx expo start -c`
- [ ] Rebuild app on phone (press 'a')
- [ ] Test login and API calls

---

## ✅ Success Indicators

After fixing AP Isolation, you should see:
- ✅ Phone browser can load `http://192.168.1.3:9000/health`
- ✅ Mobile app connects without 503 errors
- ✅ Login with OTP works
- ✅ All API requests succeed
- ✅ Video upload feature is testable

---

## 🆘 Still Not Working?

If you've disabled AP Isolation and it still doesn't work:

1. **Restart both devices** (phone and laptop)
2. **Restart router** (unplug for 30 seconds)
3. **Check firewall on laptop:**
   ```bash
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off
   ```
4. **Try mobile hotspot** (Option A above)

---

## 📞 Need Help?

If none of these work, you may need to:
- Contact your ISP (they may have enabled isolation remotely)
- Use a different router
- Use USB tethering permanently for development
