#!/bin/bash

# Build script for backend deployment
set -e

echo "Starting backend build process..."

# Install root dependencies
echo "Installing root dependencies..."
npm install

# Build shared package
echo "Building shared package..."
cd packages/shared
npm install
npm run build
cd ../..

# Build game-logic package  
echo "Building game-logic package..."
cd packages/game-logic
npm install
npm run build
cd ../..

# Build backend
echo "Building backend..."
cd apps/backend
npm install
npm run build
cd ../..

echo "Backend build completed successfully!"
