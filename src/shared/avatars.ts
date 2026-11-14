import { CapyAvatar } from './types';

export const CAPYBARA_AVATARS: CapyAvatar[] = [
  {
    id: 'capy-boss',
    name: 'Rich Capi',
    vibe: 'Shades on, yuzu balanced, ready to solve.',
    imageUrl: '/assets/aistudio/5f213785b17fdcc40817daf8f6ed57d7_c9706735.jpg',
  },
  {
    id: 'capy-coder',
    name: 'Laptop Capi',
    vibe: 'Deep focus mode at the corner cafe table.',
    imageUrl: '/assets/aistudio/f0959d2947ef47367f5fa3d69751122c_b46eec19.jpg',
  },
  {
    id: 'capy-zen',
    name: 'Apple Capi',
    vibe: 'Calm, patient, zero-mistake mindfulness.',
    imageUrl: '/assets/aistudio/b234ce65120656a883ed53c671313463_3a17411f.jpg',
  },
  {
    id: 'capy-judge',
    name: 'Cozy Capi',
    vibe: 'Arms crossed, quietly scanning every 3x3 box.',
    imageUrl: '/assets/aistudio/a5273a55373327ee119cd35c0199cd26_998c6c0e.jpg',
  },
  {
    id: 'capy-duel',
    name: 'Duel Capi',
    vibe: 'Locked in for 1v1 speed races.',
    imageUrl: '/assets/aistudio/eeccea7c95bd8526d3716bb93406c9a3_7c811390.jpg',
  },
  {
    id: 'capy-chill',
    name: 'Yuzu Chill Capi',
    vibe: 'Unbothered espresso break energy.',
    imageUrl: '/assets/aistudio/03eca397eae482118fb4cab32d2eec2e_3be24820.jpg',
  },
];

export const DEFAULT_AVATAR_ID = CAPYBARA_AVATARS[1].id;

export function getAvatarById(avatarId?: string | null): CapyAvatar {
  return CAPYBARA_AVATARS.find((a) => a.id === avatarId) ?? CAPYBARA_AVATARS[0];
}
