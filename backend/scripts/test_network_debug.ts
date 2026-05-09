
import axios from 'axios';

async function testSelf() {
  const ip = '192.168.1.2';
  const port = 5001;
  const url = `http://${ip}:${port}/api/health`;
  
  console.log(`Testing connection to ${url}...`);
  try {
    const res = await axios.get(url);
    console.log('Success:', res.data);
  } catch (err: any) {
    console.error('Failed:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
    }
  }
}

testSelf().catch(console.error);
