import React, { useState } from 'react';
import { getAvatarById } from '../shared/avatars';

export function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const iconSize = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-11 h-11' : 'w-9 h-9';
  const textSize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-xl';

  return (
    <div className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <div
        className={`${iconSize} rounded-xl bg-[#76533D] dark:bg-[#C99A75] text-[#F7F0E5] dark:text-[#1E1713] flex items-center justify-center shadow-sm`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 36 36" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2">
          {/* Cozy cup rim & 3x3 Sudoku grid inside */}
          <rect x="6" y="7" width="18" height="18" rx="3.5" />
          <path d="M12 7v18M18 7v18M6 13h18M6 19h18" strokeOpacity="0.65" strokeWidth="1.6" />
          {/* Coffee cup handle */}
          <path d="M24 11h2.5a3.5 3.5 0 0 1 0 7H24" strokeLinecap="round" />
          {/* Steam wisps */}
          <path d="M11 3.5c0-1 1.5-1.5 1.5-2.5M16 3.5c0-1 1.5-1.5 1.5-2.5" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      </div>
      <span className={`font-display font-extrabold tracking-tight text-[#76533D] dark:text-[#F5EBDD] ${textSize}`}>
        PLAYCOTEDOKU
      </span>
    </div>
  );
}

export function CapyAvatarImg({
  avatarId,
  alt,
  sizeClass = 'w-10 h-10',
  className = '',
}: {
  avatarId?: string | null;
  alt?: string;
  sizeClass?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const avatar = getAvatarById(avatarId);

  if (failed) {
    return (
      <div
        className={`${sizeClass} rounded-2xl bg-[#E8D5BC] dark:bg-[#352A23] text-[#76533D] dark:text-[#F5EBDD] flex items-center justify-center font-display font-bold text-sm shrink-0 ${className}`}
      >
        {avatar.name.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={avatar.imageUrl}
      alt={alt || avatar.name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-2xl object-cover shrink-0 border border-[#B98B68]/35 dark:border-[#C99A75]/35 bg-[#E8D5BC] dark:bg-[#352A23] ${className}`}
    />
  );
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
