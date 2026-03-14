import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={s.container}>
          <Text style={s.emoji}>😕</Text>
          <Text style={s.title}>Something went wrong</Text>
          <Text style={s.msg}>{this.state.error?.message || 'An unexpected error occurred'}</Text>
          <TouchableOpacity style={s.btn}
            onPress={() => this.setState({ hasError: false })}>
            <Text style={s.btnTxt}>Try Again</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 32, backgroundColor: '#fff', gap: 16 },
  emoji: { fontSize: 64 },
  title: { fontSize: 22, fontWeight: '700', color: '#222' },
  msg: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },
  btn: { backgroundColor: '#E95C1E', paddingHorizontal: 32,
    paddingVertical: 14, borderRadius: 12, marginTop: 8 },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
