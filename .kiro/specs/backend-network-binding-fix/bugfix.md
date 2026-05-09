# Bugfix Requirements Document

## Introduction

The backend server is not accessible from mobile devices on the same local network despite starting successfully. Mobile clients attempting to connect receive Network Error or 503 responses. The root causes are MULTIPLE interconnected issues: (1) hardcoded port 9000 instead of using PORT environment variable, (2) IP address instability - using raw IP (192.168.1.3) which changes across networks, (3) no hostname-based access configured (should use .local mDNS), (4) potential firewall blocking on Mac, and (5) potential router AP isolation blocking device-to-device communication. This comprehensive fix addresses all these issues to enable stable LAN connectivity across any WiFi network without deployment.

## Bug Analysis

### Current Behavior (Defect)

**Backend Issues:**
1.1 WHEN the server starts THEN it binds to port 9000 (hardcoded) instead of the PORT environment variable value

1.2 WHEN mobile devices attempt to connect to the server on the expected port THEN they receive Network Error or 503 responses due to port mismatch

1.3 WHEN the server logs startup messages THEN it displays "Server running on port 9000" regardless of the PORT environment variable value

1.4 WHEN the server starts THEN it does not log the .local hostname for easy mobile connection

**Frontend/Expo Issues:**
1.5 WHEN EXPO_PUBLIC_API_URL uses raw IP address (192.168.1.3) THEN the connection breaks when switching to different WiFi networks with different IP ranges

1.6 WHEN mobile devices use IP-based connection THEN the setup is fragile and requires manual IP updates for each network

**Network Configuration Issues:**
1.7 WHEN Mac firewall is enabled THEN it may block incoming connections from mobile devices on port 5001

1.8 WHEN router has AP Isolation or Client Isolation enabled THEN device-to-device communication is blocked even on same network

### Expected Behavior (Correct)

**Backend Fixes:**
2.1 WHEN the server starts THEN it SHALL bind to the port specified in the PORT environment variable (or default 5001)

2.2 WHEN mobile devices attempt to connect to the server on the correct port THEN they SHALL successfully establish connections and receive responses

2.3 WHEN the server logs startup messages THEN it SHALL display the actual port from the PORT environment variable

2.4 WHEN the server starts THEN it SHALL log both the IP address AND the .local hostname (e.g., "http://Charans-MacBook.local:5001") for easy mobile connection

**Frontend/Expo Fixes:**
2.5 WHEN EXPO_PUBLIC_API_URL is configured THEN it SHALL use .local hostname (e.g., "http://Charans-MacBook.local:5001/api") instead of raw IP address

2.6 WHEN mobile devices connect using .local hostname THEN the connection SHALL remain stable across any WiFi network without manual reconfiguration

**Documentation/Setup:**
2.7 WHEN developers set up the project THEN documentation SHALL provide clear instructions for getting Mac hostname via `scutil --get LocalHostName`

2.8 WHEN developers encounter connection issues THEN documentation SHALL provide firewall configuration steps (System Settings → Firewall → OFF or allow Node)

2.9 WHEN developers encounter connection issues THEN documentation SHALL provide router troubleshooting steps (disable AP Isolation, Client Isolation, Guest Mode)

2.10 WHEN Android devices block mDNS THEN documentation SHALL provide fallback instructions for using static IP method

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the server binds to network interfaces THEN it SHALL CONTINUE TO bind to 0.0.0.0 (all network interfaces) for external accessibility

3.2 WHEN the server starts in production mode THEN it SHALL CONTINUE TO use the PORT environment variable without fallback

3.3 WHEN the server starts in development mode THEN it SHALL CONTINUE TO default to port 5001 if PORT is not set

3.4 WHEN health check endpoint is accessed THEN it SHALL CONTINUE TO return {"status": "ok"} on the /health route

3.5 WHEN all API routes are accessed THEN they SHALL CONTINUE TO function exactly as before

3.6 WHEN Socket.io connections are established THEN they SHALL CONTINUE TO work exactly as before

3.7 WHEN database operations are performed THEN they SHALL CONTINUE TO work exactly as before
