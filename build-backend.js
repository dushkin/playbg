#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

function run(command, cwd = process.cwd()) {
  console.log(`Running: ${command} in ${cwd}`);
  try {
    execSync(command, { 
      cwd, 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' }
    });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    process.exit(1);
  }
}

console.log('Starting backend build process...');

// Install root dependencies
run('npm install');

// Build shared package
const sharedDir = path.join(__dirname, 'packages', 'shared');
run('npm install', sharedDir);
run('npm run build', sharedDir);

// Build game-logic package
const gameLogicDir = path.join(__dirname, 'packages', 'game-logic');
run('npm install', gameLogicDir);
run('npm run build', gameLogicDir);

// Build backend
const backendDir = path.join(__dirname, 'apps', 'backend');
run('npm install', backendDir);
run('npm run build', backendDir);

console.log('Backend build completed successfully!');
