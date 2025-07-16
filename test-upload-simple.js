const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testUpload() {
  const form = new FormData();
  form.append('file', fs.createReadStream('test-real.pdf'));
  form.append('dealId', '1');
  form.append('documentType', 'other');
  form.append('description', 'Test upload');

  try {
    const response = await fetch('http://0.0.0.0:5000/api/documents/upload', {
      method: 'POST',
      body: form,
      headers: {
        'Cookie': 'dlf.sid=s%3AAWb9FIt6wmUh-eYiriy9zIDJwDbWuR5T.o0HuUJlliw%2BDlaJdGJmf8VFfWDw9CbjO37pxfA1f2%2FE',
        ...form.getHeaders()
      }
    });

    console.log('Status:', response.status);
    console.log('Headers:', response.headers.raw());
    const text = await response.text();
    console.log('Response:', text);
  } catch (error) {
    console.error('Error:', error);
  }
}

testUpload();