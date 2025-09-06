import type { Plugin } from 'vite'

export function erudaPlugin(): Plugin {
  return {
    name: 'eruda-plugin',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        const isDev = context.server?.config.command === 'serve' || 
                     context.server?.config.mode === 'development'
        
        if (isDev) {
          // Inject Eruda initialization script for development builds
          const erudaScript = `
            <script>
              (function() {
                // Check if running in Capacitor (mobile app)
                if (window.Capacitor && window.Capacitor.isNativePlatform()) {
                  const script = document.createElement('script');
                  script.src = '/node_modules/eruda/eruda.js';
                  script.onload = function() {
                    if (window.eruda) {
                      window.eruda.init({
                        container: document.body,
                        tool: ['console', 'elements', 'network', 'resources', 'info', 'snippets'],
                        useShadowDom: true,
                        autoScale: true,
                        defaults: {
                          displaySize: 50,
                          transparency: 0.9,
                          theme: 'Material Design'
                        }
                      });
                      console.log('📱 Eruda mobile debugging initialized via script injection');
                    }
                  };
                  document.head.appendChild(script);
                }
              })();
            </script>
          `
          
          return html.replace('<head>', `<head>${erudaScript}`)
        }
        
        return html
      }
    }
  }
}