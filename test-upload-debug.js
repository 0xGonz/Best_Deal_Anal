import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

async function testUpload() {
  try {
    console.log('Creating test file...');
    const testContent = 'This is a test document for upload verification.';
    fs.writeFileSync('/tmp/test-doc.txt', testContent);
    
    console.log('Logging in...');
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'Gonz',
        password: 'password123'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('Login successful, got cookies:', cookies);
    
    console.log('Preparing upload...');
    const form = new FormData();
    form.append('file', fs.createReadStream('/tmp/test-doc.txt'));
    form.append('dealId', '138');
    form.append('documentType', 'other');
    
    console.log('Starting upload...');
    const uploadResponse = await fetch('http://localhost:5000/api/documents/upload', {
      method: 'POST',
      body: form,
      headers: {
        'Cookie': cookies
      }
    });
    
    console.log('Upload response status:', uploadResponse.status);
    const responseText = await uploadResponse.text();
    console.log('Upload response:', responseText);
    
    if (uploadResponse.ok) {
      console.log('✅ Upload successful!');
    } else {
      console.log('❌ Upload failed');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testUpload();