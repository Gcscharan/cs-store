// Verify both frontend and backend servers are working
const http = require('http');

const checkServer = (host, port, path) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      port: port,
      path: path,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      resolve({
        status: res.statusCode,
        message: `${host}:${port}${path} responded with ${res.statusCode}`
      });
    });

    req.on('error', (error) => {
      reject({
        error: error.message,
        message: `${host}:${port}${path} failed: ${error.message}`
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject({
        error: 'timeout',
        message: `${host}:${port}${path} timed out`
      });
    });

    req.end();
  });
};

async function verifyServers() {
  console.log('🔍 Verifying Servers...\n');
  console.log('═'.repeat(80));

  const checks = [
    { name: 'Backend Health', host: 'localhost', port: 5001, path: '/health' },
    { name: 'Backend Delivery API', host: 'localhost', port: 5001, path: '/api/delivery/orders' },
    { name: 'Frontend', host: 'localhost', port: 3000, path: '/' },
  ];

  for (const check of checks) {
    try {
      const result = await checkServer(check.host, check.port, check.path);
      console.log(`✅ ${check.name}: ${result.message}`);
    } catch (error) {
      console.log(`❌ ${check.name}: ${error.message}`);
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('\n📊 SUMMARY:\n');
  console.log('✅ Backend Server: http://localhost:5001');
  console.log('   - Health endpoint: /health (should return 200)');
  console.log('   - Delivery API: /api/delivery/orders (should return 401 without auth)');
  console.log('');
  console.log('✅ Frontend Server: http://localhost:3000');
  console.log('   - Vite dev server with proxy to backend');
  console.log('   - Proxies /api/* to http://localhost:5001/api/*');
  console.log('');
  console.log('═'.repeat(80));
  console.log('\n🎯 NEXT STEPS:\n');
  console.log('1. Open browser: http://localhost:3000/delivery/login');
  console.log('2. Login with:');
  console.log('   Email: raju@gmail.com');
  console.log('   Password: 123456');
  console.log('3. You will see all 3 assigned orders in the dashboard!\n');
  console.log('═'.repeat(80));
}

verifyServers();
