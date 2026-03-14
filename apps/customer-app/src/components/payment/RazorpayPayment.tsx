import React, { useState } from 'react';
import {
  Modal, View, ActivityIndicator, StyleSheet,
  TouchableOpacity, Text, SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  visible: boolean;
  amount: number; // in paise
  orderId: string;
  razorpayOrderId: string;
  keyId: string;
  name: string;
  email: string;
  phone: string;
  description?: string;
  onSuccess: (paymentId: string) => void;
  onFailure: (error: string) => void;
  onDismiss: () => void;
}

export function RazorpayPayment({
  visible, amount, orderId, razorpayOrderId, keyId,
  name, email, phone, description = 'VyaparSetu Order',
  onSuccess, onFailure, onDismiss,
}: Props) {
  const [loading, setLoading] = useState(true);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body style="margin:0;padding:0;background:#fff;">
  <script>
    var options = {
      key: "${keyId}",
      amount: ${amount},
      currency: "INR",
      name: "VyaparSetu",
      description: "${description}",
      order_id: "${razorpayOrderId}",
      prefill: {
        name: "${name}",
        email: "${email}",
        contact: "${phone}"
      },
      theme: { color: "#E95C1E" },
      modal: {
        ondismiss: function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'dismiss'
          }));
        }
      },
      handler: function(response) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'success',
          paymentId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id,
          signature: response.razorpay_signature
        }));
      }
    };
    var rzp = new Razorpay(options);
    rzp.on('payment.failed', function(response) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'failure',
        error: response.error.description
      }));
    });
    window.onload = function() { rzp.open(); }
  </script>
</body>
</html>`;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'success') onSuccess(data.paymentId);
      else if (data.type === 'failure') onFailure(data.error);
      else if (data.type === 'dismiss') onDismiss();
    } catch (e) {
      onFailure('Payment processing error');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Secure Payment</Text>
          <TouchableOpacity onPress={onDismiss} style={s.closeBtn}>
            <Text style={s.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>
        {loading && (
          <View style={s.loader}>
            <ActivityIndicator size="large" color="#E95C1E" />
            <Text style={s.loaderTxt}>Loading payment gateway...</Text>
          </View>
        )}
        <WebView
          source={{ html }}
          onMessage={handleMessage}
          onLoadEnd={() => setLoading(false)}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          style={loading ? { height: 0 } : { flex: 1 }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  title: { flex: 1, fontSize: 17, fontWeight: '700' },
  closeBtn: { padding: 8 },
  closeTxt: { fontSize: 20, color: '#666' },
  loader: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', gap: 12, zIndex: 10 },
  loaderTxt: { color: '#888', fontSize: 14 },
});
