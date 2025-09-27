export const getAppVersion = (): string => {
  // Get version from environment variables injected by Vite from root package.json
  const envVersion = import.meta.env.VITE_APP_VERSION
  const fallbackVersion = '1.0.151'
  const finalVersion = envVersion || fallbackVersion

  // EXTENSIVE DEBUG LOGGING - ALWAYS SHOW IN CONSOLE
  console.log('🔍🔍🔍 VERSION DEBUG START 🔍🔍🔍')
  console.log('📦 Environment version (VITE_APP_VERSION):', envVersion)
  console.log('🎯 Fallback version:', fallbackVersion)
  console.log('✅ Final version being returned:', finalVersion)
  console.log('🌍 Environment mode:', import.meta.env.MODE)
  console.log('🔧 Is development:', import.meta.env.DEV)
  console.log('🏗️ Is production:', import.meta.env.PROD)
  console.log('🔍🔍🔍 VERSION DEBUG END 🔍🔍🔍')

  return finalVersion
}

export const getBuildInfo = () => {
  return {
    version: getAppVersion(),
    buildTime: import.meta.env.VITE_BUILD_TIME || 'Unknown',
    environment: import.meta.env.MODE || 'development'
  }
}