export const getAppVersion = (): string => {
  // Get version from environment variables injected by Vite from root package.json
  return import.meta.env.VITE_APP_VERSION || '1.0.148'
}

export const getBuildInfo = () => {
  return {
    version: getAppVersion(),
    buildTime: import.meta.env.VITE_BUILD_TIME || 'Unknown',
    environment: import.meta.env.MODE || 'development'
  }
}