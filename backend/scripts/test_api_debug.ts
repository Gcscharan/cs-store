
import axios from 'axios';

async function testApi() {
  const baseUrl = 'http://localhost:5002/api';
  
  try {
    console.log('Testing GET /coupons/smart...');
    const couponsRes = await axios.get(`${baseUrl}/coupons/smart?cartTotal=1000`);
    console.log('GET /coupons/smart response:', couponsRes.status, couponsRes.data);
  } catch (error: any) {
    console.error('GET /coupons/smart failed:', error.response?.status, error.response?.data || error.message);
  }

  try {
    console.log('\nTesting POST /orders (without auth, expect 401)...');
    const ordersRes = await axios.post(`${baseUrl}/orders`, {
      paymentMethod: 'cod',
      idempotencyKey: 'test-key-' + Date.now()
    });
    console.log('POST /orders response:', ordersRes.status, ordersRes.data);
  } catch (error: any) {
    console.error('POST /orders failed:', error.response?.status, error.response?.data || error.message);
  }
}

testApi().catch(console.error);
