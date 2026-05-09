
import axios from 'axios';

async function testPost() {
  const ip = '192.168.1.2';
  const port = 5001;
  const url = `http://${ip}:${port}/api/auth/send-otp`;
  
  console.log(`Testing POST to ${url}...`);
  try {
    const res = await axios.post(url, { phone: '9391795162' });
    console.log('Success:', res.data);
  } catch (err: any) {
    console.error('Failed:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
    }
  }
}

testPost().catch(console.error);
