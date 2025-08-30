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

# 4) Update Android version and sync Capacitor
echo
echo "📝 Syncing Android versionName/versionCode from package.json"
VERSION=$NEW_VERSION
if [[ -z "${VERSION}" ]]; then
  echo "❌ Could not read version from package.json"
  exit 1
fi
echo "   package.json version: ${VERSION}"

# Compute a monotonic numeric versionCode from semver (major*100000 + minor*1000 + patch)
VERSION_CODE=$(node -e "const v=require('./package.json').version.split('.').map(Number); if(v.length!==3||v.some(isNaN)){console.error('Invalid semver in package.json'); process.exit(2)}; console.log(v[0]*100000+v[1]*1000+v[2]);")

GRADLE_FILE="apps/frontend/android/app/build.gradle"
if [[ -f "$GRADLE_FILE" ]]; then
  echo "   Editing $GRADLE_FILE"
  # versionName
  if grep -qE '^[[:space:]]*versionName[[:space:]]+\"[^\"]+\"' "$GRADLE_FILE"; then
    sed -i.bak -E "s/^[[:space:]]*versionName[[:space:]]+\"[^\"]+\"/        versionName \"${VERSION}\"/" "$GRADLE_FILE"
  else
    sed -i.bak -E "/defaultConfig[[:space:]]*\{/a\\        versionName \"${VERSION}\"" "$GRADLE_FILE"
  fi
  # versionCode (ensure monotonic increase if existing is higher)
  CURRENT_CODE=$(grep -E '^[[:space:]]*versionCode[[:space:]]+[0-9]+' "$GRADLE_FILE" | head -1 | sed -E 's/[^0-9]*([0-9]+).*/\1/')
  if [[ -n "${CURRENT_CODE:-}" ]] && [[ "$VERSION_CODE" -le "$CURRENT_CODE" ]]; then
    VERSION_CODE=$((CURRENT_CODE + 1))
    echo "   • Bumped versionCode to $VERSION_CODE to keep it monotonic"
  fi
  if grep -qE '^[[:space:]]*versionCode[[:space:]]+[0-9]+' "$GRADLE_FILE"; then
    sed -i.bak -E "s/^[[:space:]]*versionCode[[:space:]]+[0-9]+/        versionCode ${VERSION_CODE}/" "$GRADLE_FILE"
  else
    sed -i.bak -E "/defaultConfig[[:space:]]*\{/a\\        versionCode ${VERSION_CODE}" "$GRADLE_FILE"
  fi
else
  echo "⚠️  $GRADLE_FILE not found; skipping Gradle version sync."
fi

# 5) Capacitor sync
echo
echo "🔄 Running: npx cap sync android"
cd apps/frontend
npx cap sync android
cd ../..

# 6) Build DEBUG APK
echo
echo "🤖 Building DEBUG APK via Gradle"
cd apps/frontend/android
if [[ "${OSTYPE:-}" == "msys" || "${OSTYPE:-}" == "cygwin" ]]; then
  ./gradlew.bat assembleDebug
else
  ./gradlew assembleDebug
fi
cd ../../..

DEBUG_APK_PATH="apps/frontend/android/app/build/outputs/apk/debug/app-debug.apk"
if [[ ! -f "$DEBUG_APK_PATH" ]]; then
  echo "❌ Debug APK not found at $DEBUG_APK_PATH"
  exit 1
fi

# 7) Copy APKs into public (not committed)
echo
echo "📁 Copying APK to ./public (not committed)"
mkdir -p public
DEBUG_VERSIONED_APK_NAME="playbg-debug-v${VERSION}.apk"
cp "$DEBUG_APK_PATH" "public/$DEBUG_VERSIONED_APK_NAME"
cp "$DEBUG_APK_PATH" "public/playbg-debug.apk"
APK_SIZE=$(du -h "public/playbg-debug.apk" | cut -f1 || echo "?")
echo "✅ APKs:"
echo "   • public/$DEBUG_VERSIONED_APK_NAME"
echo "   • public/playbg-debug.apk  (${APK_SIZE})"

# 8) Clean up backup gradle file
if [[ -f "${GRADLE_FILE}.bak" ]]; then
  echo "🧹 Removing ${GRADLE_FILE}.bak"
  # If ever tracked, untrack it (ignore errors)
  git rm --cached "${GRADLE_FILE}.bak" 2>/dev/null || true
  rm -f "${GRADLE_FILE}.bak"
fi

# 9) Check for changes and commit if any
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
- Frontend and backend built successfully"

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
echo "   Mobile: Debug APK generated"