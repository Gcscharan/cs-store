import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import {
  useAddAddressMutation,
  useUpdateAddressMutation,
  useLazyCheckPincodeQuery,
  Address,
  PincodeCheckResponse,
} from '../../api/addressesApi';
import { useGetAddressesQuery } from '../../api/addressesApi';
import type { ProfileNavigationProp, ProfileStackParamList } from '../../navigation/types';
import type { RouteProp } from '@react-navigation/native';

type LabelType = 'HOME' | 'SHOP' | 'OTHER' | 'OFFICE';

interface FormData {
  name: string;
  phone: string;
  house: string;
  area: string;
  landmark: string;
  pincode: string;
  city: string;
  state: string;
  admin_district: string;
  label: LabelType;
  isDefault: boolean;
}

interface PincodeStatus {
  isChecking: boolean;
  isResolved: boolean;
  isDeliverable: boolean;
  message: string;
}

const initialFormData: FormData = {
  name: '',
  phone: '',
  house: '',
  area: '',
  landmark: '',
  pincode: '',
  city: '',
  state: '',
  admin_district: '',
  label: 'HOME',
  isDefault: false,
};

const AddAddressScreen: React.FC = () => {
  const navigation = useNavigation<ProfileNavigationProp>();
  const route = useRoute<RouteProp<ProfileStackParamList, 'AddAddress'>>();
  const editingAddress = route.params?.addressId ? { _id: route.params.addressId } as any : null;

  const { data: addressData } = useGetAddressesQuery();
  const addresses = addressData?.addresses || [];
  const defaultAddressId = addressData?.defaultAddressId || null;
  const [addAddress, { isLoading: isAdding }] = useAddAddressMutation();
  const [updateAddress, { isLoading: isUpdating }] = useUpdateAddressMutation();
  const [checkPincode] = useLazyCheckPincodeQuery();

  const [formData, setFormData] = useState<FormData>(initialFormData);
  
  const isDefaultAddress = useCallback((address: any): boolean => {
    const id = address?._id || address?.id || '';
    if (defaultAddressId) {
      return String(id).trim() === String(defaultAddressId).trim();
    }
    return !!address?.isDefault;
  }, [defaultAddressId]);

  const [pincodeStatus, setPincodeStatus] = useState<PincodeStatus>({
    isChecking: false,
    isResolved: false,
    isDeliverable: false,
    message: '',
  });
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [validationSource, setValidationSource] = useState<"manual" | "gps" | null>(null);

  const [showMap, setShowMap] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 20.5937,
    longitude: 78.9629,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [isDetecting, setIsDetecting] = useState(false);
  const [showAreaHint, setShowAreaHint] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const houseRef = useRef<TextInput>(null);
  const areaRef = useRef<TextInput>(null);
  const landmarkRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const isFetchingRef = useRef(false);
  const buttonScale = useRef(new Animated.Value(1)).current;
  const geocodeCache = useRef<Map<string, any>>(new Map());

  const isLoading = isAdding || isUpdating;

  // Clean location names by removing postal suffixes
  const cleanLocationName = (name: string): string => {
    if (!name) return '';
    return name
      .replace(/\b(S\s?O|B\s?O|H\s?O)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Validate area text to avoid vague location terms
  const isValidArea = (text: string): boolean => {
    if (!text) return false;
    
    // Reject vague directional terms
    const invalidWords = ['near', 'opp', 'opposite', 'beside', 'behind', 'next to'];
    
    return !invalidWords.some(word =>
      text.toLowerCase().includes(word)
    );
  };

  // Validate if text is likely a locality/street name
  const isLikelyLocality = (text: string): boolean => {
    if (!text) return false;
    
    const keywords = [
      'nagar', 'colony', 'layout', 'road', 'street',
      'avenue', 'lane', 'gali', 'marg', 'peta', 'wadi'
    ];
    
    return keywords.some(k => text.toLowerCase().includes(k));
  };

  // Check if coordinates are within India bounds
  const isInIndia = (lat: number, lng: number): boolean => {
    return lat >= 8 && lat <= 37 && lng >= 68 && lng <= 97;
  };

  // 🔒 SAFETY: Validate coordinates before using in map
  const sanitizeCoordinate = (coord: { latitude: number; longitude: number; latitudeDelta?: number; longitudeDelta?: number }) => {
    const lat = Number(coord.latitude);
    const lng = Number(coord.longitude);
    
    if (
      isNaN(lat) || isNaN(lng) ||
      !isFinite(lat) || !isFinite(lng) ||
      lat < -90 || lat > 90 ||
      lng < -180 || lng > 180
    ) {
      console.warn('[AddAddress] Invalid coordinate:', coord);
      return {
        latitude: 20.5937,
        longitude: 78.9629,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    
    return {
      latitude: lat,
      longitude: lng,
      latitudeDelta: coord.latitudeDelta || 0.01,
      longitudeDelta: coord.longitudeDelta || 0.01,
    };
  };

  // Use current location
  const handleUseCurrentLocation = async () => {
    console.log("📍 CLICK: Use Current Location", { time: Date.now() });
    
    // STEP 0: Lock scroll position BEFORE any state changes
    const currentOffset = scrollY.current;
    
    // 🔒 CRITICAL FIX 2: Prevent duplicate reverse geocode calls
    if (isFetchingRef.current) {
      console.log("🔒 ALREADY FETCHING - SKIPPING DUPLICATE CALL");
      return;
    }
    isFetchingRef.current = true;
    
    setIsDetecting(true);
    try {
      // STEP 1: Request permission
      console.log("🔐 REQUESTING LOCATION PERMISSION", { time: Date.now() });
      let { status, granted, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      console.log("🔐 LOCATION PERMISSION RESULT", {
        status,
        granted,
        canAskAgain,
        time: Date.now()
      });
      
      if (status !== 'granted') {
        console.error("❌ Permission denied - stopping flow", { status, granted, canAskAgain });
        Alert.alert('Permission Denied', 'Please enable location permissions in settings');
        setIsDetecting(false);
        return;
      }

      // STEP 2: Get GPS location with timeout wrapper
      console.log("📡 FETCHING GPS LOCATION", { time: Date.now() });
      
      const getLocationWithTimeout = async (timeoutMs: number = 30000) => {
        return Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('GPS timeout')), timeoutMs)
          )
        ]);
      };
      
      let location = await getLocationWithTimeout(30000) as Location.LocationObject;
      
      console.log("📡 GPS LOCATION SUCCESS", {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy: location.coords.accuracy,
        time: Date.now()
      });
      
      // STEP 2.1: Check GPS accuracy
      if (location.coords.accuracy && location.coords.accuracy > 100) {
        console.warn("⚠️ Low GPS Accuracy", location.coords.accuracy);
        
        Alert.alert(
          "Low Location Accuracy",
          `Your location accuracy is ~${Math.round(location.coords.accuracy)} meters.\nAddress may not be precise.`,
          [{ text: "Continue" }]
        );
      }
      
      // STEP 2.2: Validate India bounds
      if (!isInIndia(location.coords.latitude, location.coords.longitude)) {
        Alert.alert(
          "Invalid Location",
          "We currently support addresses only within India."
        );
        setIsDetecting(false);
        isFetchingRef.current = false;
        return;
      }
      
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      
      const safeCoords = sanitizeCoordinate({
        ...coords,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
      
      console.log("🗺️ SETTING MAP REGION", { safeCoords, time: Date.now() });
      setMapRegion(safeCoords);
      setShowMap(true);

      // STEP 3: Reverse geocode to get pincode and address (with timeout)
      console.log("🏠 STARTING REVERSE GEOCODING", { coords, time: Date.now() });
      
      // Check cache first
      const cacheKey = `${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}`;
      
      // Add timeout to prevent hanging
      const reverseGeocodeWithTimeout = async (coords: any, timeoutMs: number = 10000) => {
        return Promise.race([
          Location.reverseGeocodeAsync(coords),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Reverse geocoding timeout')), timeoutMs)
          )
        ]);
      };
      
      try {
        const addresses = await reverseGeocodeWithTimeout(coords, 10000) as any[];
        
        // Cache the result
        geocodeCache.current.set(cacheKey, addresses);
        
        const address = addresses?.[0];
        
        // STEP 3.1: Log full raw response
        console.log("📦 FULL REVERSE GEOCODE RESPONSE", JSON.stringify(addresses, null, 2));
        
        console.log("🏠 REVERSE GEOCODE RESULT", { 
          address: address ? {
            postalCode: address.postalCode,
            city: address.city,
            district: address.district,
            region: address.region,
            subregion: address.subregion,
            name: address.name,
            street: address.street
          } : null,
          time: Date.now()
        });
        
        // STEP 3.2: Log all available fields
        console.log("📍 GEOCODE FIELDS", {
          name: address?.name,
          street: address?.street,
          subregion: address?.subregion,
          district: address?.district,
          city: address?.city,
          region: address?.region,
          postalCode: address?.postalCode,
        });
        
        if (address) {
          // STEP 3.3: Trace area mapping logic
          console.log("🧠 AREA MAPPING INPUT", {
            street: address.street,
            subregion: address.subregion,
            district: address.district,
            name: address.name,
            formattedAddress: address.formattedAddress
          });
          
          // 🚀 CRITICAL FIX 1: Smart area parsing from formattedAddress
          let extractedArea = '';
          if (address.formattedAddress) {
            // STEP 1: Split address into parts
            const parts = address.formattedAddress.split(',').map((p: string) => p.trim());
            console.log("📝 FORMATTED ADDRESS PARTS", { parts });
            
            // STEP 2: Remove house number part (address.name)
            const filtered = parts.filter(part => part !== address.name);
            
            // STEP 3: Remove city/state/pincode parts
            const cleanParts = filtered.filter(part =>
              part !== address.city &&
              part !== address.region &&
              !part.includes(address.postalCode || '')
            );
            
            console.log("🧹 CLEANED PARTS", { cleanParts });
            
            // STEP 4: Pick best area candidate (locality validation)
            extractedArea = 
              cleanParts.find(part => isValidArea(part) && isLikelyLocality(part)) ||
              cleanParts.find(isValidArea) ||
              cleanParts[0] ||
              '';
          }
          
          // STEP 5: Fallback chain if formattedAddress parsing failed
          const mappedArea = extractedArea || address.street || address.subregion || address.district || '';
          
          // Determine which source was used for area
          const areaSource = extractedArea ? 'formattedAddress' : 
                            address.street ? 'street' : 
                            address.subregion ? 'subregion' : 
                            address.district ? 'district' : 'none';
          
          const usedFallback = areaSource !== 'formattedAddress';
          
          console.log("✅ FINAL AREA VALUE", { mappedArea, isEmpty: !mappedArea, source: areaSource, usedFallback });
          console.log("🔄 AREA FALLBACK USED", {
            used: areaSource,
            value: mappedArea
          });
          
          const newFormData = {
            pincode: address.postalCode || formData.pincode,
            city: address.city || address.district || formData.city,
            state: address.region || formData.state,
            admin_district: address.subregion || formData.admin_district,
            area: mappedArea,
            house: address.name || '',
          };
          
          // 🎯 POLISH 1: Show inline hint if fallback was used (non-intrusive)
          if (usedFallback && mappedArea) {
            setShowAreaHint(true);
          }
          
          console.log("🧠 UPDATING FORM DATA", { 
            before: formData,
            after: newFormData,
            time: Date.now()
          });
          
          // Smooth transition: delay form update slightly
          setTimeout(() => {
            setFormData(prev => ({
              ...prev,
              ...newFormData
            }));
            
            // CRITICAL: Restore scroll position after state update
            setTimeout(() => {
              scrollRef.current?.scrollTo({
                y: currentOffset,
                animated: false,
              });
            }, 50);
          }, 120);
          
          // STEP 3.4: Verify form update
          console.log("🧾 FORM DATA AFTER UPDATE", {
            house: newFormData.house,
            area: newFormData.area,
            city: newFormData.city,
            state: newFormData.state,
            pincode: newFormData.pincode
          });
          
          // STEP 4: Validate GPS-detected pincode via API (required for submit)
          // Mark as GPS source to prevent redundant validation if user doesn't edit
          if (address.postalCode) {
            console.log("🌐 VALIDATING GPS PINCODE VIA API", { pincode: address.postalCode, time: Date.now() });
            // Mark validation source as GPS
            setValidationSource("gps");
            setTimeout(() => {
              validatePincode(address.postalCode);
            }, 150);
          } else {
            console.warn("⚠️ No postal code in geocode result");
          }
          
          // Auto-focus house field after GPS detection with controlled scroll
          setTimeout(() => {
            houseRef.current?.focus();
          }, 400);
        } else {
          console.error("❌ No address returned from reverse geocoding");
        }
      } catch (geocodeError) {
        console.error("❌ REVERSE GEOCODING FAILED", {
          error: geocodeError,
          message: geocodeError instanceof Error ? geocodeError.message : String(geocodeError),
          coords,
          time: Date.now()
        });
        
        // Still show map even if geocoding fails
        setShowMap(true);
        
        // Continue anyway - user can manually enter address
        Alert.alert(
          'Location Detected',
          'We could not fetch address details. Please enter manually.',
          [{ text: 'OK' }]
        );
      }
      
      console.log("✅ USE CURRENT LOCATION COMPLETED", { time: Date.now() });
    } catch (e) {
      console.error("❌ USE CURRENT LOCATION FAILED", {
        error: e,
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
        time: Date.now()
      });
      Alert.alert('Error', 'Could not detect your location');
    } finally {
      console.log("🎯 SETTING isDetecting = false", { time: Date.now() });
      setIsDetecting(false);
      // 🔒 Release lock
      isFetchingRef.current = false;
    }
  };

  const handleMapSelect = async (coords: { latitude: number; longitude: number }) => {
    const safeCoords = sanitizeCoordinate({ ...mapRegion, ...coords });
    setMapRegion(safeCoords);
    
    try {
      const [address] = await Location.reverseGeocodeAsync(coords);
      if (address) {
        setFormData(prev => ({
          ...prev,
          pincode: address.postalCode || prev.pincode,
          city: address.city || address.district || prev.city,
          state: address.region || prev.state,
          admin_district: address.subregion || prev.admin_district,
          area: `${address.street || ''} ${address.subregion || ''}`.trim(),
          house: address.name || '',
        }));
        if (address.postalCode) validatePincode(address.postalCode);
      }
    } catch (e) {
    }
  };

  // Validate pincode when it reaches 6 digits
  const validatePincode = useCallback(async (pincode: string) => {
    console.log("🌐 VALIDATE PINCODE CALLED", { pincode, time: Date.now() });
    
    const cleaned = pincode.replace(/\D/g, '');
    if (cleaned.length !== 6) {
      console.log("⚠️ Pincode not 6 digits, skipping validation", { cleaned, length: cleaned.length });
      setPincodeStatus({
        isChecking: false,
        isResolved: false,
        isDeliverable: false,
        message: '',
      });
      return;
    }

    // 🔒 Immediately mark as checking (prevents race condition submit)
    console.log("🌐 PINCODE API REQUEST STARTING", { pincode: cleaned, time: Date.now() });
    
    // 📊 PRODUCTION MONITORING LOG
    console.log("PINCODE_VALIDATION", {
      source: validationSource,
      pincode: cleaned,
      timestamp: Date.now(),
    });
    
    setPincodeStatus({
      isChecking: true,
      isResolved: false,
      isDeliverable: false,
      message: 'Checking pincode...',
    });

    try {
      const result = await checkPincode(cleaned).unwrap();
      
      console.log("✅ PINCODE API RESPONSE", { result });
      
      // 📊 PRODUCTION MONITORING LOG
      console.log("PINCODE_VALIDATION", {
        source: validationSource,
        pincode: cleaned,
        deliverable: result?.deliverable === true,
        state: result?.state,
        timestamp: Date.now(),
        success: true,
      });
      
      const isDeliverable = result?.deliverable === true;
      
      // ✅ ONLY update location data when deliverable
      if (isDeliverable && result.state) {
        console.log("✅ Pincode is deliverable", { state: result.state, cities: result.cities });
        
        setFormData(prev => ({
          ...prev,
          state: result.state || prev.state,
          admin_district:
            result.admin_district ||
            result.postal_district ||
            prev.admin_district,
          city:
            (result.cities && result.cities.length > 0
              ? result.cities[0]
              : prev.city) || prev.city,
        }));
        setAvailableCities(result.cities || []);
      } else {
        // ❗ DO NOT TOUCH EXISTING GPS DATA
        console.warn("⚠️ Not deliverable - preserving GPS data");
        setAvailableCities([]);
      }
      
      setPincodeStatus({
        isChecking: false,
        isResolved: true, // API responded
        isDeliverable: isDeliverable,
        message: isDeliverable
          ? '✓ Deliverable'
          : '✗ We do not deliver to this pincode',
      });
    } catch (error) {
      console.error("❌ PINCODE API FAILED", {
        error,
        message: error instanceof Error ? error.message : String(error),
        pincode: cleaned,
        time: Date.now()
      });
      
      // 📊 PRODUCTION MONITORING LOG
      console.log("PINCODE_VALIDATION", {
        source: validationSource,
        pincode: cleaned,
        deliverable: false,
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      
      // ❗ DO NOT MODIFY FORM DATA
      setPincodeStatus({
        isChecking: false,
        isResolved: false, // treat as unresolved
        isDeliverable: false,
        message: 'Unable to verify pincode. Please try again.',
      });
      setAvailableCities([]);
    }
  }, [checkPincode, validationSource]);

  // 📝 Pre-fill data for editing
  useEffect(() => {
    if (route.params?.addressId && addresses.length > 0) {
      const addressToEdit = addresses.find(
        (addr: any) => (addr._id || addr.id) === route.params.addressId
      );
      
      if (addressToEdit) {
        // Parse addressLine back into house, area, and landmark if possible
        const addressLine = (addressToEdit as any).addressLine || (addressToEdit as any).line1 || '';
        const parts = addressLine ? addressLine.split(', ') : [];
        
        setFormData({
          name: addressToEdit.name || '',
          phone: addressToEdit.phone || '',
          house: parts[0] || '',
          area: parts[1] || '',
          landmark: parts[2] || '',
          pincode: addressToEdit.pincode || '',
          city: addressToEdit.city || '',
          state: addressToEdit.state || '',
          admin_district: (addressToEdit as any).admin_district || '',
          label: (addressToEdit.label as LabelType) || 'HOME',
          isDefault: isDefaultAddress(addressToEdit),
        });
        
        // Trigger pincode validation if it exists
        if (addressToEdit.pincode && addressToEdit.pincode.length === 6) {
          validatePincode(addressToEdit.pincode);
        }
      }
    }
  }, [route.params?.addressId, addresses, isDefaultAddress, validatePincode]);

  // Debounced pincode validation (only for manual entry)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Only validate if user manually entered pincode (not from GPS)
      if (formData.pincode.length === 6 && validationSource === "manual") {
        validatePincode(formData.pincode);
      }
    }, 500); // Match web debounce timing

    return () => clearTimeout(timer);
  }, [formData.pincode, validatePincode, validationSource]);

  const handlePincodeChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 6);
    
    // Mark validation source as manual when user types
    setValidationSource("manual");
    
    // If pincode is changing, reset dependent fields and status
    if (cleaned !== formData.pincode) {
      setFormData(prev => ({ 
        ...prev, 
        pincode: cleaned,
        city: cleaned.length === 6 ? prev.city : '',
        state: cleaned.length === 6 ? prev.state : '',
        admin_district: cleaned.length === 6 ? prev.admin_district : '',
      }));
      
      setAvailableCities([]);
      
      if (cleaned.length === 6) {
        setPincodeStatus({
          isChecking: true,
          isResolved: false,
          isDeliverable: false,
          message: 'Checking pincode...',
        });
      } else {
        setPincodeStatus({
          isChecking: false,
          isResolved: false,
          isDeliverable: false,
          message: '',
        });
      }
    }
  };

  const handlePhoneChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 10);
    setFormData(prev => ({ ...prev, phone: cleaned }));
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Name validation
    if (!formData.name || formData.name.trim() === '') {
      errors.name = 'Please enter name';
    }

    // Phone validation
    if (!formData.phone || !/^[6-9][0-9]{9}$/.test(formData.phone)) {
      errors.phone = 'Enter valid 10-digit mobile number';
    }

    // House number validation
    if (!formData.house || formData.house.trim() === '') {
      errors.house = 'Please enter house/flat/building';
    }

    // Area validation
    if (!formData.area || formData.area.trim() === '') {
      errors.area = 'Please enter area/street/village';
    }

    // Pincode validation
    if (!formData.pincode || formData.pincode.length !== 6 || !/^\d{6}$/.test(formData.pincode)) {
      errors.pincode = 'Enter valid 6-digit pincode';
    }

    // 🔒 STRICT PINCODE VALIDATION (match web)
    if (!pincodeStatus.isResolved) {
      errors.pincode = 'Please wait for pincode validation';
    } else if (!pincodeStatus.isDeliverable) {
      errors.pincode = 'We do not deliver to this pincode';
    }

    // City validation
    if (!formData.city || formData.city.trim() === '') {
      errors.city = 'Please enter city/town';
    }

    // State validation
    if (!formData.state || formData.state.trim() === '') {
      errors.state = 'State is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    // Button press animation
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.97,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Combine house, area, and landmark into full address
    const addressParts = [
      formData.house,
      formData.area,
      formData.landmark
    ].filter(Boolean);
    const fullAddress = addressParts.join(', ').trim();

    const payload: any = {
      name: formData.name.trim(),
      label: formData.label,
      pincode: formData.pincode,
      city: formData.city.trim(),
      state: formData.state,
      addressLine: fullAddress,
      phone: formData.phone,
      isDefault: formData.isDefault || addresses.length === 0,
    };

    try {
      if ((editingAddress as any)?._id) {
        const result = await updateAddress({ _id: (editingAddress as any)._id, ...payload }).unwrap();
        Alert.alert('Success', 'Address updated successfully');
      } else {
        const result = await addAddress(payload).unwrap();
        Alert.alert('Success', 'Address added successfully');
      }
      // Small delay to allow cache invalidation to complete
      setTimeout(() => {
        navigation.goBack();
      }, 500);
    } catch (error: any) {
      Alert.alert('Error', error?.data?.message || 'Failed to save address');
    }
  };

  // 📝 Pre-fill data for editing
  useEffect(() => {
    if (route.params?.addressId && addresses.length > 0) {
      const addressToEdit = addresses.find(
        (addr: any) => (addr._id || addr.id) === route.params.addressId
      );
      
      if (addressToEdit) {
        // Parse addressLine back into house, area, and landmark if possible
        const addressLine = (addressToEdit as any).addressLine || (addressToEdit as any).line1 || '';
        const parts = addressLine ? addressLine.split(', ') : [];
        
        setFormData({
          name: addressToEdit.name || '',
          phone: addressToEdit.phone || '',
          house: parts[0] || '',
          area: parts[1] || '',
          landmark: parts[2] || '',
          pincode: addressToEdit.pincode || '',
          city: addressToEdit.city || '',
          state: addressToEdit.state || '',
          admin_district: (addressToEdit as any).admin_district || '',
          label: (addressToEdit.label as LabelType) || 'HOME',
          isDefault: isDefaultAddress(addressToEdit),
        });
        
        // Trigger pincode validation if it exists
        if (addressToEdit.pincode && addressToEdit.pincode.length === 6) {
          validatePincode(addressToEdit.pincode);
        }
      }
    }
  }, [route.params?.addressId, addresses, isDefaultAddress, validatePincode]);

  const labelOptions: { value: LabelType; label: string }[] = [
    { value: 'HOME', label: 'Home' },
    { value: 'SHOP', label: 'Shop' },
    { value: 'OTHER', label: 'Other' },
  ];

  // RENDER TRACE
  console.log("🎯 RENDER AddAddressScreen", {
    isDetecting,
    showMap,
    pincodeStatus,
    formData: {
      pincode: formData.pincode,
      city: formData.city,
      state: formData.state,
      house: formData.house,
      area: formData.area
    },
    time: Date.now()
  });

  return (
    <View style={styles.container}>
      <ScreenHeader title={editingAddress ? 'Edit Address' : 'Add New Address'} showBackButton />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        style={styles.container}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={(e) => {
            scrollY.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          {/* Add a Spacer to push content down if the screen is tall */}
          <View style={{ flex: 1, minHeight: 20 }} />

          {/* Current Location Button - Now at the Top */}
          <View style={styles.locationContainer}>
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedBadgeText}>Recommended</Text>
            </View>
            <TouchableOpacity
              style={styles.locationBtn}
              onPress={handleUseCurrentLocation}
              disabled={isDetecting}
              activeOpacity={0.7}
            >
              {isDetecting ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Ionicons name="navigate-circle-outline" size={22} color={Colors.primary} />
              )}
              <Text style={styles.locationBtnTxt}>
                {isDetecting ? 'Detecting location...' : 'Use current location'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.locationHelperText}>
              Using your current location helps delivery partners reach you faster
            </Text>
          </View>

          {/* Pincode */}
          <View style={styles.field}>
            <Text style={styles.label}>Pincode *</Text>
            <TextInput
              style={[
                styles.input,
                validationErrors.pincode && styles.inputError,
              ]}
              value={formData.pincode}
              onChangeText={(text) => {
                handlePincodeChange(text);
                if (validationErrors.pincode) {
                  setValidationErrors(prev => ({ ...prev, pincode: '' }));
                }
              }}
              onFocus={() => {
                scrollRef.current?.scrollTo({ y: 150, animated: true });
              }}
              placeholder="000000"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={6}
            />
            {validationErrors.pincode && (
              <Text style={styles.errorText}>{validationErrors.pincode}</Text>
            )}
            {(pincodeStatus.isResolved || pincodeStatus.isChecking) && !validationErrors.pincode && (
              <Text style={[
                styles.pincodeStatusText, 
                pincodeStatus.isChecking ? { color: Colors.primary } :
                pincodeStatus.isDeliverable ? styles.pincodeDeliverable : styles.pincodeNotDeliverable
              ]}>
                {pincodeStatus.isChecking ? 'Checking pincode...' :
                 pincodeStatus.isDeliverable ? 'Deliverable to this pincode' : 'Not deliverable to this pincode'}
              </Text>
            )}
          </View>

          {/* City */}
          <View style={styles.field}>
            <Text style={styles.label}>City *</Text>
            <View style={styles.cityRow}>
              <TextInput
                style={[
                  styles.input, 
                  styles.cityInput,
                  validationErrors.city && styles.inputError,
                ]}
                value={cleanLocationName(formData.city)}
                onChangeText={(text) => {
                  setFormData(prev => ({ ...prev, city: text }));
                  if (validationErrors.city) {
                    setValidationErrors(prev => ({ ...prev, city: '' }));
                  }
                }}
                onFocus={() => {
                  scrollRef.current?.scrollTo({ y: 250, animated: true });
                }}
                placeholder="City"
                placeholderTextColor="#9CA3AF"
              />
              {pincodeStatus.isChecking && (
                <ActivityIndicator size="small" color={Colors.primary} style={styles.cityIcon} />
              )}
              {pincodeStatus.isResolved && pincodeStatus.isDeliverable && (
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} style={styles.cityIcon} />
              )}
              {pincodeStatus.isResolved && !pincodeStatus.isDeliverable && (
                <Ionicons name="close-circle" size={18} color={Colors.error} style={styles.cityIcon} />
              )}
            </View>
            {validationErrors.city && (
              <Text style={styles.errorText}>{validationErrors.city}</Text>
            )}
          </View>

          {/* City Suggestions */}
          {availableCities.length > 0 && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.chipsContainer}
              contentContainerStyle={styles.chipsContent}
            >
              {availableCities.slice(0, 3).map((city, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.chip}
                  onPress={() => setFormData(prev => ({ ...prev, city }))}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipText}>{cleanLocationName(city)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* State */}
          <View style={styles.field}>
            <Text style={styles.label}>State *</Text>
            <TextInput
              style={[
                styles.input,
                validationErrors.state && styles.inputError,
              ]}
              value={formData.state}
              onChangeText={(text) => {
                setFormData(prev => ({ ...prev, state: text }));
                if (validationErrors.state) {
                  setValidationErrors(prev => ({ ...prev, state: '' }));
                }
              }}
              onFocus={() => {
                scrollRef.current?.scrollTo({ y: 350, animated: true });
              }}
              placeholder="State"
              placeholderTextColor="#9CA3AF"
            />
            {validationErrors.state && (
              <Text style={styles.errorText}>{validationErrors.state}</Text>
            )}
          </View>

          {/* House/Flat/Building - PRIMARY FIELD */}
          <View style={styles.fieldPrimary}>
            <Text style={styles.labelPrimary}>House / Flat / Building *</Text>
            <TextInput
              ref={houseRef}
              style={[
                styles.inputPrimary,
                validationErrors.house && styles.inputError,
              ]}
              value={formData.house}
              onChangeText={(text) => {
                setFormData(prev => ({ ...prev, house: text }));
                if (validationErrors.house) {
                  setValidationErrors(prev => ({ ...prev, house: '' }));
                }
              }}
              onFocus={() => {
                scrollRef.current?.scrollTo({ y: 450, animated: true });
              }}
              placeholder="House / Flat / Building"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
            />
            {validationErrors.house && (
              <Text style={styles.errorText}>{validationErrors.house}</Text>
            )}
          </View>

          {/* Area/Street/Village */}
          <View style={styles.field}>
            <Text style={styles.label}>Area / Street / Village *</Text>
            <TextInput
              ref={areaRef}
              style={[
                styles.input,
                validationErrors.area && styles.inputError,
              ]}
              value={formData.area}
              onChangeText={(text) => {
                setFormData(prev => ({ ...prev, area: text }));
                if (showAreaHint) setShowAreaHint(false);
                if (validationErrors.area) {
                  setValidationErrors(prev => ({ ...prev, area: '' }));
                }
              }}
              onFocus={() => {
                scrollRef.current?.scrollTo({ y: 550, animated: true });
              }}
              placeholder="Area / Street / Village"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
            />
            {showAreaHint && !validationErrors.area && (
              <Text style={styles.helperText}>
                Detected nearby area. Please verify.
              </Text>
            )}
            {validationErrors.area && (
              <Text style={styles.errorText}>{validationErrors.area}</Text>
            )}
          </View>

          {/* Landmark */}
          <View style={styles.field}>
            <Text style={styles.label}>Landmark (Optional)</Text>
            <TextInput
              ref={landmarkRef}
              style={styles.input}
              value={formData.landmark}
              onChangeText={(text) => setFormData(prev => ({ ...prev, landmark: text }))}
              onFocus={() => {
                scrollRef.current?.scrollTo({ y: 650, animated: true });
              }}
              placeholder="e.g. Near Apollo Hospital"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
            />
          </View>

          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              ref={nameRef}
              style={[
                styles.input,
                validationErrors.name && styles.inputError,
              ]}
              value={formData.name}
              onChangeText={(text) => {
                setFormData(prev => ({ ...prev, name: text }));
                if (validationErrors.name) {
                  setValidationErrors(prev => ({ ...prev, name: '' }));
                }
              }}
              onFocus={() => {
                scrollRef.current?.scrollTo({ y: 750, animated: true });
              }}
              placeholder="Full Name"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
            />
            {validationErrors.name && (
              <Text style={styles.errorText}>{validationErrors.name}</Text>
            )}
          </View>

          {/* Phone */}
          <View style={styles.field}>
            <Text style={styles.label}>Mobile Number *</Text>
            <TextInput
              ref={phoneRef}
              style={[
                styles.input,
                validationErrors.phone && styles.inputError,
              ]}
              value={formData.phone}
              onChangeText={(text) => {
                handlePhoneChange(text);
                if (validationErrors.phone) {
                  setValidationErrors(prev => ({ ...prev, phone: '' }));
                }
              }}
              onFocus={() => {
                scrollRef.current?.scrollTo({ y: 850, animated: true });
              }}
              placeholder="10-digit mobile"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={10}
            />
            {validationErrors.phone && (
              <Text style={styles.errorText}>{validationErrors.phone}</Text>
            )}
          </View>

          {/* Default Address Toggle */}
          <TouchableOpacity 
            style={styles.defaultToggle}
            onPress={() => setFormData(prev => ({ ...prev, isDefault: !prev.isDefault }))}
          >
            <View style={[styles.checkbox, formData.isDefault && styles.checkboxActive]}>
              {formData.isDefault && <Ionicons name="checkmark" size={16} color={Colors.white} />}
            </View>
            <Text style={styles.defaultToggleText}>Make this my default address</Text>
          </TouchableOpacity>

          {/* Label */}
          <View style={styles.field}>
            <Text style={styles.label}>Save Address As</Text>
            <View style={styles.labelContainer}>
              {labelOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.labelButton,
                    formData.label === option.value && styles.labelButtonActive,
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, label: option.value }))}
                >
                  <Text
                    style={[
                      styles.labelButtonText,
                      formData.label === option.value && styles.labelButtonTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

      {/* Sticky Submit Button */}
      <View style={styles.stickyFooter}>
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (isLoading || 
               !pincodeStatus.isResolved ||
               pincodeStatus.isChecking || 
               !pincodeStatus.isDeliverable ||
               !formData.name ||
               !formData.phone ||
               !formData.house || 
               !formData.area ||
               !formData.pincode ||
               !formData.city ||
               !formData.state) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isLoading || 
                      !pincodeStatus.isResolved ||
                      pincodeStatus.isChecking || 
                      !pincodeStatus.isDeliverable ||
                      !formData.name ||
                      !formData.phone ||
                      !formData.house || 
                      !formData.area ||
                      !formData.pincode ||
                      !formData.city ||
                      !formData.state}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {editingAddress ? 'Update Address' : 'Save Address'}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  </View>
);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 140,
  },
  locationContainer: {
    marginBottom: 24,
    position: 'relative',
    alignItems: 'center',
    width: '100%',
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFF0E5',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 12,
    minHeight: 52,
    width: '100%',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  locationBtnTxt: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 8,
  },
  locationHelperText: {
    fontSize: 12.5,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  recommendedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  defaultToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  defaultToggleText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  pincodeSuccessText: {
    fontSize: 13,
    color: Colors.success,
    fontWeight: '600',
    marginLeft: 6,
  },
  detectedAddressCard: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  detectedAddressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detectedAddressContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  detectedAddressTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  detectedAddressText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  editIconButton: {
    padding: 4,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  markerFixed: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -16,
    marginTop: -32,
  },
  closeMapBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 6,
    borderRadius: 20,
  },
  field: {
    marginBottom: 16,
  },
  fieldPrimary: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  labelPrimary: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  inputPrimary: {
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 18 : 16,
    fontSize: 18,
    fontWeight: '500',
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    minHeight: 60,
  },
  inputValid: {
    borderColor: Colors.success,
    borderWidth: 2,
  },
  inputInvalid: {
    borderColor: Colors.error,
    borderWidth: 2,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  pincodeCheckingText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginLeft: 6,
  },
  pincodeErrorText: {
    fontSize: 13,
    color: Colors.error,
    fontWeight: '600',
    marginLeft: 6,
  },
  helperText: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 6,
  },
  inputError: {
    borderColor: Colors.error,
    borderWidth: 1.5,
  },
  pincodeStatus: {
    fontSize: 12,
    marginTop: 4,
  },
  pincodeValid: {
    color: Colors.success,
  },
  pincodeStatusText: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  pincodeDeliverable: {
    color: Colors.success,
  },
  pincodeNotDeliverable: {
    color: Colors.error,
  },
  loader: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
  },
  halfField: {
    flex: 1,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cityInput: {
    flex: 1,
  },
  cityIcon: {
    marginLeft: 8,
  },
  chipsContainer: {
    marginBottom: 16,
  },
  chipsContent: {
    paddingRight: 16,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  chipText: {
    fontSize: 14,
    color: '#374151',
  },
  labelContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  labelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  labelButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  labelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  labelButtonTextActive: {
    color: '#FFFFFF',
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 12,
    backgroundColor: Colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default AddAddressScreen;
