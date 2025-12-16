const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testEndpoint(method, url, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        ...headers
      }
    };

    // Only add Content-Type and data for non-GET requests
    if (method.toLowerCase() !== 'get' && data) {
      config.headers['Content-Type'] = 'application/json';
      config.data = data;
    }

    if (data) {
      console.log(`Sending ${method.toUpperCase()} ${url} with data:`, JSON.stringify(data));
    } else {
      console.log(`Sending ${method.toUpperCase()} ${url}`);
    }

    const response = await axios(config);
    console.log(`✅ ${method.toUpperCase()} ${url} - Status: ${response.status}`);
    return response.data;
  } catch (error) {
    console.log(`❌ ${method.toUpperCase()} ${url} - Status: ${error.response?.status || 'Error'} - ${error.message}`);
    if (error.response?.data) {
      console.log('Error response:', error.response.data);
    }
    return null;
  }
}

async function testAuthEndpoints() {
  console.log('\n=== Testing Auth Endpoints ===');

  // Test school signup
  const schoolData = {
    name: 'Test School',
    contact: {
      email: 'testschool@example.com',
      phone: '1234567890'
    }
  };
  await testEndpoint('post', '/auth/school/signup', schoolData);

  // Test member signup
  const memberData = {
    name: 'Test Member',
    email: 'testmember@example.com',
    password: 'password123'
  };
  await testEndpoint('post', '/auth/member/signup', memberData);

  // Test school login (assuming signup worked)
  const schoolLoginData = {
    email: 'testschool@example.com'
  };
  const schoolLogin = await testEndpoint('post', '/auth/school/login', schoolLoginData);

  // Test member login
  const memberLoginData = {
    email: 'testmember@example.com',
    password: 'password123'
  };
  const memberLogin = await testEndpoint('post', '/auth/member/login', memberLoginData);

  return { schoolLogin, memberLogin };
}

async function testProtectedEndpoints(tokens) {
  console.log('\n=== Testing Protected Endpoints ===');

  const headers = tokens.school ? { Authorization: `Bearer ${tokens.school.token}` } : {};

  // Test schools endpoint
  await testEndpoint('get', '/schools', null, headers);

  // Test events endpoint
  await testEndpoint('get', '/events', null, headers);

  // Test products endpoint
  await testEndpoint('get', '/products', null, headers);
}

async function runTests() {
  console.log('Starting API endpoint tests...');

  const tokens = await testAuthEndpoints();
  await testProtectedEndpoints(tokens);

  console.log('\nTest completed.');
}

runTests().catch(console.error);
