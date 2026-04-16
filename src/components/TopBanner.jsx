import React from 'react'

export default function TopBanner() {
  return (
    <div className="relative z-50 flex items-center justify-center p-[12px_20px] bg-slate-900 border-b border-white/5 overflow-hidden">
      {/* Subtle SaaS Glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4/5 h-2/3 bg-indigo-500/10 blur-3xl rounded-full" 
        aria-hidden="true" 
      />
      
      <style>{`
        @keyframes bannerSaaSIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .saas-branding-pill {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          background: #ffffff;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border-radius: 16px;
          box-shadow: 0 8px 30px rgba(15, 23, 42, 0.16);
          padding: 16px 24px;
          transition: transform 0.3s ease, background 0.3s ease, box-shadow 0.3s ease;
          border: 1px solid rgba(15, 23, 42, 0.12);

          /* Animation on load */
          opacity: 0;
          animation: bannerSaaSIn 0.6s ease-out forwards;
        }

        /* Hover interaction */
        .saas-branding-pill:hover {
          transform: scale(1.02);
          background: #ffffff;
          box-shadow: 0 12px 40px rgba(15, 23, 42, 0.24);
        }

        .saas-brand-logo {
          height: 64px;
          width: auto;
          object-fit: contain;
          opacity: 0.95;
          transition: opacity 0.3s ease, transform 0.3s ease;
          border-radius: 8px; /* Smooth corners for raw files if they have boxes */
        }

        /* Desktop Layout override */
        @media (min-width: 640px) {
          .saas-branding-pill {
            flex-direction: row;
            gap: 32px;
            padding: 16px 40px;
          }
        }

        .saas-divider {
          width: 48px;
          height: 1px;
          background: rgba(15, 23, 42, 0.2);
        }

        @media (min-width: 640px) {
          .saas-divider {
            width: 1px;
            height: 48px;
          }
        }

        .saas-powered-text {
          font-family: 'Inter', 'Poppins', sans-serif;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: 0.8px;
          color: rgba(15, 23, 42, 0.75);
          white-space: nowrap;
          text-transform: none;
        }
      `}</style>
      
      <div className="saas-branding-pill" dir="ltr">
        <img
          src="/branding/nhc-logo.png"
          alt="NHC platform"
          className="saas-brand-logo"
        />
        
        <div className="saas-divider" aria-hidden="true" />
        
        <span className="saas-powered-text">
          Powered by Chessboard
        </span>
        
        <div className="saas-divider" aria-hidden="true" />
        
        <img
          src="/branding/chessboard-logo.jpeg"
          alt="Chessboard Technology Partner"
          className="saas-brand-logo"
        />
      </div>
    </div>
  )
}

