import React from 'react'

export default function WalkIllustration() {
  return (
    <div className="card section fade-in illust-container" aria-hidden>
      <div className="illust">
        <svg viewBox="0 0 800 260" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img">
          <defs>
            <linearGradient id="g-hill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2bb673"/>
              <stop offset="100%" stopColor="#1e8d58"/>
            </linearGradient>
            <linearGradient id="g-path" x1="0" x2="1">
              <stop offset="0%" stopColor="#d9e9d9"/>
              <stop offset="100%" stopColor="#c7dcc7"/>
            </linearGradient>
          </defs>

          {/* distant hills */}
          <path d="M0 200 C 120 120, 200 120, 320 200 L0 200 Z" fill="url(#g-hill)" opacity="0.85"/>
          <path d="M320 200 C 430 110, 540 110, 800 200 L320 200 Z" fill="url(#g-hill)" opacity="0.95"/>

          {/* path */}
          <path d="M0 200 C 160 190, 240 210, 400 200 C 560 190, 640 210, 800 200 L800 260 L0 260 Z" fill="url(#g-path)"/>

          {/* trees */}
          <g className="trees" fill="#1c6b46">
            <path d="M120 180 l20 -40 l20 40 z"/>
            <rect x="138" y="180" width="4" height="14" rx="1"/>
            <path d="M560 172 l18 -36 l18 36 z"/>
            <rect x="576" y="172" width="4" height="14" rx="1"/>
            <path d="M690 176 l16 -32 l16 32 z"/>
            <rect x="704" y="176" width="4" height="14" rx="1"/>
          </g>

          {/* Dongdaemun-gu sign only (no poles), slightly higher, scaled 2x */}
          <g transform="translate(560,186) scale(2)">
            <rect x="-18" y="-36" width="56" height="16" rx="3" fill="#e7f6e9" stroke="#7a563a" />
            <text className="sign-text" x="10" y="-24" textAnchor="middle" fontSize="10" fill="#2b6d45">동대문구</text>
          </g>

          {/* walker (human silhouette) */}
          <g className="walk-person" transform="translate(380,182)">
            <circle cx="0" cy="-42" r="10" fill="#ffe6d3" stroke="#10202a" strokeWidth="1.5" />
            <rect x="-9" y="-35" width="18" height="26" rx="6" fill="#2bb673"/>
            <path d="M-12 -30 a8 8 0 0 1 24 0 v12 h-5 v-10 a3 3 0 0 0 -6 0 v10 h-5 v-12z" fill="#1e8d58" opacity="0.85"/>
            <rect className="walker-arm-left"  x="-12" y="-28" width="4" height="20" rx="2" fill="#244051"/>
            <rect className="walker-arm-right" x="8"   y="-28" width="4" height="20" rx="2" fill="#244051"/>
            <rect className="walker-leg-left"  x="-6" y="-10" width="4" height="26" rx="2" fill="#1f2b39"/>
            <rect className="walker-leg-right" x="2"  y="-10" width="4" height="26" rx="2" fill="#1f2b39"/>
            <rect x="-9" y="16" width="10" height="3" rx="1.5" fill="#0f1822"/>
            <rect x="1"  y="16" width="10" height="3" rx="1.5" fill="#0f1822"/>
          </g>
        </svg>
      </div>
    </div>
  )
}
