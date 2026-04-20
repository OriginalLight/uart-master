import React from 'react';

/**
 * Uart Master Logo Component
 * A modern, tech-focused icon representing serial communication (TX/RX lines)
 * with a pulse representing data flow.
 */
export const Logo = ({ className = "w-6 h-6", glow = true }: { className?: string; glow?: boolean }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Background Base */}
        <rect x="2" y="2" width="20" height="20" rx="4" className="fill-muted/20" />
        
        {/* Serial Lines */}
        <path 
          d="M6 9H18" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          className="opacity-20"
        />
        <path 
          d="M6 15H18" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          className="opacity-20"
        />
        
        {/* RX Line (with data packet) */}
        <path 
          d="M6 15H10" 
          stroke="#00D1FF" 
          strokeWidth="2" 
          strokeLinecap="round" 
          className={glow ? "drop-shadow-[0_0_3px_rgba(0,209,255,0.8)]" : ""}
        />
        <circle 
          cx="12" 
          cy="15" 
          r="1.5" 
          fill="#00D1FF" 
          className={glow ? "animate-pulse drop-shadow-[0_0_5px_rgba(0,209,255,1)]" : ""}
        />
        <path 
          d="M14 15H18" 
          stroke="#00D1FF" 
          strokeWidth="2" 
          strokeLinecap="round" 
          className={glow ? "drop-shadow-[0_0_3px_rgba(0,209,255,0.8)]" : ""}
          strokeDasharray="2 2"
        />

        {/* TX Line */}
        <path 
          d="M6 9H13" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round"
        />
        <path 
          d="M16 9H18" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round"
        />
        
        {/* Decorative Bits */}
        <rect x="14" y="8" width="1" height="2" fill="currentColor" opacity="0.5" />
      </svg>
    </div>
  );
};

export default Logo;
