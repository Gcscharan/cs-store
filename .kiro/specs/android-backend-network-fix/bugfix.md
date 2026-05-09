# Bugfix Requirements Document

## Introduction

A physical Android device (moto_g54_5G) running the customer app via Expo dev build (`npm run dev:mobile`) cannot reach the backend server at `http://192.168.1.3:5002/api`. The device is on the same WiFi subnet (192.168.1.x) as the host machine, and the backend URL is correctly configured via `EXPO_PUBLIC_API_URL` in `apps/customer-app/.env`. Every API call — including the health check, orders, and auth/send-otp endpoints — fails with `ERR_NETWORK` / HTTP 503, making the app completely non-functional on physical Android hardware.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the customer app runs on a physical Android device and makes any HTTP request to `http://192.168.1.3:5002/api/*` THEN the system fails with `Network request failed` / `ERR_NETWORK`

1.2 WHEN the health check endpoint `http://192.168.1.3:5002/api/health` is called from the Android device THEN the system returns a connectivity failure instead of a successful health response

1.3 WHEN the orders endpoint `http://192.168.1.3:5002/api/orders` is called from the Android device THEN the system exhausts all 4 retry attempts and returns a 503 error with message "Network error. Please check your connection."

1.4 WHEN the auth/send-otp endpoint is called from the Android device THEN the system fails with `{"data": "Network error. Please check your connection.", "status": 503}`

### Expected Behavior (Correct)

2.1 WHEN the customer app runs on a physical Android device and makes any HTTP request to the configured backend URL THEN the system SHALL successfully reach the backend server and receive a valid HTTP response

2.2 WHEN the health check endpoint is called from the Android device THEN the system SHALL return a 200 OK response confirming backend connectivity

2.3 WHEN the orders endpoint is called from the Android device THEN the system SHALL return the orders data without exhausting retries

2.4 WHEN the auth/send-otp endpoint is called from the Android device THEN the system SHALL successfully send the OTP request and return a valid response

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the app runs on an iOS simulator or Android emulator THEN the system SHALL CONTINUE TO connect to the backend using the configured URL without errors

3.2 WHEN the app runs in a web browser (Expo web) THEN the system SHALL CONTINUE TO connect to the backend using the configured URL without errors

3.3 WHEN the backend URL is changed via `EXPO_PUBLIC_API_URL` THEN the system SHALL CONTINUE TO use the updated URL for all API requests

3.4 WHEN a valid API request is made from any non-Android-physical-device environment THEN the system SHALL CONTINUE TO return correct data with appropriate HTTP status codes
