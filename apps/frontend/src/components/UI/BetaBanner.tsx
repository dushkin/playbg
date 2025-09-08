import { useState } from 'react'
import { X } from 'lucide-react'
import { getAppVersion } from '@/utils/version'
import { isMobile, isAndroid } from '@/utils/mobile'

interface BetaBannerProps {
  version?: string
}

const BetaBanner: React.FC<BetaBannerProps> = ({ version = getAppVersion() }) => {
  const [isVisible, setIsVisible] = useState(true)
  const mobile = isMobile()

  if (!isVisible) return null

  return (
    <div
      className="bg-orange-500 text-white px-3 sm:px-4 py-2 text-xs sm:text-sm flex items-center justify-between shadow-sm relative z-50"
      // On mobile devices, apply a safe-area inset on iOS, but provide a reasonable
      // fixed fallback for Android. Android webviews often report `env(safe-area-inset-top)`
      // as 0px unless there is a notch, which causes elements to sit underneath
      // the system status bar. By checking `isAndroid()`, we can push the banner
      // down by ~25px to avoid the overlap. For iOS, rely on the native safe-area inset.
      style={{
        marginTop: mobile ? (isAndroid() ? '25px' : 'env(safe-area-inset-top)') : '0'
      }}
    >
      <div className="flex items-center space-x-1 sm:space-x-2 flex-wrap">
        <span className="font-semibold">BETA</span>
        <span className="hidden sm:inline">•</span>
        <span className="whitespace-nowrap">v{version}</span>
        {!mobile && (
          <>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline">This is a beta version - some features may be unstable</span>
          </>
        )}
      </div>
      <button
        onClick={() => setIsVisible(false)}
        className="ml-2 sm:ml-4 p-1 hover:bg-orange-600 rounded transition-colors flex-shrink-0"
        aria-label="Close beta banner"
      >
        <X size={14} className="sm:w-4 sm:h-4" />
      </button>
    </div>
  )
}

export default BetaBanner