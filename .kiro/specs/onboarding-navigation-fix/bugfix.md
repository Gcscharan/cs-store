# Bugfix Requirements Document

## Introduction

The React Native app crashes during the new user onboarding flow after OTP verification with the error: "The action 'NAVIGATE' with payload {"name":"Onboarding","params":{"phone":"9391795165"}} was not handled by any navigator. Do you have a screen named 'Onboarding'?". This prevents new users from completing the onboarding process after successful OTP verification.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a new user completes OTP verification and the API returns `requiresOnboarding: true` THEN the system attempts to navigate to 'Onboarding' screen but crashes with navigation error

1.2 WHEN the navigation.navigate('Onboarding', { phone }) is called from LoginScreen THEN the system fails because the Onboarding screen is not available in the current navigation stack

1.3 WHEN the auth status is 'UNAUTHENTICATED' during login flow THEN the system does not include the Onboarding screen in the navigation stack, making it unreachable

### Expected Behavior (Correct)

2.1 WHEN a new user completes OTP verification and the API returns `requiresOnboarding: true` THEN the system SHALL successfully navigate to the onboarding flow without crashing

2.2 WHEN the onboarding navigation is triggered THEN the system SHALL ensure the Onboarding screen is accessible in the current navigation context

2.3 WHEN transitioning from login to onboarding THEN the system SHALL properly update the auth status to make the Onboarding screen available before attempting navigation

### Unchanged Behavior (Regression Prevention)

3.1 WHEN existing users complete OTP verification without requiring onboarding THEN the system SHALL CONTINUE TO complete the login process normally and navigate to the main app

3.2 WHEN users with 'GOOGLE_AUTH_ONLY' status access the app THEN the system SHALL CONTINUE TO show the Onboarding screen directly as the main screen

3.3 WHEN users navigate within the app after successful authentication THEN the system SHALL CONTINUE TO function normally without navigation errors