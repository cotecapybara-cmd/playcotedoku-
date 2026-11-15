export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export type GameMode = 'solo' | 'daily' | 'coop' | 'race';

export type ThemeMode = 'light' | 'dark';

export interface CapyAvatar {
  id: string;
  name: string;
  vibe: string;
  imageUrl: string;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  category: 'milestone' | 'skill' | 'streak' | 'social';
  iconKey: string;
}

export interface UnlockedAchievement {
  achievementId: string;
  unlockedAt: string;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  bio: string;
  avatarId: string;
  theme: ThemeMode;
  soundEnabled: boolean;
  musicEnabled: boolean;
  notificationsEnabled: boolean;
  fastPencilDefault: boolean;
  xp: number;
  level: number;
  streakDays: number;
  winStreak: number;
  bestWinStreak: number;
  lastDailyDate: string | null;
  wins: number;
  gamesPlayed: number;
  perfectGames: number;
  bestTimeEasy: number | null;
  bestTimeMedium: number | null;
  bestTimeHard: number | null;
  bestTimeExpert: number | null;
  hintCredits: number;
  pencilCredits: number;
  createdAt: string;
}

export interface PublicPlayer {
  id: number;
  username: string;
  bio: string;
  avatarId: string;
  xp: number;
  level: number;
  streakDays: number;
  winStreak: number;
  wins: number;
  gamesPlayed: number;
  perfectGames: number;
  bestTimeEasy: number | null;
  bestTimeMedium: number | null;
  bestTimeHard: number | null;
  bestTimeExpert: number | null;
  isOnline: boolean;
  friendshipStatus?: 'none' | 'friends' | 'outgoing' | 'incoming';
}

export interface SavedGame {
  id: number;
  userId: number;
  mode: 'solo' | 'daily';
  difficulty: Difficulty;
  puzzle: number[][];
  solution: number[][];
  board: number[][];
  notes: number[][][];
  elapsedSeconds: number;
  mistakes: number;
  hintsUsed: number;
  score: number;
  dailyDate: string | null;
  updatedAt: string;
}

export interface GameHistoryEntry {
  id: number;
  mode: GameMode;
  difficulty: Difficulty;
  durationSeconds: number;
  mistakes: number;
  hintsUsed: number;
  score: number;
  won: boolean;
  xpEarned: number;
  completedAt: string;
}

export interface DailyChallengeInfo {
  dailyDate: string;
  difficulty: Difficulty;
  puzzle: number[][];
  solution: number[][];
  savedGame: SavedGame | null;
  userCompletion: {
    durationSeconds: number;
    mistakes: number;
    score: number;
    completedAt: string;
  } | null;
  leaderboard: Array<{
    userId: number;
    username: string;
    avatarId: string;
    durationSeconds: number;
    mistakes: number;
    score: number;
    isFriend: boolean;
  }>;
}

export interface CoopCellActor {
  userId: number;
  username: string;
  avatarId: string;
  value: number;
  updatedAt: number;
}

export interface RoomParticipant {
  userId: number;
  username: string;
  avatarId: string;
  level: number;
  isHost: boolean;
  isConnected: boolean;
  progress: number; // 0-100
  filledCells: number;
  totalToFill: number;
  mistakes: number;
  score: number;
  finishedAt: number | null;
  rematchReady: boolean;
}

export interface RoomChatMessage {
  id: string;
  userId: number;
  username: string;
  avatarId: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface MultiplayerRoomView {
  code: string;
  name: string;
  mode: 'coop' | 'race';
  difficulty: Difficulty;
  status: 'waiting' | 'playing' | 'finished';
  hostId: number;
  puzzle: number[][];
  // Shared board in coop; in race, client keeps its own board synced via server validation
  coopBoard?: number[][];
  coopNotes?: number[][][];
  coopActors?: Record<string, CoopCellActor>;
  coopMistakes?: number;
  coopScore?: number;
  coopMistakeCells?: string[];
  myRaceBoard?: number[][];
  myRaceNotes?: number[][][];
  myRaceMistakes?: number;
  myRaceScore?: number;
  myRaceMistakeCells?: string[];
  startedAt: number | null;
  finishedAt: number | null;
  winnerId: number | null;
  winnerUsername: string | null;
  matchId: string;
  myHintsRemaining: number;
  myHintsUsed: number;
  myFastPencilUnlocked: boolean;
  myAccountHintCredits: number;
  myAccountPencilCredits: number;
  myMatchReward?: {
    matchId: string;
    hintCredits: number;
    pencilCredits: number;
    xpEarned: number;
  } | null;
  participants: RoomParticipant[];
  chat: RoomChatMessage[];
}

export interface GameInvite {
  roomCode: string;
  roomName: string;
  mode: 'coop' | 'race';
  difficulty: Difficulty;
  fromUserId: number;
  fromUsername: string;
  fromAvatarId: string;
  sentAt: number;
}
