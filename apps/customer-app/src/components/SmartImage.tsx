import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image, ImageProps } from 'expo-image';

interface SmartImageProps extends Omit<ImageProps, 'source'> {
  uri?: string;
  fallbackEmoji?: string;
}

// Helper to extract image URL from various possible formats
const extractImageUrl = (image: any): string | undefined => {
  if (!image) return undefined;
  
  // If it's already a string URL, return it
  if (typeof image === 'string') return image;
  
  // If it's an object with variants (Cloudinary structure)
  if (image.variants) {
    return image.variants.medium || 
           image.variants.small || 
           image.variants.thumb || 
           image.variants.original ||
           image.variants.large;
  }
  
  // If it has formats
  if (image.formats) {
    return image.formats.webp || 
           image.formats.jpg || 
           image.formats.avif;
  }
  
  // If it has a url property
  if (image.url) return image.url;
  
  // If it has publicId (construct Cloudinary URL)
  if (image.publicId) {
    return `https://res.cloudinary.com/dytgofbgw/image/upload/f_auto,q_auto/${image.publicId}`;
  }
  
  return undefined;
};

// Get base URL from environment
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// Helper to convert relative/localhost URLs to absolute URLs
const normalizeImageUrl = (uri: string): string => {
  // If already absolute URL, return as is
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    // Replace localhost with actual IP for device access
    if (uri.includes('localhost')) {
      // Extract IP from BASE_URL if available
      const baseUrlMatch = BASE_URL.match(/http:\/\/(\d+\.\d+\.\d+\.\d+)/);
      if (baseUrlMatch) {
        const ip = baseUrlMatch[1];
        return uri.replace('localhost', ip);
      }
    }
    return uri;
  }
  
  // If relative URL, prepend BASE_URL
  return `${BASE_URL}${uri.startsWith('/') ? '' : '/'}${uri}`;
};

export const SmartImage: React.FC<SmartImageProps> = ({ 
  uri, 
  fallbackEmoji = '📦', 
  style, 
  contentFit = 'cover',
  transition = 300,
  ...props 
}) => {
  // STEP 1: Extract URL from object if needed
  const extractedUrl = extractImageUrl(uri);
  
  // STEP 2: Validate it's a string
  const isValidUri = extractedUrl && typeof extractedUrl === 'string' && extractedUrl.trim().length > 0;
  
  if (!isValidUri) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.emoji}>{fallbackEmoji}</Text>
      </View>
    );
  }

  // STEP 3: Normalize the URL
  const finalUri = normalizeImageUrl(extractedUrl);

  return (
    <Image
      source={{ uri: finalUri }}
      style={style}
      contentFit={contentFit}
      transition={transition}
      cachePolicy="memory-disk"
      onError={(error) => {
        console.error('[SmartImage] Failed to load:', finalUri, error);
      }}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 32,
  },
});
