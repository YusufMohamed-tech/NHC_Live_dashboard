import React from 'react'
import { Sparkles } from 'lucide-react'

export default function TopBanner() {
  return (
    <div className="relative z-50 flex items-center justify-center overflow-hidden bg-slate-900 border-b border-white/10 px-4 py-4 sm:py-5 sm:px-8 shadow-sm">
      {/* Background Accents */}
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 via-indigo-900/40 to-lime-500/10" />
      <div className="absolute -left-1/4 inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/5 to-transparent blur-2xl animate-pulse" />
      
      <div className="relative flex flex-col md:flex-row items-center justify-center gap-4 sm:gap-8 text-sm text-white/90">
        
        {/* Left Side: NHC */}
        <div className="flex items-center gap-3">
          <img
            src="/branding/nhc-logo.png"
            alt="NHC Platform"
            className="h-10 sm:h-12 w-auto drop-shadow-lg"
            style={{ filter: 'grayscale(1) invert(1)', mixBlendMode: 'screen' }}
          />
        </div>

        {/* Center: Message */}
        <div className="flex items-center gap-3 md:gap-4" dir="ltr">
          <div className="hidden md:block h-[1px] w-12 sm:w-20 bg-gradient-to-r from-transparent to-white/30" />
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-emerald-100">
            <Sparkles className="h-4 w-4 text-lime-400" />
            <span>In Strategic Partnership With</span>
          </div>
          <div className="hidden md:block h-[1px] w-12 sm:w-20 bg-gradient-to-l from-transparent to-white/30" />
        </div>

        {/* Right Side: Chessboard */}
        <div className="flex items-center gap-3">
          <img
            src="/branding/chessboard-logo.jpeg"
            alt="Chessboard Partner"
            className="h-10 sm:h-12 w-auto opacity-90 transition-opacity hover:opacity-100 drop-shadow-lg"
            style={{ filter: 'grayscale(1) invert(1)', mixBlendMode: 'screen' }}
          />
        </div>
        
      </div>
    </div>
  )
}

