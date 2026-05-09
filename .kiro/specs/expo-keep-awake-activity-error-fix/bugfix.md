
# Bugfix Requirements Document

## Introduction

The application crashes with an unhandled promise rejection when `ExpoKeepAwake.activate` is called after the React Native activity or screen component has been unmounted or is no longer available. This results in the error: "Call to function 'ExpoKeepAwake.activate' has been rejected. → Caused by: The current activity is no longer available". This bug affects app stability and user experience, particularly during navigation or when screens are unmounted while keep-awake operations are pending.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ExpoKeepAwake.activate is called after the activity/screen is unmounted THEN the system throws an unhandled promise rejection error "The current activity is no longer available"

1.2 WHEN the keep-awake activation occurs during or after navigation away from a screen THEN the system crashes with "Uncaught (in promise)" error

1.3 WHEN the component unmounts before the ExpoKeepAwake operation completes THEN the system fails to handle the lifecycle mismatch gracefully

### Expected Behavior (Correct)

2.1 WHEN ExpoKeepAwake.activate is called after the activity/screen is unmounted THEN the system SHALL catch the error and handle it gracefully without crashing

2.2 WHEN the keep-awake activation occurs during or after navigation away from a screen THEN the system SHALL silently ignore the operation or log a warning without throwing an error

2.3 WHEN the component unmounts before the ExpoKeepAwake operation completes THEN the system SHALL cancel or safely abort the operation without causing an unhandled rejection

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ExpoKeepAwake.activate is called while the activity/screen is mounted and available THEN the system SHALL CONTINUE TO activate keep-awake functionality successfully

3.2 WHEN ExpoKeepAwake.deactivate is called on a mounted screen THEN the system SHALL CONTINUE TO deactivate keep-awake functionality successfully

3.3 WHEN the component lifecycle is normal (mount → use → unmount) THEN the system SHALL CONTINUE TO manage keep-awake state correctly without errors
