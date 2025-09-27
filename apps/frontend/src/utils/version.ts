export const getAppVersion = (): string => {
  // Get version from Vite define constants or environment variables
  const defineVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : undefined
  const envVersion = import.meta.env.VITE_APP_VERSION
  const fallbackVersion = '1.0.154'

  return defineVersion || envVersion || fallbackVersion
}

export const getBuildInfo = () => {
  return {
    version: getAppVersion(),
    buildTime: import.meta.env.VITE_BUILD_TIME || 'Unknown',
    environment: import.meta.env.MODE || 'development'
  }
}