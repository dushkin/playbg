# Mobile Debugging with Eruda

This document explains how to use Eruda for debugging the PlayBG mobile app during development and testing.

## What is Eruda?

Eruda is a console for mobile browsers that provides debugging capabilities similar to desktop developer tools. It includes:

- **Console**: View logs, errors, and execute JavaScript
- **Elements**: Inspect DOM structure and styles
- **Network**: Monitor network requests and responses
- **Resources**: View local storage, cookies, and other resources
- **Info**: Device and browser information
- **Snippets**: Run custom JavaScript code

## Setup

Eruda is automatically configured and will be available in the following scenarios:

### Development Mode (Automatic)

When running the app in development mode (`npm run dev`), Eruda will automatically initialize if:
1. The app is running in a Capacitor environment (mobile device/emulator)
2. The environment is detected as development mode

### Production Mode (Manual)

To enable Eruda in production builds for debugging:

1. Set the environment variable `VITE_DEBUG_MOBILE=true`
2. Rebuild the app with this variable set
3. Deploy to mobile device

## Usage

### Accessing Eruda

Once initialized, Eruda appears as a floating button in the bottom-right corner of the screen. Tap it to open the debugging panel.

### Console Commands

You can use these commands in the Eruda console:

```javascript
// Toggle Eruda visibility (if initialized)
window.toggleEruda()

// Check if running in mobile environment
window.Capacitor && window.Capacitor.isNativePlatform()

// Access Eruda directly
window.eruda
```

### Development Workflow

1. **Start Development Server**:
   ```bash
   npm run dev:frontend
   ```

2. **Build and Sync for Mobile**:
   ```bash
   npm run build:frontend
   npx cap sync
   ```

3. **Run on Device/Emulator**:
   ```bash
   # Android
   npx cap run android
   
   # iOS
   npx cap run ios
   ```

4. **Open App**: Eruda should automatically appear as a floating button

### Production Debugging

For debugging production builds on mobile devices:

1. **Create Debug Build**:
   ```bash
   VITE_DEBUG_MOBILE=true npm run build:frontend
   npx cap sync
   npx cap build android --prod
   ```

2. **Install on Device**: Install the debug APK/IPA on your test device

3. **Access Debugging**: The Eruda console will be available in the production app

## Features

### Console Panel
- View all console.log, console.error, and console.warn messages
- Execute JavaScript commands
- Clear console history

### Elements Panel
- Inspect DOM structure
- View and modify element styles
- Highlight elements on tap

### Network Panel
- Monitor all HTTP requests and responses
- View request headers, response data, and timing
- Filter by request type

### Resources Panel
- View localStorage and sessionStorage
- Inspect cookies
- View application cache

### Info Panel
- Device information (OS, browser, screen size)
- Performance metrics
- Capacitor plugin information

## Troubleshooting

### Eruda Not Appearing

1. **Check Environment**: Ensure you're running in a Capacitor environment
2. **Check Console**: Look for initialization messages in the browser console
3. **Manual Toggle**: Try calling `window.toggleEruda()` in the console
4. **Rebuild**: Clean build and sync again

### Performance Impact

- Eruda adds minimal overhead in development
- For production, only enable when debugging is needed
- Remove VITE_DEBUG_MOBILE=true for final production builds

### Common Issues

1. **TypeScript Errors**: Ensure `globals.d.ts` is included in your tsconfig.json
2. **Build Failures**: Check that Eruda is properly imported as a dev dependency
3. **Mobile Detection**: Eruda only initializes on actual mobile devices/emulators, not in desktop browsers

## Configuration

The Eruda initialization can be customized in `src/main.tsx`:

```typescript
eruda.default.init({
  container: document.body,
  tool: ['console', 'elements', 'network', 'resources', 'info', 'snippets'],
  useShadowDom: true,
  autoScale: true,
  defaults: {
    displaySize: 50,        // Button size (30-100)
    transparency: 0.9,      // Panel transparency (0-1)
    theme: 'Material Design' // Theme: 'Light', 'Dark', 'Material Design'
  }
})
```

## Best Practices

1. **Development**: Always test with Eruda enabled during mobile development
2. **Testing**: Use Eruda to debug issues on actual devices
3. **Production**: Only enable when actively debugging production issues
4. **Performance**: Disable for final production releases
5. **Security**: Don't leave debug mode enabled in app store releases

## Additional Resources

- [Eruda GitHub Repository](https://github.com/liriliri/eruda)
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)