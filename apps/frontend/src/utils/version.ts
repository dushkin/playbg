export const getAppVersion = (): string => {
  // Get version from environment variables injected by Vite from root package.json
  const envVersion = import.meta.env.VITE_APP_VERSION
  const fallbackVersion = '1.0.150'

  // Debug logging to help identify version source
  if (import.meta.env.DEV) {
    console.log('🔍 Version debug:', {
      envVersion,
      fallbackVersion,
      usingFallback: !envVersion
    })
  }

  return envVersion || fallbackVersion
}

export const getBuildInfo = () => {
  return {
    version: getAppVersion(),
    buildTime: import.meta.env.VITE_BUILD_TIME || 'Unknown',
    environment: import.meta.env.MODE || 'development'
  }
}