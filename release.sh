#!/bin/bash

# Release script - promotes dev to main with production build
# Usage: ./release.sh 1.0.0
# This script builds both frontend and backend for production deployment

set -e
export GIT_PAGER=cat

if [ -z "$1" ]; then
  echo "❌ Error: Please provide a version number"
  echo "Usage: ./release.sh <version>"
  exit 1
fi

VERSION="$1"
echo "🚀 Starting release process for PlayBG version $VERSION"

# Ensure on dev branch (warn if not)
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "dev" ]; then
  echo "⚠️  You're on '$CURRENT_BRANCH', not 'dev'"
  read -p "Continue anyway? (y/N): " -n 1 -r
  echo
  [[ $REPLY =~ ^[Yy]$ ]] || { echo "❌ Release cancelled"; exit 1; }
fi

# Ensure clean working tree
if ! git diff-index --quiet HEAD --; then
  echo "❌ Uncommitted changes present. Commit or stash first."
  git status --porcelain
  exit 1
fi

# Bump package.json version (no tag yet)
echo "📝 Setting package.json to $VERSION"
npm version "$VERSION" --no-git-tag-version

# -----------------------------
# 1) Build frontend (production)
# -----------------------------
echo "📦 Building frontend for production..."
cd apps/frontend
npm run build
cd ../..

# -----------------------------
# 2) Build backend (production)
# -----------------------------
echo "🔧 Building backend for production..."
cd apps/backend
npm run build
cd ../..

# -----------------------------
# 3) Run tests to ensure everything works
# -----------------------------
echo "🧪 Running full test suite..."
npm run test

# -----------------------------
# 4) Commit, tag, and merge to main
# -----------------------------
echo "💾 Committing production build files..."
git add .
git commit -m "Release v$VERSION

- Production build for frontend and backend
- All tests passing
- Ready for deployment"

echo "🏷️  Tagging v$VERSION"
git tag "v$VERSION" || true

echo "⬆️  Pushing dev branch"
git push origin dev

echo "🔀 Merging dev into main branch"
git checkout main
git pull origin main
git merge dev --no-ff -m "Release v$VERSION: merge dev into main

Production-ready release with:
- Frontend built for production
- Backend built for production  
- All tests passing
- Version bumped to $VERSION"

echo "⬆️  Pushing main branch"
git push origin main

echo "🔄 Returning to dev branch"
git checkout dev

echo "⬆️  Pushing tag"
git push origin "v$VERSION"

echo "✅ Release $VERSION complete!"
echo "   🌐 Frontend: Production build ready"
echo "   ⚙️  Backend: Production build ready"
echo "   🧪 Tests: All passing"
echo "   📦 Version: $VERSION tagged and pushed"
echo "   🌳 Branches: main updated, back on dev"

git --no-pager show --stat "v$VERSION" || true