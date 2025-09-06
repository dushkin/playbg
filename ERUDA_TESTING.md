# Eruda Mobile Debugging - Testing Guide

## What Changed

I've fixed the Eruda integration issues and made several improvements:

### 1. **Moved Eruda to Production Dependencies**
- Eruda is now included in the main app bundle, not just dev builds
- Available in all production builds

### 2. **Enhanced Auto-Detection**
- Better Capacitor environment detection
- Multiple initialization fallbacks
- Detailed debug logging

### 3. **Multiple Initialization Methods**
- Primary method in `main.tsx`
- Secondary method in `erudaInit.ts`
- Manual console commands available

## Testing Instructions

### Method 1: Install New APK
1. **Build new APK**:
   ```bash
   npm run build:frontend
   npx cap sync
   npx cap build android
   ```

2. **Install on device** and look for Eruda button (small floating circle in bottom-right)

### Method 2: Test Debug Page
1. **Open debug page** in the mobile app:
   - Navigate to: `http://localhost:3000/debug.html` (if using dev server)
   - Or access `/debug.html` in the built app

2. **Check environment detection** and manually initialize Eruda

### Method 3: Console Commands
Open the browser console (or Eruda console) and run:

```javascript
// Check if mobile environment is detected
console.log('Is mobile:', window.Capacitor && window.Capacitor.isNativePlatform())

// Manually initialize Eruda
window.initErudaDebug()

// Toggle Eruda on/off
window.toggleEruda()
```

## What to Look For

### 1. **Debug Logs in Console**
You should see messages like:
- `🔍 Checking for mobile environment...`
- `📱 Mobile environment detected, auto-initializing Eruda...`
- `✅ Eruda mobile debugging initialized successfully!`

### 2. **Eruda Button**
- Small floating button in bottom-right corner
- Usually semi-transparent
- Tap to open debug panel

### 3. **Eruda Panel**
When opened, you should see tabs for:
- **Console**: Logs and JavaScript console
- **Elements**: DOM inspector
- **Network**: Network requests
- **Resources**: Storage and cookies
- **Info**: Device information
- **Snippets**: Code snippets

## Troubleshooting

### If Eruda Still Doesn't Appear:

1. **Check Console Logs**:
   - Connect device to computer
   - Use Chrome DevTools → Remote devices
   - Check console for debug messages

2. **Manual Initialization**:
   ```javascript
   // Force initialization
   window.initErudaDebug()
   ```

3. **Check LocalStorage**:
   ```javascript
   // Enable debug mode
   localStorage.setItem('eruda-debug', 'true')
   // Then reload the app
   ```

4. **Environment Check**:
   ```javascript
   // Check detection
   console.log('Capacitor:', window.Capacitor)
   console.log('IsNative:', window.Capacitor?.isNativePlatform())
   console.log('Platform:', window.Capacitor?.getPlatform())
   ```

## Debug Page Access

The debug page (`/debug.html`) provides:
- Environment information display
- Manual Eruda controls
- Real-time debug logging
- Capacitor detection status

## Build Commands

For testing, use these commands:

```bash
# Build and sync
npm run build:frontend
npx cap sync

# Build APK
npx cap build android

# Run on device (if connected)
npx cap run android
```

## Expected Behavior

### Development Mode:
- Eruda should auto-initialize on mobile devices
- Debug logs visible in console
- Button appears automatically

### Production Mode:
- Eruda initializes by default (can be disabled)
- All functionality available
- Performance impact minimal

## Need Help?

If Eruda still doesn't appear:

1. **Check the console logs** for debug messages
2. **Try manual initialization** via `window.initErudaDebug()`
3. **Use the debug page** at `/debug.html`
4. **Force enable** via localStorage: `localStorage.setItem('eruda-debug', 'true')`

The new implementation should work much better than the previous version!