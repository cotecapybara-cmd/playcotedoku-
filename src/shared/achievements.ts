import { AchievementDef } from './types';

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_puzzle',
    title: 'First Sip',
    description: 'Complete your very first Sudoku puzzle on PLAYCOTEDOKU.',
    xpReward: 100,
    category: 'milestone',
    iconKey: 'coffee',
  },
  {
    id: 'no_mistakes',
    title: 'Pure Pour-Over',
    description: 'Finish any puzzle with zero mistakes.',
    xpReward: 150,
    category: 'skill',
    iconKey: 'sparkles',
  },
  {
    id: 'speed_solver',
    title: 'Espresso Shot',
    description: 'Solve a Medium or harder puzzle in under 4 minutes.',
    xpReward: 200,
    category: 'skill',
    iconKey: 'zap',
  },
  {
    id: 'sudoku_master',
    title: 'Roast Master',
    description: 'Complete an Expert difficulty puzzle.',
    xpReward: 350,
    category: 'skill',
    iconKey: 'crown',
  },
  {
    id: 'seven_day_streak',
    title: 'Seven-Day Brew',
    description: 'Maintain a 7-day Daily Challenge streak.',
    xpReward: 400,
    category: 'streak',
    iconKey: 'flame',
  },
  {
    id: 'daily_devotee',
    title: 'Morning Ritual',
    description: 'Complete your first Daily Challenge.',
    xpReward: 120,
    category: 'streak',
    iconKey: 'calendar',
  },
  {
    id: 'cozy_coop',
    title: 'Table for Two',
    description: 'Complete a Cooperative Multiplayer puzzle with a friend.',
    xpReward: 180,
    category: 'social',
    iconKey: 'users',
  },
  {
    id: 'race_champion',
    title: 'Barista Champion',
    description: 'Win a real-time 1v1 Competitive Race.',
    xpReward: 220,
    category: 'social',
    iconKey: 'trophy',
  },
  {
    id: 'ten_wins',
    title: 'Regular Customer',
    description: 'Complete 10 total Sudoku puzzles.',
    xpReward: 250,
    category: 'milestone',
    iconKey: 'award',
  },
];

export function getLevelFromXp(xp: number): number {
  // Progressive cozy curve: Lv 1 = 0, Lv 2 = 200, Lv 3 = 500, Lv 4 = 900...
  let level = 1;
  let threshold = 200;
  let remaining = Math.max(0, xp);
  while (remaining >= threshold) {
    remaining -= threshold;
    level += 1;
    threshold += 100;
  }
  return level;
}

export function getLevelProgress(xp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  percent: number;
} {
  let level = 1;
  let threshold = 200;
  let remaining = Math.max(0, xp);
  while (remaining >= threshold) {
    remaining -= threshold;
    level += 1;
    threshold += 100;
  }
  return {
    level,
    currentLevelXp: remaining,
    nextLevelXp: threshold,
    percent: Math.min(100, Math.round((remaining / threshold) * 100)),
  };
}
