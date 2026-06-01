const VIEWBOX_WIDTH = 560;
const VIEWBOX_HEIGHT = 520;

export function DecorativeZ() {
  return (
    <div
      className="hero-panel relative min-h-[460px] overflow-hidden rounded-[8px] border border-ink/10 shadow-soft"
      data-visual="interactive-z"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(7,18,38,0.07)_1px,transparent_1px)] bg-[length:38px_38px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_22%,rgba(38,184,166,0.16),transparent_30%),radial-gradient(circle_at_76%_28%,rgba(155,124,255,0.18),transparent_30%),radial-gradient(circle_at_50%_78%,rgba(23,185,208,0.14),transparent_34%)]" />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        role="img"
        aria-label="Animated Zuam logo halves with a centered star"
      >
        <defs>
          <linearGradient id="logoHalfGradient" x1="88" y1="80" x2="450" y2="430" gradientUnits="userSpaceOnUse">
            <stop stopColor="#08142F" />
            <stop offset="0.52" stopColor="#101B3A" />
            <stop offset="1" stopColor="#071226" />
          </linearGradient>
          <linearGradient id="logoEdgeGradient" x1="120" y1="92" x2="430" y2="308" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" stopOpacity="0.22" />
            <stop offset="0.52" stopColor="#9B7CFF" stopOpacity="0.22" />
            <stop offset="1" stopColor="#26B8A6" stopOpacity="0.2" />
          </linearGradient>
          <radialGradient id="logoStarGradient" cx="36%" cy="30%" r="78%">
            <stop stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="0.42" stopColor="#C9BBFF" stopOpacity="0.94" />
            <stop offset="1" stopColor="#8A6BFF" stopOpacity="0.9" />
          </radialGradient>
          <filter id="logoHalfShadow" x="-20%" y="-24%" width="140%" height="148%">
            <feDropShadow dx="0" dy="20" stdDeviation="16" floodColor="#071226" floodOpacity="0.16" />
          </filter>
          <filter id="logoStarGlow" x="-90%" y="-90%" width="280%" height="280%">
            <feDropShadow dx="0" dy="12" stdDeviation="14" floodColor="#9B7CFF" floodOpacity="0.34" />
          </filter>

          <g id="zuamHalf">
            <path
              d="M392 244 L458 108"
              fill="none"
              stroke="rgba(7,18,38,0.1)"
              strokeLinecap="round"
              strokeWidth="38"
              transform="translate(8 12)"
            />
            <circle cx="458" cy="108" r="32" fill="rgba(7,18,38,0.1)" transform="translate(8 12)" />
            <path
              d="M392 244 L458 108"
              fill="none"
              stroke="url(#logoHalfGradient)"
              strokeLinecap="round"
              strokeWidth="34"
              filter="url(#logoHalfShadow)"
            />
            <circle cx="458" cy="108" r="31" fill="url(#logoHalfGradient)" filter="url(#logoHalfShadow)" />
            <path
              d="M94 170 C94 116 129 84 184 84 H410 L441 118 L232 300 L202 270 L362 128 H184 C154 128 139 141 136 170 H94 Z"
              fill="rgba(7,18,38,0.1)"
              transform="translate(8 12)"
            />
            <path
              d="M94 170 C94 116 129 84 184 84 H410 L441 118 L232 300 L202 270 L362 128 H184 C154 128 139 141 136 170 H94 Z"
              fill="url(#logoHalfGradient)"
              filter="url(#logoHalfShadow)"
            />
            <path
              d="M132 136 C143 111 165 100 194 100 H398"
              fill="none"
              stroke="url(#logoEdgeGradient)"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.72"
            />
            <path
              d="M358 132 L222 285"
              fill="none"
              stroke="url(#logoEdgeGradient)"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.34"
            />
            <path
              d="M404 220 L448 120"
              fill="none"
              stroke="url(#logoEdgeGradient)"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.38"
            />
          </g>
        </defs>

        <image
          className="logo-backdrop"
          href="/logo.png"
          x="58"
          y="32"
          width="444"
          height="444"
          opacity="0.055"
          preserveAspectRatio="xMidYMid meet"
        />

        <g className="logo-half-left">
          <use href="#zuamHalf" />
        </g>

        <g className="logo-half-right">
          <g transform="translate(560 520) rotate(180)">
            <use href="#zuamHalf" />
          </g>
        </g>

        <g transform="translate(284 250)">
          <g className="logo-center-star" filter="url(#logoStarGlow)">
            <path
              d="M0 -38 L11 -11 L38 0 L11 11 L0 38 L-11 11 L-38 0 L-11 -11 Z"
              fill="url(#logoStarGradient)"
            />
            <path
              d="M0 -24 L7 -7 L24 0 L7 7 L0 24 L-7 7 L-24 0 L-7 -7 Z"
              fill="rgba(255,255,255,0.58)"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}
