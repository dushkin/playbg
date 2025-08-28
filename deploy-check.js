#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 PlayBG Deployment Health Check\n');

// Check if all required files exist
const requiredFiles = [
  'package.json',
  'render.yaml',
  'apps/backend/package.json',
  'apps/backend/tsconfig.json',
  'apps/frontend/package.json',
  'packages/shared/package.json',
  'packages/game-logic/package.json'
];

console.log('📂 Checking required files:');
requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
});

// Check package.json scripts
console.log('\n📋 Checking build scripts:');
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  const scripts = ['build:backend', 'build:frontend', 'start'];
  
  scripts.forEach(script => {
    const exists = pkg.scripts && pkg.scripts[script];
    console.log(`  ${exists ? '✅' : '❌'} ${script}: ${exists || 'missing'}`);
  });
} catch (error) {
  console.log('  ❌ Error reading package.json');
}

// Check render.yaml structure
console.log('\n⚙️  Checking render.yaml:');
try {
  const renderConfig = fs.readFileSync(path.join(__dirname, 'render.yaml'), 'utf8');
  
  const checks = [
    { name: 'Backend service', pattern: /name:\s*playbg-backend/ },
    { name: 'Frontend service', pattern: /name:\s*playbg-frontend/ },
    { name: 'Build command', pattern: /buildCommand:\s*npm run build/ },
    { name: 'Start command', pattern: /startCommand:\s*npm start/ },
    { name: 'Environment vars', pattern: /envVars:/ }
  ];
  
  checks.forEach(check => {
    const exists = check.pattern.test(renderConfig);
    console.log(`  ${exists ? '✅' : '❌'} ${check.name}`);
  });
} catch (error) {
  console.log('  ❌ Error reading render.yaml');
}

// Check if dist folders exist (after build)
console.log('\n🏗️  Checking build outputs:');
const buildOutputs = [
  'apps/backend/dist',
  'apps/frontend/dist',
  'packages/shared/dist',
  'packages/game-logic/dist'
];

buildOutputs.forEach(dir => {
  const exists = fs.existsSync(path.join(__dirname, dir));
  console.log(`  ${exists ? '✅' : '⚠️ '} ${dir} ${exists ? '' : '(run build first)'}`);
});

console.log('\n🚀 Deployment Recommendations:');
console.log('1. Ensure GitHub repository is connected to Render');
console.log('2. Set environment variables in Render dashboard:');
console.log('   - MONGODB_URI (MongoDB Atlas connection string)');
console.log('   - REDIS_URL (Redis Cloud connection string)'); 
console.log('   - JWT_SECRET (secure random string)');
console.log('3. Check Render service logs for specific errors');
console.log('4. Verify build runs successfully: npm run build:backend');
console.log('\n📖 See DEPLOYMENT.md for detailed setup instructions');