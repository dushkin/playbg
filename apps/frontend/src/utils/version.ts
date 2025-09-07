export const getAppVersion = (): string => {
  // Get version from environment variables or fallback to package.json version
  return import.meta.env.VITE_APP_VERSION || '1.0.30'
}

export const getBuildInfo = () => {
  return {
    version: getAppVersion(),
    buildTime: import.meta.env.VITE_BUILD_TIME || 'Unknown',
    environment: import.meta.env.MODE || 'development'
  }
}