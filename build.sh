#!/bin/bash
#
# build.sh — Development Build Script for PlayBG
# - Builds both backend and frontend in development mode
# - Auto-increments version in package.json
# - Uses development environment variables
# - Commits changes to dev branch
# - For testing and development deployment
#
set -euo pipefail

clear

echo "==============================="
echo " PlayBG • Development Build"
echo "==============================="
echo

# 1) Auto-increment version in package.json
echo "📈 Auto-incrementing version in package.json"
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "   Current version: $CURRENT_VERSION"

# Increment patch version (x.y.z -> x.y.z+1)
NEW_VERSION=$(node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const [major, minor, patch] = pkg.version.split('.').map(Number);
  pkg.version = \`\${major}.\${minor}.\${patch + 1}\`;
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  console.log(pkg.version);
")
echo "   New version: $NEW_VERSION"

# 2) Build frontend in development mode
echo
echo "📦 Building frontend (development mode)"
cd apps/frontend
npm run build
cd ../..

# 3) Build backend
echo
echo "🔧 Building backend (TypeScript compilation)"
cd apps/backend
npm run build
cd ../..

# 4) Run tests
echo
echo "🧪 Running tests"
npm run test

# 5) Check for changes and commit if any
echo
echo "💾 Checking for changes to commit"

# Check if there are any changes to commit
if git diff --quiet && git diff --cached --quiet; then
  echo "ℹ️  No changes to commit."
else
  echo "📦 Staging changes..."
  git add .
  
  # Simple commit message for development builds
  COMMIT_MSG="dev: build v${NEW_VERSION}

- Development build with latest changes
- Frontend and backend built successfully
- Tests passing"

  echo -e "📄 Commit Message:\n---\n$COMMIT_MSG\n---"
  
  git commit -m "$COMMIT_MSG"
  
  # Get current branch name
  CURRENT_BRANCH=$(git branch --show-current)
  
  echo "⬆️  Pushing to origin $CURRENT_BRANCH"
  git push origin "$CURRENT_BRANCH"
  
  # Create and push the tag for development builds
  echo "🏷️  Creating and pushing development tag v$NEW_VERSION-dev"
  git tag -a "v$NEW_VERSION-dev" -m "Development build v$NEW_VERSION" || echo "⚠️  Tag might already exist"
  git push origin "v$NEW_VERSION-dev" || echo "⚠️  Failed to push tag"
fi

echo
echo "🎉 Done! Development build complete."
echo "   Version: $NEW_VERSION"
echo "   Frontend: Built successfully"
echo "   Backend: Built successfully"
echo "   Tests: Passed"