# Bugfix Requirements Document

## Introduction

The Expo customer app performs a backend connectivity check on startup by calling the `/api/health` endpoint. When this check fails (due to backend being down, network issues, or ngrok tunnel problems), the app displays a blocking error screen that prevents users from accessing any functionality, including potentially offline-capable features. This creates a poor user experience where the entire app becomes unusable when the backend is temporarily unavailable.

The bug manifests as:
- Error log: `❌ Backend health check failed: 404`
- User sees `ConnectivityErrorScreen` with no way to proceed
- All app functionality is blocked, even features that could work offline
- No graceful degradation or fallback behavior

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the backend server is not running or unreachable THEN the system blocks the entire app with ConnectivityErrorScreen and prevents access to all features

1.2 WHEN the `/api/health` endpoint returns 404 (not found) THEN the system treats it as a fatal error and blocks app loading

1.3 WHEN the health check times out after 7 seconds THEN the system shows "Connection timeout" error and blocks the entire app

1.4 WHEN there is a network error (WiFi issues, no internet) THEN the system shows "Network error" message and prevents app usage

1.5 WHEN the user clicks "Retry" on ConnectivityErrorScreen THEN the system performs the same blocking health check with no fallback option

### Expected Behavior (Correct)

2.1 WHEN the backend server is not running or unreachable THEN the system SHALL allow the app to load with a non-blocking warning banner and limited functionality

2.2 WHEN the `/api/health` endpoint returns 404 (not found) THEN the system SHALL treat it as a non-fatal issue and allow app to proceed with offline mode or cached data

2.3 WHEN the health check times out after 7 seconds THEN the system SHALL skip the health check and allow the app to load with a warning indicator

2.4 WHEN there is a network error (WiFi issues, no internet) THEN the system SHALL display the existing OfflineBanner component and allow offline-capable features to work

2.5 WHEN the user clicks "Retry" on a connectivity warning THEN the system SHALL attempt reconnection in the background without blocking the UI

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the backend is reachable and `/api/health` returns 200 OK THEN the system SHALL CONTINUE TO log success and proceed normally without any warnings

3.2 WHEN the app is in online mode with successful backend connection THEN the system SHALL CONTINUE TO make API calls and update data in real-time

3.3 WHEN authentication is required for protected routes THEN the system SHALL CONTINUE TO enforce authentication and redirect to login as needed

3.4 WHEN the OfflineBanner component detects network changes THEN the system SHALL CONTINUE TO show/hide the banner based on connectivity status

3.5 WHEN Socket.IO connection is established THEN the system SHALL CONTINUE TO receive real-time updates for orders and notifications
