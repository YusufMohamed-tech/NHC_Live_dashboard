import React from 'react'
import { Sparkles } from 'lucide-react'

export default function TopBanner() {
  return (
    <div className="relative z-50 flex items-center justify-center overflow-hidden bg-slate-900 border-b border-white/10 px-4 py-2.5 sm:px-6 shadow-sm">
      {/* Background Accents */}
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 via-indigo-900/40 to-lime-500/10" />
      <div className="absolute -left-1/4 inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/5 to-transparent blur-2xl animate-pulse" />
      
      <div className="relative flex flex-col md:flex-row items-center justify-center gap-3 sm:gap-6 text-sm text-white/90">
        
        {/* Left Side: NHC */}
        <div className="flex items-center gap-3">
          <img
            src="/branding/nhc-logo.png"
            alt="NHC Platform"
            className="h-6 sm:h-7 w-auto drop-shadow-lg"
            style={{ filter: 'grayscale(1) invert(1)', mixBlendMode: 'screen' }}
          />
        </div>

        {/* Center: Message */}
        <div className="flex items-center gap-3" dir="ltr">
          <div className="hidden sm:block h-[1px] w-8 sm:w-16 bg-gradient-to-r from-transparent to-white/30" />
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-emerald-100">
            <Sparkles className="h-3 w-3 text-lime-400" />
            <span>In Strategic Partnership With</span>
          </div>
          <div className="hidden sm:block h-[1px] w-8 sm:w-16 bg-gradient-to-l from-transparent to-white/30" />
        </div>

        {/* Right Side: Chessboard */}
        <div className="flex items-center gap-3">
          <img
            src="/branding/chessboard-logo.jpeg"
            alt="Chessboard Partner"
            className="h-4 sm:h-4 w-auto opacity-90 transition-opacity hover:opacity-100 drop-shadow-lg"
            style={{ filter: 'grayscale(1) invert(1)', mixBlendMode: 'screen' }}
          />
        </div>
        
      </div>
    </div>
  )
}

