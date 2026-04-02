/**
 * 🔥 CRASH DEBUGGER - Global Error Interceptor
 * 
 * This utility intercepts ALL console errors and React Native crashes
 * to help identify the exact source of JSApplicationIllegalArgumentException
 */

import React from 'react';
import { Platform, View, Text } from 'react-native';

// Store original console methods
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

// Crash detection state
let lastRenderComponent: string | null = null;
let lastPropsLogged: any = null;
let crashDetected = false;

/**
 * Enhanced console.error that captures crash context
 */
export const interceptConsoleError = () => {
  console.error = (...args: any[]) => {
    // Check if this is the ViewManager crash
    const errorString = args.join(' ');
    
    if (
      errorString.includes('ViewManagerPropertyUpdater') ||
      errorString.includes('JSApplicationIllegalArgumentException') ||
      errorString.includes('ViewManagersPropertyCache')
    ) {
      crashDetected = true;
      
      console.log('\n\n');
      console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');
      console.log('🔥 CRASH DETECTED - CRITICAL INFORMATION 🔥');
      console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');
      console.log('\n');
      
      console.log('📍 LAST COMPONENT RENDERED:', lastRenderComponent || 'Unknown');
      console.log('\n');
      
      console.log('📦 LAST PROPS LOGGED:');
      console.log(JSON.stringify(lastPropsLogged, null, 2));
      console.log('\n');
      
      console.log('💥 ERROR MESSAGE:');
      console.log(errorString);
      console.log('\n');
      
      console.log('📚 FULL STACK:');
      args.forEach((arg, index) => {
        console.log(`[${index}]:`, arg);
      });
      console.log('\n');
      
      console.log('🔍 DEBUGGING HINTS:');
      console.log('1. Check the LAST PROPS LOGGED for undefined/NaN/null values');
      console.log('2. The crash happened in:', lastRenderComponent);
      console.log('3. Look for invalid coordinate, style, or prop values');
      console.log('4. Common culprits: latitude/longitude, color, transform, opacity');
      console.log('\n');
      
      console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');
      console.log('\n\n');
    }
    
    // Call original error
    originalError.apply(console, args);
  };
};

/**
 * Log component render with context
 */
export const logComponentRender = (componentName: string, props?: any) => {
  lastRenderComponent = componentName;
  if (props) {
    lastPropsLogged = props;
  }
  
  if (!crashDetected) {
    console.log(`[🎨 RENDER] ${componentName}`, props ? JSON.stringify(props, null, 2) : '');
  }
};

/**
 * Log prop validation
 */
export const logPropValidation = (propName: string, value: any, isValid: boolean) => {
  const status = isValid ? '✅' : '❌';
  console.log(`[${status} PROP] ${propName}:`, value, `(valid: ${isValid})`);
  
  if (!isValid) {
    console.warn(`⚠️ INVALID PROP DETECTED: ${propName} =`, value);
    lastPropsLogged = { ...lastPropsLogged, [propName]: value };
  }
};

/**
 * Validate coordinate object
 */
export const validateCoordinate = (coord: any, name: string = 'coordinate'): boolean => {
  if (!coord) {
    logPropValidation(name, coord, false);
    return false;
  }
  
  const lat = Number(coord.latitude);
  const lng = Number(coord.longitude);
  
  const isValid = 
    !isNaN(lat) && 
    !isNaN(lng) && 
    isFinite(lat) && 
    isFinite(lng) && 
    lat >= -90 && 
    lat <= 90 && 
    lng >= -180 && 
    lng <= 180;
  
  logPropValidation(name, { latitude: lat, longitude: lng }, isValid);
  
  return isValid;
};

/**
 * Validate style object
 */
export const validateStyle = (style: any, name: string = 'style'): boolean => {
  if (!style) return true; // undefined style is OK
  
  const invalidKeys: string[] = [];
  
  Object.keys(style).forEach(key => {
    const value = style[key];
    
    // Check for invalid values
    if (value === undefined || value === null) {
      invalidKeys.push(`${key}=undefined/null`);
    } else if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) {
      invalidKeys.push(`${key}=NaN/Infinity`);
    }
  });
  
  const isValid = invalidKeys.length === 0;
  
  if (!isValid) {
    logPropValidation(name, { invalidKeys, style }, false);
  }
  
  return isValid;
};

/**
 * Validate color string
 */
export const validateColor = (color: any, name: string = 'color'): boolean => {
  if (!color) {
    logPropValidation(name, color, false);
    return false;
  }
  
  const isValid = typeof color === 'string' && color.length > 0;
  logPropValidation(name, color, isValid);
  
  return isValid;
};

/**
 * Validate number prop
 */
export const validateNumber = (num: any, name: string = 'number'): boolean => {
  const value = Number(num);
  const isValid = !isNaN(value) && isFinite(value);
  
  logPropValidation(name, value, isValid);
  
  return isValid;
};

/**
 * Safe coordinate getter with validation
 */
export const getSafeCoordinate = (
  coord: any,
  fallback: { latitude: number; longitude: number } = { latitude: 20.5937, longitude: 78.9629 }
): { latitude: number; longitude: number } => {
  if (!coord) {
    console.warn('[SAFE_COORD] Coordinate is null/undefined, using fallback');
    return fallback;
  }
  
  const lat = Number(coord.latitude);
  const lng = Number(coord.longitude);
  
  if (
    isNaN(lat) || isNaN(lng) ||
    !isFinite(lat) || !isFinite(lng) ||
    lat < -90 || lat > 90 ||
    lng < -180 || lng > 180
  ) {
    console.warn('[SAFE_COORD] Invalid coordinate, using fallback:', coord);
    return fallback;
  }
  
  return { latitude: lat, longitude: lng };
};

/**
 * Safe number getter with validation
 */
export const getSafeNumber = (value: any, fallback: number = 0): number => {
  const num = Number(value);
  
  if (isNaN(num) || !isFinite(num)) {
    console.warn('[SAFE_NUMBER] Invalid number, using fallback:', value);
    return fallback;
  }
  
  return num;
};

/**
 * Safe color getter with validation
 */
export const getSafeColor = (color: any, fallback: string = '#000000'): string => {
  if (!color || typeof color !== 'string' || color.length === 0) {
    console.warn('[SAFE_COLOR] Invalid color, using fallback:', color);
    return fallback;
  }
  
  return color;
};

/**
 * Initialize crash debugger
 */
export const initCrashDebugger = () => {
  console.log('\n');
  console.log('🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍');
  console.log('🔍 CRASH DEBUGGER INITIALIZED 🔍');
  console.log('🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍');
  console.log('Platform:', Platform.OS);
  console.log('Intercepting console.error for crash detection');
  console.log('All component renders and prop validations will be logged');
  console.log('🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍');
  console.log('\n');
  
  interceptConsoleError();
};

/**
 * React Error Boundary helper
 */
export class CrashDebugBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.log('\n\n');
    console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');
    console.log('🔥 ERROR BOUNDARY CAUGHT CRASH 🔥');
    console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');
    console.log('\n');
    console.log('📍 LAST COMPONENT:', lastRenderComponent);
    console.log('📦 LAST PROPS:', JSON.stringify(lastPropsLogged, null, 2));
    console.log('💥 ERROR:', error.toString());
    console.log('📚 ERROR INFO:', JSON.stringify(errorInfo, null, 2));
    console.log('\n');
    console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');
    console.log('\n\n');
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const, padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' as const, marginBottom: 10 }}>
            🔥 Crash Detected
          </Text>
          <Text style={{ fontSize: 14, textAlign: 'center' as const, marginBottom: 20 }}>
            Check console logs for details
          </Text>
          <Text style={{ fontSize: 12, color: '#666' }}>
            Last component: {lastRenderComponent}
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

// Export all utilities
export default {
  initCrashDebugger,
  interceptConsoleError,
  logComponentRender,
  logPropValidation,
  validateCoordinate,
  validateStyle,
  validateColor,
  validateNumber,
  getSafeCoordinate,
  getSafeNumber,
  getSafeColor,
  CrashDebugBoundary,
};
