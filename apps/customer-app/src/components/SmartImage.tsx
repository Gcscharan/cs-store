import React from 'react';
import { Image, View, Text, StyleSheet, ImageProps } from 'react-native';

interface SmartImageProps extends Omit<ImageProps, 'source'> {
  uri?: string;
  fallbackEmoji?: string;
}

export const SmartImage: React.FC<SmartImageProps> = ({ uri, fallbackEmoji = '📦', style, ...props }) => {
  if (!uri) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.emoji}>{fallbackEmoji}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
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
