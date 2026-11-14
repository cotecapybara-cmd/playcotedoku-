import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { CAPYBARA_AVATARS, getAvatarById } from '../shared/avatars';
import { CapyAvatarImg } from './BrandMark';

interface AvatarGalleryProps {
  selectedAvatarId: string;
  username?: string;
  onSelect: (avatarId: string) => void;
  onSave?: (avatarId: string) => Promise<void>;
  saving?: boolean;
  compact?: boolean;
}

export function AvatarGallery({
  selectedAvatarId,
  username,
  onSelect,
  onSave,
  saving = false,
  compact = false,
}: AvatarGalleryProps) {
  const [savedFeedback, setSavedFeedback] = useState(false);
  const activeAvatar = getAvatarById(selectedAvatarId);

  const handleSaveClick = async () => {
    if (!onSave) return;
    await onSave(selectedAvatarId);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2200);
  };

  return (
    <div className="space-y-5">
      {/* Live Preview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#E8D5BC]/50 dark:bg-[#352A23]/80 border border-[#B98B68]/25 dark:border-[#C99A75]/20">
        <div className="flex items-center gap-4">
          <CapyAvatarImg
            avatarId={selectedAvatarId}
            sizeClass={compact ? 'w-14 h-14' : 'w-20 h-20'}
            className="shadow-sm ring-2 ring-[#B98B68] dark:ring-[#C99A75]"
          />
          <div>
            <p className="text-xs font-medium text-[#76533D] dark:text-[#C99A75]">Selected Capybara Avatar</p>
            <h4 className="font-display text-lg font-bold text-[#49382D] dark:text-[#F5EBDD]">
              {activeAvatar.name}
            </h4>
            <p className="text-sm text-[#49382D]/80 dark:text-[#D2C2B0]">{activeAvatar.vibe}</p>
            {username && (
              <p className="mt-1 text-xs text-[#76533D] dark:text-[#C99A75] font-medium">
                Previewing as {username}
              </p>
            )}
          </div>
        </div>

        {onSave && (
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-[#76533D] hover:bg-[#5E412F] dark:bg-[#C99A75] dark:hover:bg-[#B98B68] text-[#F7F0E5] dark:text-[#1E1713] font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            {saving ? 'Saving...' : savedFeedback ? 'Avatar Saved!' : 'Save Avatar'}
          </button>
        )}
      </div>

      {/* Exact Uploaded Capybara Avatar Grid */}
      <div className={`grid gap-3.5 ${compact ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {CAPYBARA_AVATARS.map((avatar) => {
          const isSelected = avatar.id === selectedAvatarId;
          return (
            <button
              key={avatar.id}
              type="button"
              onClick={() => onSelect(avatar.id)}
              aria-pressed={isSelected}
              className={`group relative flex flex-col items-center text-center p-2.5 rounded-2xl border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#76533D] ${
                isSelected
                  ? 'bg-[#E8D5BC] dark:bg-[#3A2E26] border-[#76533D] dark:border-[#C99A75] shadow-sm ring-2 ring-[#B98B68]/50'
                  : 'bg-[#FCF8F2] dark:bg-[#29201B] border-[#E8D5BC] dark:border-[#3E3129] hover:border-[#B98B68]'
              }`}
            >
              <div className="relative w-full aspect-square overflow-hidden rounded-xl bg-[#E8D5BC]/40 dark:bg-[#1E1713]">
                <img
                  src={avatar.imageUrl}
                  alt={avatar.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                />
                {isSelected && (
                  <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#76533D] dark:bg-[#C99A75] text-[#F7F0E5] dark:text-[#1E1713] flex items-center justify-center shadow">
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  </span>
                )}
              </div>
              {!compact && (
                <div className="mt-2.5 w-full px-1">
                  <p className="font-display font-semibold text-sm text-[#49382D] dark:text-[#F5EBDD] truncate">
                    {avatar.name}
                  </p>
                  <p className="text-xs text-[#76533D]/80 dark:text-[#D2C2B0]/80 line-clamp-1 mt-0.5">
                    {avatar.vibe}
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
