import React from 'react';

/**
 * Logo component displaying the unique neon cyan/purple ANSI C logo
 * inspired by an open programming book and the letter C.
 * 
 * @param {object} props
 * @param {'small'|'medium'|'large'} props.size - Size variant of the logo
 * @param {boolean} props.glow - Whether to apply the neon glow effects
 */
export default function Logo({ size = 'medium', glow = true }) {
  const sizeDims = {
    small: { width: 28, height: 28 },
    medium: { width: 38, height: 38 },
    large: { width: 90, height: 90 }
  };
  const dims = sizeDims[size] || sizeDims.medium;

  return (
    <svg 
      className={`ansi-c-logo-svg logo-${size}`}
      width={dims.width} 
      height={dims.height} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <defs>
        {/* Book pages background gradient */}
        <linearGradient id="bookBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#131320" />
          <stop offset="100%" stopColor="#08080f" />
        </linearGradient>
        
        {/* Neon Cyan Gradient */}
        <linearGradient id="cyanNeonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00f0ff" />
          <stop offset="100%" stopColor="#0088ff" />
        </linearGradient>
        
        {/* Neon Purple Gradient */}
        <linearGradient id="purpleNeonGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#e040fb" />
          <stop offset="100%" stopColor="#9c27b0" />
        </linearGradient>
        
        {/* Glow Filters */}
        <filter id="cyanGlowEffect" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="purpleGlowEffect" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Book Outer Cover Silhouette */}
      <path 
        d="M10 74 C10 74, 26 77, 50 77 C74 77, 90 74, 90 74 V24 C90 24, 74 27, 50 27 C26 27, 10 24, 10 24 Z" 
        fill="#040408" 
      />

      {/* Book Page Border (Glowing Neon Purple Outline) */}
      <path 
        d="M8 72 C8 72, 26 75, 50 75 C74 75, 92 72, 92 72 V22 C92 22, 74 25, 50 25 C26 25, 8 22, 8 22 Z" 
        stroke="url(#purpleNeonGrad)" 
        strokeWidth="3" 
        strokeLinejoin="round"
        filter={glow ? "url(#purpleGlowEffect)" : ""}
      />

      {/* Book Open Pages Background */}
      <path 
        d="M11 70 C11 70, 27 72.5, 50 72.5 C73 72.5, 89 70, 89 70 V20 C89 20, 73 22.5, 50 22.5 C27 22.5, 11 20, 11 20 Z" 
        fill="url(#bookBgGrad)" 
        stroke="rgba(255, 255, 255, 0.05)"
        strokeWidth="1"
      />

      {/* Center Spine Divider */}
      <line x1="50" y1="22.5" x2="50" y2="72.5" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1.5" />

      {/* Left Page Text Lines representing code structure */}
      <line x1="20" y1="33" x2="42" y2="33" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="41" x2="38" y2="41" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" strokeLinecap="round" />
      <line x1="22" y1="49" x2="40" y2="49" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="57" x2="35" y2="57" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" strokeLinecap="round" />
      <line x1="20" y1="65" x2="44" y2="65" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" strokeLinecap="round" />

      {/* Right Page Text Lines representing code structure */}
      <line x1="58" y1="33" x2="80" y2="33" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" strokeLinecap="round" />
      <line x1="62" y1="41" x2="82" y2="41" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" strokeLinecap="round" />
      <line x1="58" y1="49" x2="76" y2="49" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" strokeLinecap="round" />
      <line x1="62" y1="57" x2="80" y2="57" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" strokeLinecap="round" />
      <line x1="56" y1="65" x2="78" y2="65" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" strokeLinecap="round" />

      {/* Prominent Overlay Letter 'C' in Neon Cyan */}
      <path 
        d="M62 38 C59 34.5, 54 32.5, 48 34.5 C40 37, 34 45.5, 36 54.5 C38 63.5, 46.5 68, 54.5 65.5 C59.5 64, 62 60, 63.5 56" 
        stroke="url(#cyanNeonGrad)" 
        strokeWidth="7" 
        strokeLinecap="round" 
        filter={glow ? "url(#cyanGlowEffect)" : ""}
      />
    </svg>
  );
}
