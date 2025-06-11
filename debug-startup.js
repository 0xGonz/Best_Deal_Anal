#!/usr/bin/env node

// Debug script to identify exact startup failure
console.log('Starting diagnostic...');

try {
  // Test tsx compilation directly
  const { spawn } = require('child_process');
  
  const child = spawn('npx', ['tsx', '--check', 'server/index.ts'], {
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'development' }
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  child.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  child.on('close', (code) => {
    console.log('Exit code:', code);
    if (stdout) {
      console.log('STDOUT:');
      console.log(stdout);
    }
    if (stderr) {
      console.log('STDERR:');
      console.log(stderr);
    }
  });

} catch (error) {
  console.error('Error running diagnostic:', error);
}