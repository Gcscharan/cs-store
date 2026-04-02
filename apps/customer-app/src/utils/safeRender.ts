import { Ionicons } from '@expo/vector-icons';

export const getSafeIcon = (state?: string): keyof typeof Ionicons.glyphMap => { 
  switch (state) { 
    case 'completed': 
      return 'checkmark-circle'; 
    case 'current': 
      return 'time'; 
    case 'failed': 
      return 'close-circle'; 
    default: 
      return 'ellipse-outline'; 
  } 
}; 

export const safeText = (val: any): string => 
  typeof val === 'string' ? val : ''; 

export const safeDate = (ts: any): Date | null => { 
  const d = new Date(ts); 
  return isNaN(d.getTime()) ? null : d; 
}; 
