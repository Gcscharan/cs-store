import React, { useState } from 'react';
import { Image, View, Text, StyleSheet, ImageStyle, ViewStyle } from 'react-native';

interface Props {
  uri?: string;
  style?: ImageStyle;
  fallbackEmoji?: string;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

export function SmartImage({ uri, style, fallbackEmoji = '🛒', resizeMode = 'cover' }: Props) {
  const [error, setError] = useState(false);

  if (!uri || error) {
    return (
      <View style={[styles.fallback, style as ViewStyle]}>
        <Text style={styles.emoji}>{fallbackEmoji}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode={resizeMode}
      onError={() => setError(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: '#f5f5f5',
    justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 32 },
});
