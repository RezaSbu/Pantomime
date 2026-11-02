import React, { useId } from 'react';

interface AdabaziLogoProps {
  className?: string;
  title?: string;
}

export const AdabaziLogo: React.FC<AdabaziLogoProps> = ({
  className = 'w-16 h-16',
  title = 'لوگوی ادابازی',
}) => {
  const uid = useId().replace(/:/g, '');
  const stageBgId = `stageBg_${uid}`;
  const goldRimId = `goldRim_${uid}`;
  const spotlightId = `spotlight_${uid}`;
  const backMaskId = `backMask_${uid}`;
  const frontMaskId = `frontMask_${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      role="img"
      aria-label={title}
      className={className}
    >
      <defs>
        <linearGradient id={stageBgId} x1="48" y1="32" x2="464" y2="488" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="48%" stopColor="#047857" />
          <stop offset="100%" stopColor="#022C22" />
        </linearGradient>

        <linearGradient id={goldRimId} x1="96" y1="64" x2="416" y2="456" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="45%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>

        <radialGradient id={spotlightId} cx="50%" cy="44%" r="52%">
          <stop offset="0%" stopColor="#34D399" stopOpacity="0.42" />
          <stop offset="65%" stopColor="#059669" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#022C22" stopOpacity="0" />
        </radialGradient>

        <linearGradient id={backMaskId} x1="-68" y1="-108" x2="68" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="60%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>

        <linearGradient id={frontMaskId} x1="-78" y1="-124" x2="72" y2="114" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="65%" stopColor="#FFFBEB" />
          <stop offset="100%" stopColor="#FDE68A" />
        </linearGradient>
      </defs>

      {/* App Squircle Stage Base */}
      <rect x="16" y="16" width="480" height="480" rx="116" fill={`url(#${stageBgId})`} />
      <rect
        x="24"
        y="24"
        width="464"
        height="464"
        rx="108"
        stroke={`url(#${goldRimId})`}
        strokeOpacity="0.45"
        strokeWidth="4"
      />

      {/* Stage Spotlight Glow */}
      <circle cx="256" cy="256" r="210" fill={`url(#${spotlightId})`} />

      {/* Stopwatch / Stage Medallion Ring */}
      <circle
        cx="256"
        cy="272"
        r="172"
        fill="#022C22"
        fillOpacity="0.46"
        stroke={`url(#${goldRimId})`}
        strokeWidth="11"
      />
      <circle
        cx="256"
        cy="272"
        r="152"
        stroke="#FDE68A"
        strokeOpacity="0.28"
        strokeWidth="4"
        strokeDasharray="6 22"
        strokeLinecap="round"
      />

      {/* Top Stopwatch Crown & Golden 30-Point Star Crest */}
      <circle
        cx="256"
        cy="92"
        r="36"
        fill="#022C22"
        stroke={`url(#${goldRimId})`}
        strokeWidth="8"
      />
      <path
        d="M256 68L263.2 82.8L279.5 85.1L267.7 96.6L270.5 112.8L256 105.1L241.5 112.8L244.3 96.6L232.5 85.1L248.8 82.8L256 68Z"
        fill={`url(#${goldRimId})`}
      />

      {/* Secondary Pantomime Mask (Left / Curious Expression) */}
      <g transform="translate(194 274) rotate(-13)">
        <path
          d="M-66 -52C-66 -86 -36 -108 0 -108C36 -108 66 -86 66 -52V-4C66 44 35 84 0 98C-35 84 -66 44 -66 -4V-52Z"
          fill={`url(#${backMaskId})`}
          stroke="#78350F"
          strokeOpacity="0.35"
          strokeWidth="4"
        />
        {/* Curious Arched Brows */}
        <path
          d="M-40 -46Q-25 -60 -10 -46"
          stroke="#064E3B"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M10 -48Q25 -64 40 -46"
          stroke="#064E3B"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Expressive Eyes */}
        <circle cx="-25" cy="-20" r="10" fill="#064E3B" />
        <circle cx="25" cy="-20" r="10" fill="#064E3B" />
        <circle cx="-22" cy="-23" r="3" fill="#FFFBEB" />
        <circle cx="28" cy="-23" r="3" fill="#FFFBEB" />
        {/* Classic Pantomime Surprised "O" Mouth */}
        <ellipse cx="0" cy="34" rx="14" ry="19" fill="#064E3B" />
      </g>

      {/* Soft Shadow Behind Primary Mask */}
      <g transform="translate(292 288) rotate(10)">
        <path
          d="M-78 -60C-78 -98 -44 -122 0 -122C44 -122 78 -98 78 -60V-6C78 48 42 96 0 112C-42 96 -78 48 -78 -6V-60Z"
          fill="#022C22"
          fillOpacity="0.52"
        />
      </g>

      {/* Primary Hero Pantomime Mask (Right / Joyful Smile) */}
      <g transform="translate(302 278) rotate(10)">
        <path
          d="M-78 -60C-78 -98 -44 -122 0 -122C44 -122 78 -98 78 -60V-6C78 48 42 96 0 112C-42 96 -78 48 -78 -6V-60Z"
          fill={`url(#${frontMaskId})`}
          stroke="#F59E0B"
          strokeOpacity="0.4"
          strokeWidth="4"
        />
        {/* Forehead Sheen */}
        <path
          d="M-46 -78C-24 -96 24 -96 46 -78"
          stroke="#FFFFFF"
          strokeOpacity="0.85"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Joyful Curved Eyes */}
        <path
          d="M-44 -24Q-28 -44 -12 -24"
          stroke="#064E3B"
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          d="M12 -24Q28 -44 44 -24"
          stroke="#064E3B"
          strokeWidth="11"
          strokeLinecap="round"
        />
        {/* Warm Cheek Accents */}
        <circle cx="-44" cy="4" r="11" fill="#F59E0B" fillOpacity="0.28" />
        <circle cx="44" cy="4" r="11" fill="#F59E0B" fillOpacity="0.28" />
        {/* Contagious Stage Smile */}
        <path
          d="M-38 18C-24 62 24 62 38 18C14 26 -14 26 -38 18Z"
          fill="#064E3B"
        />
        <path
          d="M-18 42C-8 50 8 50 18 42"
          stroke="#10B981"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </g>

      {/* Crisp Stage Sparkle Glints */}
      <path
        d="M124 152L129 166L143 171L129 176L124 190L119 176L105 171L119 166L124 152Z"
        fill="#FEF08A"
      />
      <path
        d="M398 144L402 154L412 158L402 162L398 172L394 162L384 158L394 154L398 144Z"
        fill="#FDE68A"
      />
    </svg>
  );
};
