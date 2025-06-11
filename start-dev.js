#!/usr/bin/env node
import { spawn } from 'child_process';

const child = spawn('node', ['--import', 'tsx/esm', 'server/index-simple.ts'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' }
});

child.on('exit', (code) => {
  process.exit(code);
});