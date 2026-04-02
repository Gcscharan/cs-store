import React, { useEffect, useRef } from 'react'; 
import { Animated, Text, StyleSheet, View } from 'react-native'; 
import { useDispatch, useSelector } from 'react-redux'; 
import { hideToast } from '../../store/slices/uiSlice'; 
import { RootState } from '../../store';

export const Toast = () => { 
  const { visible, message } = useSelector((state: RootState) => state.ui.toast); 
  const dispatch = useDispatch(); 
 
  const translateY = useRef(new Animated.Value(100)).current; 
  const opacity = useRef(new Animated.Value(0)).current;
 
  useEffect(() => { 
    if (visible) { 
      // Entrance animation
      Animated.parallel([
        Animated.timing(translateY, { 
          toValue: 0, 
          duration: 400, 
          useNativeDriver: true, 
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        })
      ]).start(); 
 
      // Auto-hide after 2.5 seconds
      const timer = setTimeout(() => { 
        Animated.parallel([
          Animated.timing(translateY, { 
            toValue: 100, 
            duration: 400, 
            useNativeDriver: true, 
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          })
        ]).start(() => dispatch(hideToast())); 
      }, 2500);

      return () => clearTimeout(timer);
    } 
  }, [visible, dispatch, translateY, opacity]); 
 
  if (!visible) return null; 
 
  return ( 
    <Animated.View 
      style={[ 
        styles.toast, 
        { 
          transform: [{ translateY }],
          opacity: opacity,
        }, 
      ]} 
    > 
      <View style={styles.content}>
        <Text style={styles.text}>✅ {message}</Text> 
      </View>
    </Animated.View> 
  ); 
}; 
 
const styles = StyleSheet.create({ 
  toast: { 
    position: 'absolute', 
    bottom: 50, 
    left: 20, 
    right: 20, 
    zIndex: 9999, 
    alignItems: 'center',
  }, 
  content: {
    backgroundColor: '#323232', 
    paddingHorizontal: 20,
    paddingVertical: 14, 
    borderRadius: 25, 
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  text: { 
    color: '#fff', 
    fontWeight: '600', 
    fontSize: 14,
  }, 
}); 
