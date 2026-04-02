import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '../../constants/colors';
import Constants from 'expo-constants';
import { BASE_URL } from '../../api/baseApi';

export default function NetworkDiagnostic() {
  const [results, setResults] = useState<string[]>([]);

  const addResult = (msg: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const testConnection = async () => {
    setResults([]);
    
    addResult(`📱 Device: ${Constants.isDevice ? 'Real Device' : 'Emulator'}`);
    addResult(`🌐 BASE_URL: ${BASE_URL}`);
    
    const testUrls = [
      BASE_URL.replace('/api', '/api/health'),
      'http://192.168.1.2:5001/api/health',
      'http://10.0.2.2:5001/api/health', // Android emulator
    ];

    for (const url of testUrls) {
      try {
        addResult(`Testing: ${url}`);
        const response = await fetch(url, { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        addResult(`✅ SUCCESS: ${url} - ${JSON.stringify(data)}`);
      } catch (error: any) {
        addResult(`❌ FAILED: ${url} - ${error.message}`);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Network Diagnostic</Text>
      
      <TouchableOpacity style={styles.button} onPress={testConnection}>
        <Text style={styles.buttonText}>Run Test</Text>
      </TouchableOpacity>

      <ScrollView style={styles.results}>
        {results.map((result, i) => (
          <Text key={i} style={styles.resultText}>{result}</Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: Colors.background },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 20 },
  button: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  results: { flex: 1 },
  resultText: { fontSize: 12, marginBottom: 8, fontFamily: 'monospace' },
});
