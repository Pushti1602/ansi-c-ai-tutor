import React from 'react';

/**
 * ANSI C AI Tutor logo
 * Final mark: outward-facing brackets + concentric circular core.
 */
export default function Logo({ size = 'medium', glow = true }) {
  const sizes = {
    small: 28,
    medium: 40,
    large: 100,
  };

  const dimension = sizes[size] || sizes.medium;

  return (
    <svg
      className={`ansi-c-logo-svg logo-${size}`}
      width={dimension}
      height={dimension}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="ANSI C AI Tutor logo"
    >
      <defs>
        <filter
          id="ansiCyanGlow"
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
        >
          <feGaussianBlur stdDeviation="2.2" result="cyanBlur" />
          <feMerge>
            <feMergeNode in="cyanBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter={glow ? 'url(#ansiCyanGlow)' : undefined}>
        {/* Left outward-facing bracket: ] */}
        <path
          d="M20 20 H32 V80 H20"
          stroke="#22DDF5"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Right outward-facing bracket: [ */}
        <path
          d="M80 20 H68 V80 H80"
          stroke="#22DDF5"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Outer circular ring */}
        <circle
          cx="50"
          cy="50"
          r="13"
          stroke="#22DDF5"
          strokeWidth="4"
        />

        {/* Filled inner circle */}
        <circle
          cx="50"
          cy="50"
          r="9"
          fill="#22DDF5"
        />
      </g>
    </svg>
  );
}