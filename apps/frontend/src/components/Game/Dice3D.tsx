import React, { useMemo } from 'react'

interface Dice3DProps {
  value: number
  size?: 'xs' | 'sm' | 'md' | 'lg'
  isRolling?: boolean
  animationDelay?: number
  color?: 'white' | 'black'
  blank?: boolean
  showR?: boolean
}

const Dice3D: React.FC<Dice3DProps> = ({ value, size = 'md', isRolling = false, animationDelay = 0, color = 'white', blank = false, showR = false }) => {
  const sizeClasses = useMemo(() => {
    switch (size) {
      case 'xs':
        return 'w-6 h-6'
      case 'sm':
        return 'w-8 h-8'
      case 'lg':
        return 'w-16 h-16'
      default:
        return 'w-12 h-12'
    }
  }, [size])

  const dotSize = useMemo(() => {
    switch (size) {
      case 'xs':
        return 'w-0.5 h-0.5'
      case 'sm':
        return 'w-1 h-1'
      case 'lg':
        return 'w-3 h-3'
      default:
        return 'w-2 h-2'
    }
  }, [size])

  const getDotPositions = (value: number): string[] => {
    const positions: Record<number, string[]> = {
      1: ['center'],
      2: ['top-left', 'bottom-right'],
      3: ['top-left', 'center', 'bottom-right'],
      4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
      6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right']
    }
    return positions[value] || []
  }

  const getDotClassName = (position: string): string => {
    const dotColorClass = color === 'white' ? 'bg-gray-800' : 'bg-white'
    const baseClasses = `absolute ${dotSize} ${dotColorClass} rounded-full ${color === 'black' ? 'shadow-lg' : 'shadow-sm'}`

    switch (position) {
      case 'top-left':
        return `${baseClasses} top-1 left-1`
      case 'top-right':
        return `${baseClasses} top-1 right-1`
      case 'middle-left':
        return `${baseClasses} top-1/2 left-1 transform -translate-y-1/2`
      case 'middle-right':
        return `${baseClasses} top-1/2 right-1 transform -translate-y-1/2`
      case 'center':
        return `${baseClasses} top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2`
      case 'bottom-left':
        return `${baseClasses} bottom-1 left-1`
      case 'bottom-right':
        return `${baseClasses} bottom-1 right-1`
      default:
        return baseClasses
    }
  }

  const dotPositions = blank || showR ? [] : getDotPositions(value)

  const diceBackground = color === 'white'
    ? 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 25%, #e9ecef 50%, #dee2e6 75%, #ced4da 100%)'
    : 'linear-gradient(135deg, #1f2937 0%, #374151 25%, #4b5563 50%, #6b7280 75%, #9ca3af 100%)'

  return (
    <div
      className={`
        ${sizeClasses} relative rounded-lg shadow-lg transition-all duration-300 ease-out
        ${isRolling ? 'animate-bounce' : 'hover:scale-110'}
        transform-gpu perspective-1000
      `}
      style={{
        background: diceBackground,
        boxShadow: `
          0 6px 12px rgba(0,0,0,0.15),
          0 3px 6px rgba(0,0,0,0.1),
          inset 0 1px 3px rgba(255,255,255,0.5),
          inset 0 -1px 2px rgba(0,0,0,0.1)
        `,
        border: '1px solid rgba(0,0,0,0.1)',
        transform: isRolling ? 'rotateX(15deg) rotateY(15deg)' : 'rotateX(5deg) rotateY(5deg)',
        animation: isRolling ? `dice-roll 1.2s ease-in-out infinite` : undefined,
        animationDelay: isRolling ? `${animationDelay}s` : undefined
      }}
    >
      {/* Inner face highlight */}
      <div
        className="absolute inset-0.5 rounded-md"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%)'
        }}
      />

      {/* Dots */}
      {dotPositions.map((position, index) => (
        <div
          key={`${position}-${index}`}
          className={getDotClassName(position)}
          style={{
            boxShadow: color === 'black'
              ? 'inset 0 1px 2px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)'
              : 'inset 0 1px 2px rgba(0,0,0,0.3), 0 1px 1px rgba(255,255,255,0.3)',
            background: color === 'black' ? '#ffffff' : undefined
          }}
        />
      ))}

      {/* R Letter */}
      {showR && (
        <div
          className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 font-bold select-none ${
            color === 'white' ? 'text-gray-800' : 'text-white'
          } ${
            size === 'xs' ? 'text-xs' :
            size === 'sm' ? 'text-sm' :
            size === 'lg' ? 'text-2xl' : 'text-lg'
          }`}
          style={{
            textShadow: '0 1px 2px rgba(0,0,0,0.3)'
          }}
        >
          R
        </div>
      )}

      {/* Edge highlights for 3D effect */}
      <div
        className="absolute top-0 left-0 w-full h-0.5 rounded-t-lg"
        style={{
          background: 'linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,0.4))'
        }}
      />
      <div
        className="absolute top-0 left-0 w-0.5 h-full rounded-l-lg"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.8), rgba(255,255,255,0.4))'
        }}
      />
      <div
        className="absolute bottom-0 right-0 w-full h-0.5 rounded-b-lg"
        style={{
          background: 'linear-gradient(90deg, rgba(0,0,0,0.1), rgba(0,0,0,0.2))'
        }}
      />
      <div
        className="absolute bottom-0 right-0 w-0.5 h-full rounded-r-lg"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.2))'
        }}
      />
    </div>
  )
}

export default Dice3D