#!/bin/bash
#
# build.sh — Development Build Script for PlayBG
# - Builds both backend and frontend in development mode
# - Auto-increments version in package.json
# - Uses development environment variables
# - Commits changes to dev branch
# - Waits for Render deployment to complete (optional)
# - For testing and development deployment
#
# Optional Render deployment monitoring:
# Set these environment variables to enable deployment wait:
#   export RENDER_API_KEY="your_render_api_key"
#   export RENDER_BACKEND_SERVICE_ID="srv-xxxxxxxxxxxxxxxxxxxxx"
#
# Optional debugging (shows raw API responses):
#   export DEBUG_RENDER=1
#
# Get your API key from: https://dashboard.render.com/u/settings/api-keys
# Get service ID from service URL: https://dashboard.render.com/web/srv-xxxxx...
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
export VITE_API_URL=https://playbg-backend-dev.onrender.com/api
export VITE_WS_URL=https://playbg-backend-dev.onrender.com
export VITE_APP_VERSION=$NEW_VERSION
export VITE_BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
echo "   Setting VITE_APP_VERSION=$NEW_VERSION"
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

# 9) Commit AFTER all edits (push ALL changes with AI-generated message)
echo
echo "💾 Preparing to commit ALL changes and build files"

# Check if there are any changes to commit (without staging yet)
if git diff --quiet && git diff --cached --quiet; then
  echo "ℹ️  No changes to commit."
else
  # --- AI Commit Message Generation BEFORE staging ---
  # Quick disable: set SKIP_AI=1 to bypass AI entirely
  if [ "${SKIP_AI:-}" = "1" ]; then
      echo "⚠️  SKIP_AI=1 set, using simple commit message..."
      COMMIT_MSG="dev: build v${NEW_VERSION}

📦 Development build:
- Version bump to ${NEW_VERSION}
- Frontend and backend built successfully
- Debug APK generated"
      echo -e "📄 Using Simple Commit Message:\n---\n$COMMIT_MSG\n---"
  elif [ -z "$GOOGLE_API_KEY" ]; then
      echo "❌ Error: GOOGLE_API_KEY environment variable is not set."
      echo "Please export your Google API key before running this script:"
      echo "export GOOGLE_API_KEY=\"YOUR_API_KEY_HERE\""
      echo "Or set SKIP_AI=1 to bypass AI commit messages entirely."
      exit 1
  else

  # Get the diff that WOULD BE staged (but don't stage yet)
  STAGED_DIFF=$(git diff --stat)
  STAGED_DIFF_SAMPLE=$(git diff | head -n 200)

  echo "🤖 Asking the AI to generate a commit message..."

  # First, discover available models
  echo "🔍 Discovering available models..."
  AVAILABLE_MODELS=$(curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=${GOOGLE_API_KEY}" | jq -r '.models[]?.name // empty' 2>/dev/null | grep -E "(gemini|text)" | head -3)

  if [ -n "$AVAILABLE_MODELS" ]; then
      echo "📋 Found available models:"
      echo "$AVAILABLE_MODELS" | while read model; do
          echo "   - $model"
      done
      # Convert full model names to just the model part
      DISCOVERED_MODELS=($(echo "$AVAILABLE_MODELS" | sed 's|models/||g'))
  else
      echo "⚠️  Could not discover models, using fallback list"
      DISCOVERED_MODELS=("gemini-1.5-flash" "gemini-1.5-pro" "gemini-pro")
  fi

  # Create a summary of changes for the AI, excluding version-only changes
  CHANGED_FILES=$(git diff --name-only | tr '\n' ', ' | sed 's/,$//')

  # Get diff excluding version/build files to focus on meaningful changes
  MEANINGFUL_DIFF=$(git diff -- ':!package.json' ':!package-lock.json' ':!apps/frontend/android/app/build.gradle' | head -n 150)
  VERSION_DIFF=$(git diff -- 'package.json' 'apps/frontend/android/app/build.gradle' | head -n 50)

  # Check if we have meaningful changes beyond version bumps
  if [ -n "$MEANINGFUL_DIFF" ]; then
    CHANGES_SUMMARY="Files changed: $CHANGED_FILES\n\nMeaningful code changes (excluding version files):\n$MEANINGFUL_DIFF\n\nVersion/build changes:\n$VERSION_DIFF\n\nDiff stats:\n$STAGED_DIFF"
    PRIORITY_INSTRUCTION="IMPORTANT: Focus on the meaningful code changes (new features, bug fixes, improvements) rather than version number updates. The version changes are secondary."
  else
    CHANGES_SUMMARY="Files changed: $CHANGED_FILES\n\nChanges (mainly version/build updates):\n$STAGED_DIFF_SAMPLE\n\nDiff stats:\n$STAGED_DIFF"
    PRIORITY_INSTRUCTION="This appears to be primarily a version/build update with no significant code changes."
  fi

  # Create the JSON payload for the Gemini API
  JSON_PAYLOAD=$(jq -n --arg changes "$CHANGES_SUMMARY" --arg priority "$PRIORITY_INSTRUCTION" \
    '{
      "contents": [
        {
          "parts": [
            {
              "text": "Based on the following git changes summary, suggest a concise commit message in the conventional commit format (e.g., feat: summary, fix: summary, chore: summary).\n\n\($priority)\n\nThe message should have a subject line and an optional, brief body if needed. Prioritize the most important functional changes over version number updates.\n\n\($changes)"
            }
          ]
        }
      ]
    }')

  # Debug: Check JSON payload size
  echo "Debug: JSON payload size: $(echo "$JSON_PAYLOAD" | wc -c) characters"

  # Use discovered models or fallback list
  MODELS=("${DISCOVERED_MODELS[@]}")
  COMMIT_MSG=""

  # Try each model until one works
  for MODEL in "${MODELS[@]}"; do
      echo "🤖 Trying model: $MODEL"
      MAX_RETRIES=2
      RETRY_COUNT=0

      while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ -z "$COMMIT_MSG" ]; do
          if [ $RETRY_COUNT -gt 0 ]; then
              echo "🔄 Retry attempt $RETRY_COUNT of $MAX_RETRIES for $MODEL..."
              sleep 1
          fi

          # Call the Gemini API with current model - try both v1beta and v1 endpoints
          API_RESPONSE=$(curl -s -X POST \
            "https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${GOOGLE_API_KEY}" \
            -H "Content-Type: application/json" \
            -d "$JSON_PAYLOAD" 2>/dev/null)

          # If v1 fails, try v1beta
          if [ $? -ne 0 ] || echo "$API_RESPONSE" | grep -q "not found"; then
              API_RESPONSE=$(curl -s -X POST \
                "https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GOOGLE_API_KEY}" \
                -H "Content-Type: application/json" \
                -d "$JSON_PAYLOAD" 2>/dev/null)
          fi

          # Check curl success
          if [ $? -ne 0 ]; then
              echo "⚠️  Network error calling API"
              RETRY_COUNT=$((RETRY_COUNT + 1))
              continue
          fi

          # Parse response
          COMMIT_MSG=$(echo "$API_RESPONSE" | jq -r '.candidates[0].content.parts[0].text' 2>/dev/null | sed 's/`//g' | tr -d '\r')
          API_ERROR=$(echo "$API_RESPONSE" | jq -r '.error.message' 2>/dev/null)

          # Check if successful
          if [ "$COMMIT_MSG" != "null" ] && [ -n "$COMMIT_MSG" ] && [ "$API_ERROR" == "null" ] && [ "$COMMIT_MSG" != "" ]; then
              echo "✅ Successfully generated commit message using $MODEL"
              break 2  # Break out of both loops
          fi

          # Report error
          if [ "$API_ERROR" != "null" ] && [ "$API_ERROR" != "" ]; then
              echo "⚠️  API Error with $MODEL: $API_ERROR"
          else
              echo "⚠️  Empty/invalid response from $MODEL"
          fi

          RETRY_COUNT=$((RETRY_COUNT + 1))
          COMMIT_MSG=""
      done

      # Try next model if this one failed
      if [ -z "$COMMIT_MSG" ]; then
          echo "❌ Model $MODEL failed, trying next..."
      fi
  done

  # Check if all models failed
  if [ -z "$COMMIT_MSG" ] || [ "$COMMIT_MSG" == "null" ]; then
      echo "❌ Error: All AI models failed to generate commit message."
      echo "⚠️  Falling back to simple commit message..."

      COMMIT_MSG="dev: build v${NEW_VERSION}

- Development build with latest changes
- Frontend and backend built successfully"
  else
      # AI-generated message is ready as-is
      echo "✅ Using AI-generated commit message"
  fi

  fi  # Close the SKIP_AI/GOOGLE_API_KEY conditional

  echo -e "📄 Generated Commit Message:\n---\n$COMMIT_MSG\n---"

  # NOW stage the files since AI commit message generation succeeded
  echo "📦 Staging all changes for commit..."
  git add . 2>/dev/null || true

  git commit -m "$COMMIT_MSG"

  # Get current branch name
  CURRENT_BRANCH=$(git branch --show-current)

  echo "⬆️  Pushing to origin $CURRENT_BRANCH"
  git push origin "$CURRENT_BRANCH"

  # Capture the commit hash that was just pushed (for deployment tracking)
  PUSHED_COMMIT_HASH=$(git rev-parse HEAD)

  # Create and push the tag for development builds
  echo "🏷️  Creating and pushing development tag v$NEW_VERSION-dev"
  git tag -a "v$NEW_VERSION-dev" -m "Development build v$NEW_VERSION" || echo "⚠️  Tag might already exist"
  git push origin "v$NEW_VERSION-dev" || echo "⚠️  Failed to push tag"
fi

# 10) Wait for Render deployment to complete (if RENDER_API_KEY is set)
if [ -n "${RENDER_API_KEY:-}" ]; then
  echo
  echo "🚀 Waiting for Render deployment to complete..."

  # Backend service ID (replace with your actual service ID)
  BACKEND_SERVICE_ID="${RENDER_BACKEND_SERVICE_ID:-}"

  # Get the current commit hash for deployment tracking (in case it wasn't set during commit)
  if [ -z "${PUSHED_COMMIT_HASH:-}" ]; then
    PUSHED_COMMIT_HASH=$(git rev-parse HEAD)
  fi

  if [ -z "$BACKEND_SERVICE_ID" ]; then
    echo "⚠️  RENDER_BACKEND_SERVICE_ID not set, skipping deployment wait"
  else
    wait_for_render_deployment() {
      local service_id=$1
      local target_commit_hash=$2
      local max_wait_time=600  # 10 minutes max wait
      local check_interval=15  # Check every 15 seconds
      local elapsed_time=0

      echo "   Service ID: $service_id"
      echo "   Target commit: ${target_commit_hash:0:8}"
      echo "   Checking deployment status every ${check_interval}s (max ${max_wait_time}s)..."

      while [ $elapsed_time -lt $max_wait_time ]; do
        # Get latest deployment status (try multiple API patterns)
        DEPLOY_RESPONSE=""

        # Try the main endpoint first - get more deploys to find the right commit
        DEPLOY_RESPONSE=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $RENDER_API_KEY" \
          "https://api.render.com/v1/services/$service_id/deploys?limit=5" 2>/dev/null)

        # Extract HTTP status code (last 3 characters)
        HTTP_STATUS="${DEPLOY_RESPONSE: -3}"
        DEPLOY_RESPONSE="${DEPLOY_RESPONSE%???}"  # Remove status code from response

        # If first endpoint failed, try alternative patterns
        if [ "$HTTP_STATUS" != "200" ]; then
          if [ "${DEBUG_RENDER:-}" = "1" ]; then
            echo "   🐛 First endpoint returned HTTP $HTTP_STATUS, trying alternatives..."
          fi

          # Try without v1 prefix
          DEPLOY_RESPONSE=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $RENDER_API_KEY" \
            "https://api.render.com/services/$service_id/deploys?limit=5" 2>/dev/null)
          HTTP_STATUS="${DEPLOY_RESPONSE: -3}"
          DEPLOY_RESPONSE="${DEPLOY_RESPONSE%???}"

          # If still failing, try the service endpoint to check connectivity
          if [ "$HTTP_STATUS" != "200" ]; then
            if [ "${DEBUG_RENDER:-}" = "1" ]; then
              echo "   🐛 Second endpoint returned HTTP $HTTP_STATUS, testing service connectivity..."
            fi
            SERVICE_RESPONSE=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $RENDER_API_KEY" \
              "https://api.render.com/v1/services/$service_id" 2>/dev/null)
            SERVICE_HTTP_STATUS="${SERVICE_RESPONSE: -3}"

            if [ "$SERVICE_HTTP_STATUS" != "200" ]; then
              echo "   ❌ Cannot access service (HTTP $SERVICE_HTTP_STATUS). Check service ID and API key."
              break
            fi
          fi
        fi

        if [ $? -ne 0 ]; then
          echo "   ❌ Failed to check deployment status (network error)"
          break
        fi

        # Check HTTP status code
        if [ "$HTTP_STATUS" != "200" ]; then
          case "$HTTP_STATUS" in
            "401")
              echo "   ❌ Authentication failed (HTTP 401). Check your RENDER_API_KEY."
              break
              ;;
            "403")
              echo "   ❌ Access forbidden (HTTP 403). Check API key permissions."
              break
              ;;
            "404")
              echo "   ❌ Service not found (HTTP 404). Check your RENDER_BACKEND_SERVICE_ID."
              break
              ;;
            *)
              echo "   ❌ API request failed (HTTP $HTTP_STATUS)"
              if [ "${DEBUG_RENDER:-}" = "1" ]; then
                echo "   🐛 Error response: $(echo "$DEPLOY_RESPONSE" | head -c 200)..."
              fi
              break
              ;;
          esac
        fi

        # Debug: Show raw response (first 200 chars)
        if [ "${DEBUG_RENDER:-}" = "1" ]; then
          echo "   🐛 Raw API response (HTTP $HTTP_STATUS): $(echo "$DEPLOY_RESPONSE" | head -c 200)..."
        fi

        # Check if response is empty or error
        if [ -z "$DEPLOY_RESPONSE" ]; then
          echo "   ⚠️  Empty response from Render API"
          break
        fi

        # Check for API error in response
        if echo "$DEPLOY_RESPONSE" | grep -q '"error"'; then
          echo "   ❌ API Error: $(echo "$DEPLOY_RESPONSE" | head -c 200)"
          break
        fi

        # Find deployment matching our target commit hash
        # The Render API returns: [{"deploy":{"id":"...", "status":"...", "commit":{"id":"..."}, ...}}]
        DEPLOY_STATUS=""
        DEPLOY_ID=""
        TARGET_COMMIT_SHORT="${target_commit_hash:0:7}"  # First 7 chars for comparison

        if command -v jq >/dev/null 2>&1; then
          # Search through deployments for one matching our commit - extract status and ID directly
          DEPLOY_STATUS=$(echo "$DEPLOY_RESPONSE" | jq -r --arg commit "$target_commit_hash" '.[] | select(.deploy.commit.id? and (.deploy.commit.id | startswith($commit))) | .deploy.status // empty' 2>/dev/null | head -1)
          DEPLOY_ID=$(echo "$DEPLOY_RESPONSE" | jq -r --arg commit "$target_commit_hash" '.[] | select(.deploy.commit.id? and (.deploy.commit.id | startswith($commit))) | .deploy.id // empty' 2>/dev/null | head -1)
          MATCHED_COMMIT=$(echo "$DEPLOY_RESPONSE" | jq -r --arg commit "$target_commit_hash" '.[] | select(.deploy.commit.id? and (.deploy.commit.id | startswith($commit))) | .deploy.commit.id // empty' 2>/dev/null | head -1)

          # Debug: Show what we found (concise)
          if [ "${DEBUG_RENDER:-}" = "1" ]; then
            echo "   🐛 Target commit: ${target_commit_hash:0:8}"
            echo "   🐛 Found status: '$DEPLOY_STATUS', ID: '$DEPLOY_ID'"
          fi
        else
          # Fallback: look for commit hash in the response (simplified)
          if echo "$DEPLOY_RESPONSE" | grep -q "$TARGET_COMMIT_SHORT"; then
            # Extract the deployment containing our commit (very basic parsing)
            DEPLOY_STATUS=$(echo "$DEPLOY_RESPONSE" | sed -n "/$TARGET_COMMIT_SHORT/,/}/{s/.*\"status\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p}" | head -1)
            DEPLOY_ID=$(echo "$DEPLOY_RESPONSE" | sed -n "/$TARGET_COMMIT_SHORT/,/}/{s/.*\"id\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p}" | head -1)
          fi
        fi

        # Debug: Show parsed values
        if [ "${DEBUG_RENDER:-}" = "1" ]; then
          echo "   🐛 Parsed status: '$DEPLOY_STATUS', ID: '$DEPLOY_ID'"
        fi

        if [ "$DEPLOY_STATUS" = "null" ] || [ -z "$DEPLOY_STATUS" ]; then
          if [ $elapsed_time -lt 60 ]; then
            # For the first minute, it's normal that the deployment hasn't been created yet
            printf "   ⏳ Waiting for deployment to be created for commit ${TARGET_COMMIT_SHORT}... [%ds elapsed]\r" "$elapsed_time"
          else
            echo "   ⚠️  Could not find deployment for commit ${target_commit_hash:0:8} after ${elapsed_time}s"
            if [ "${DEBUG_RENDER:-}" = "1" ]; then
              echo "   💡 Raw API response: $(echo "$DEPLOY_RESPONSE" | head -c 200)..."
            else
              echo "   💡 Try setting DEBUG_RENDER=1 to see raw API response and commit details"
            fi
            if [ $elapsed_time -gt 300 ]; then  # After 5 minutes, give up
              echo "   ❌ Deployment was not created within 5 minutes, giving up"
              break
            fi
          fi
        else
          # We found our deployment, check its status
          case "$DEPLOY_STATUS" in
            "live")
              echo "   ✅ Deployment completed successfully! (ID: $DEPLOY_ID) commit: ${target_commit_hash:0:8}"
              echo "   🔥 Waiting 40 seconds for cache warming..."

              # Cache warming countdown
              for i in $(seq 40 -1 1); do
                printf "   ⏱️  Cache warming... %2ds remaining\r" "$i"
                sleep 1
              done

              echo "   🎯 Cache warming completed - deployment fully ready!"
              return 0
              ;;
            "build_failed"|"update_failed"|"canceled")
              echo "   ❌ Deployment failed with status: $DEPLOY_STATUS (ID: $DEPLOY_ID) commit: ${target_commit_hash:0:8}"
              return 1
              ;;
            "created"|"build_in_progress"|"update_in_progress")
              printf "   ⏳ Deployment in progress... (%s) [%ds elapsed] commit: %s\r" "$DEPLOY_STATUS" "$elapsed_time" "${target_commit_hash:0:8}"
              ;;
            *)
              echo "   ❓ Unknown deployment status: $DEPLOY_STATUS (ID: $DEPLOY_ID) commit: ${target_commit_hash:0:8}"
              ;;
          esac
        fi

        sleep $check_interval
        elapsed_time=$((elapsed_time + check_interval))
      done

      if [ $elapsed_time -ge $max_wait_time ]; then
        echo "   ⏰ Deployment wait timeout after ${max_wait_time}s"
        return 2
      fi

      return 1
    }

    # Wait for backend deployment
    if wait_for_render_deployment "$BACKEND_SERVICE_ID" "$PUSHED_COMMIT_HASH"; then
      echo "   🎯 Backend deployment completed successfully (including cache warming)"
    else
      echo "   ⚠️  Backend deployment monitoring completed with issues"
      echo "   💡 Check https://dashboard.render.com for deployment details"
    fi
  fi
else
  echo
  echo "ℹ️  Skipping Render deployment wait (RENDER_API_KEY not set)"
  echo "   💡 To enable deployment monitoring:"
  echo "      export RENDER_API_KEY=\"your_render_api_key\""
  echo "      export RENDER_BACKEND_SERVICE_ID=\"your_service_id\""
fi

echo
echo "🎉 Done! Development build complete."
echo "   Version: $NEW_VERSION"
echo "   Frontend: Built successfully"
echo "   Backend: Built successfully"
echo "   Mobile: Debug APK generated"
if [ -n "${RENDER_API_KEY:-}" ] && [ -n "${RENDER_BACKEND_SERVICE_ID:-}" ]; then
  echo "   Deployment: Monitored via Render API (with cache warming)"
else
  echo "   Deployment: Check manually at https://dashboard.render.com"
fi
echo "   Completed at: $(date)"
