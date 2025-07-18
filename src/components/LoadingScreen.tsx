'use client'

import React, { useState, useEffect } from 'react'
import { useProgress } from '@react-three/drei'

interface LoadingScreenProps {
  onLoadingComplete?: () => void
}

export default function LoadingScreen({ onLoadingComplete }: LoadingScreenProps) {
  const { progress } = useProgress()
  const [displayProgress, setDisplayProgress] = useState(0)

  useEffect(() => {
    // Animar o progresso de forma suave
    const timer = setTimeout(() => {
      setDisplayProgress(progress)
    }, 100)

    return () => clearTimeout(timer)
  }, [progress])

  useEffect(() => {
    // Quando o progresso chegar a 100%, chamar o callback
    if (progress >= 100 && onLoadingComplete) {
      const timer = setTimeout(() => {
        onLoadingComplete()
      }, 500) // Pequeno delay para mostrar 100%

      return () => clearTimeout(timer)
    }
  }, [progress, onLoadingComplete])

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-2xl font-light text-white mb-2">
          {Math.round(displayProgress)}%
        </div>
        <div className="w-32 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300 ease-out"
            style={{ width: `${displayProgress}%` }}
          />
        </div>
        <div className="text-white mt-2 text-xs opacity-60">
          loading
        </div>
      </div>
    </div>
  )
} 